import Database from 'better-sqlite3';
import { SessionManager } from '../../services/interfaces/session-manager';
import { MessageStore } from '../interfaces/message-store';
import { Message } from '../models/messages';
import { SessionChangeEvent } from '../models/session-events';
import { SessionInfo } from '../models/sessions';
import { MessageRow } from '../models/sqlite-message';
import { parseMessageFromRow } from './sqlite-message-parser';

/**
 * SQLite-based message store implementation.
 *
 * Provides persistent storage for conversation messages using SQLite database.
 * Supports message history retrieval with summary boundaries, regex search,
 * and efficient message storage operations. Automatically switches databases
 * when the active session changes.
 */
export class SQLiteMessageStore implements MessageStore {
    private sessionManager: SessionManager;
    private isClosed: boolean = false;
    private isInitialized: boolean = false;

    /**
     * Creates a new SQLiteMessageStore instance.
     *
     * @param sessionManager - Session manager to get database path from
     */
    constructor(sessionManager: SessionManager) {
        this.sessionManager = sessionManager;
        this.setupSessionChangeListener();
    }

    /**
     * Store a single message (replace if same ID exists).
     *
     * @param message - The message to store
     * @returns Promise<void> Resolves when the message is stored
     */
    async storeMessage(message: Message): Promise<void> {
        const session = await this.getSession();
        await this.ensureInitialized(session.database);

        const stmt = session.database.prepare(`
            INSERT OR REPLACE INTO messages (id, content, type, sender, timestamp, metadata)
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        // Serialize metadata to JSON string if it exists
        const metadata = (message as any).metadata
            ? JSON.stringify((message as any).metadata)
            : null;

        stmt.run(
            message.id,
            message.content,
            message.type,
            message.sender,
            message.timestamp.getTime(),
            metadata
        );
    }

    /**
     * Store multiple messages.
     *
     * @param messages - Array of messages to store
     * @returns Promise<void> Resolves when all messages are stored
     */
    async storeMessages(messages: Message[]): Promise<void> {
        const session = await this.getSession();
        await this.ensureInitialized(session.database);

        const stmt = session.database.prepare(`
            INSERT OR REPLACE INTO messages (id, content, type, sender, timestamp, metadata)
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        const transaction = session.database.transaction((msgs: Message[]) => {
            for (const message of msgs) {
                // Serialize metadata to JSON string if it exists
                const metadata = (message as any).metadata
                    ? JSON.stringify((message as any).metadata)
                    : null;

                stmt.run(
                    message.id,
                    message.content,
                    message.type,
                    message.sender,
                    message.timestamp.getTime(),
                    metadata
                );
            }
        });

        transaction(messages);
    }

    /**
     * Get message history with optional limit.
     * Returns last n messages or until it encounters a message type 'summary'
     * (which is a summary of last messages).
     *
     * @param limit - Maximum number of messages to return (optional)
     * @returns Promise<Message[]> Array of messages in chronological order
     */
    async getMessageHistory(limit?: number): Promise<Message[]> {
        const session = await this.getSession();
        await this.ensureInitialized(session.database);

        // First, get all messages in chronological order to find summary boundary
        const allQuery = `
            SELECT id, content, type, sender, timestamp, metadata
            FROM messages
            ORDER BY created_at ASC
        `;

        const allRows = session.database
            .prepare(allQuery)
            .all() as MessageRow[];
        const allMessages = allRows.map((row) => parseMessageFromRow(row));

        // Find the most recent summary message
        let summaryIndex = -1;
        for (let i = allMessages.length - 1; i >= 0; i--) {
            if (allMessages[i]?.type === 'summary') {
                summaryIndex = i;
                break;
            }
        }

        // If summary found, return messages up to and including the summary
        if (summaryIndex >= 0) {
            const messagesToSummary = allMessages.slice(0, summaryIndex + 1);
            // Apply limit if specified
            return limit && limit > 0
                ? messagesToSummary.slice(-limit)
                : messagesToSummary;
        }

        // No summary found, apply normal limit
        return limit && limit > 0 ? allMessages.slice(-limit) : allMessages;
    }

    /**
     * Get messages by type.
     *
     * @param type - The message type to filter by
     * @param limit - Maximum number of messages to return
     * @returns Promise<Message[]> Array of messages of the specified type
     */
    async getMessagesByType(
        type: Message['type'],
        limit?: number
    ): Promise<Message[]> {
        const session = await this.getSession();
        await this.ensureInitialized(session.database);

        let query = `
            SELECT id, content, type, sender, timestamp, metadata
            FROM messages
            WHERE type = ?
            ORDER BY timestamp ASC
        `;

        if (limit && limit > 0) {
            // To get the most recent N messages, we need to order by DESC, limit, then reverse
            query = `
                SELECT id, content, type, sender, timestamp, metadata
                FROM (
                    SELECT id, content, type, sender, timestamp, metadata
                    FROM messages
                    WHERE type = ?
                    ORDER BY timestamp DESC
                    LIMIT ${limit}
                ) 
                ORDER BY timestamp ASC
            `;
        }

        const rows = session.database.prepare(query).all(type) as MessageRow[];
        return rows.map((row) => parseMessageFromRow(row));
    }

    /**
     * Search messages by pattern with optional type filtering.
     *
     * Note: Uses SQL LIKE pattern matching. Use % for wildcards.
     * For regex-like behavior, convert pattern to LIKE format.
     *
     * @param pattern - Search pattern (SQL LIKE format with % wildcards)
     * @param limit - Maximum number of messages to return (optional)
     * @param type - Message type to filter by (optional)
     * @returns Promise<Message[]> Array of matching messages
     */
    async searchByRegex(
        pattern: string,
        limit?: number,
        type?: Message['type']
    ): Promise<Message[]> {
        const session = await this.getSession();
        await this.ensureInitialized(session.database);

        // Convert simple patterns to LIKE format if needed
        let likePattern = pattern;
        if (!pattern.includes('%')) {
            likePattern = `%${pattern}%`;
        }

        let query = `
            SELECT id, content, type, sender, timestamp, metadata
            FROM messages
            WHERE content LIKE ?
        `;

        const params: any[] = [likePattern];

        if (type) {
            query += ` AND type = ?`;
            params.push(type);
        }

        query += ` ORDER BY created_at DESC`;

        if (limit) {
            query += ` LIMIT ${limit}`;
        }

        const rows = session.database
            .prepare(query)
            .all(...params) as MessageRow[];

        return rows.map((row) => parseMessageFromRow(row));
    }

    /**
     * Get message by ID.
     *
     * @param messageId - The ID of the message to retrieve
     * @returns Promise<Message | null> The message if found, null otherwise
     */
    async getMessageById(messageId: string): Promise<Message | null> {
        const session = await this.getSession();
        await this.ensureInitialized(session.database);

        const row = session.database
            .prepare(
                `
            SELECT id, content, type, sender, timestamp, metadata
            FROM messages
            WHERE id = ?
        `
            )
            .get(messageId) as MessageRow | undefined;

        if (!row) {
            return null;
        }

        return parseMessageFromRow(row);
    }

    /**
     * Close the message store and clean up event listeners.
     *
     * @returns Promise<void> Resolves when cleanup is complete
     */
    async close(): Promise<void> {
        this.isClosed = true;

        // Remove session change listener
        this.sessionManager.removeListener(
            'session-changed',
            this.handleSessionChange.bind(this)
        );

        // Note: Database is managed by session, not closed here
        this.isInitialized = false;
    }

    private setupSessionChangeListener(): void {
        this.sessionManager.on(
            'session-changed',
            this.handleSessionChange.bind(this)
        );
    }

    private async handleSessionChange(
        event: SessionChangeEvent
    ): Promise<void> {
        if (event.type !== 'session-switched') {
            return;
        }

        // Reset initialization state when session changes
        // Database will be re-initialized on next use
        this.isInitialized = false;
    }

    private async getSession(): Promise<SessionInfo> {
        if (this.isClosed) {
            throw new Error('Message store has been closed');
        }

        return await this.sessionManager.getActiveSession();
    }

    private async ensureInitialized(
        database: Database.Database
    ): Promise<void> {
        if (this.isInitialized) return;

        // Create messages table if it doesn't exist
        database.exec(`
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                content TEXT NOT NULL,
                type TEXT NOT NULL,
                sender TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                metadata TEXT,
                created_at INTEGER DEFAULT (strftime('%s', 'now'))
            );
        `);

        // Create index for faster queries
        database.exec(`
            CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
            CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(type);
            CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
        `);

        this.isInitialized = true;
    }
}
