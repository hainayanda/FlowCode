import { MessageStore } from '../../interfaces/message-store';
import { SessionManager } from '../../interfaces/session-manager';
import { Message } from '../../models/messages';
import { SessionChangeEvent } from '../../models/session-events';

/**
 * In-memory message store implementation.
 *
 * Provides fast, array-based storage for conversation messages in memory.
 * Supports message history retrieval with summary boundaries, regex search,
 * and efficient message storage operations. Automatically clears messages
 * when the active session changes.
 */
export class CachedMessageStore implements MessageStore {
    private messages: Message[] = [];
    private sessionManager: SessionManager;
    private currentSessionName: string | null = null;
    private readonly maxCachedCount: number;

    /**
     * Creates a new CachedMessageStore instance.
     *
     * @param sessionManager - Session manager to track session changes
     * @param maxCachedCount - Maximum number of messages to cache (default: 100)
     */
    constructor(sessionManager: SessionManager, maxCachedCount: number = 100) {
        this.sessionManager = sessionManager;
        this.maxCachedCount = maxCachedCount;
        this.setupSessionChangeListener();
    }

    /**
     * Store a single message (replace if same ID exists).
     *
     * @param message - The message to store
     * @returns Promise<void> Resolves when the message is stored
     */
    async storeMessage(message: Message): Promise<void> {
        await this.ensureSessionInitialized();

        // Find existing message with same ID and replace it
        const existingIndex = this.messages.findIndex(
            (m) => m.id === message.id
        );
        if (existingIndex >= 0) {
            this.messages[existingIndex] = message;
        } else {
            this.messages.push(message);
        }

        // Sort messages by timestamp to maintain chronological order
        this.messages.sort(
            (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
        );

        // Enforce max cache limit by removing oldest messages
        this.enforceMaxCacheLimit();
    }

    /**
     * Store multiple messages.
     *
     * @param messages - Array of messages to store
     * @returns Promise<void> Resolves when all messages are stored
     */
    async storeMessages(messages: Message[]): Promise<void> {
        for (const message of messages) {
            await this.storeMessage(message);
        }
    }

    /**
     * Get message history with optional limit.
     *
     * Returns messages in chronological order. If a summary message is encountered,
     * returns messages up to and including the summary (excluding messages after the summary
     * since they are represented by the summary).
     *
     * @param limit - Maximum number of messages to return
     * @returns Promise<Message[]> Array of messages in chronological order
     */
    async getMessageHistory(limit?: number): Promise<Message[]> {
        await this.ensureSessionInitialized();

        // Find the most recent summary message in ALL messages
        let summaryIndex = -1;
        for (let i = this.messages.length - 1; i >= 0; i--) {
            if (this.messages[i]?.type === 'summary') {
                summaryIndex = i;
                break;
            }
        }

        // If summary found, return messages up to and including the summary
        if (summaryIndex >= 0) {
            const messagesToSummary = this.messages.slice(0, summaryIndex + 1);
            // Apply limit if specified
            return limit && limit > 0
                ? messagesToSummary.slice(-limit)
                : messagesToSummary;
        }

        // No summary found, apply normal limit
        return limit && limit > 0
            ? this.messages.slice(-limit)
            : [...this.messages];
    }

    /**
     * Get messages by type.
     *
     * @param type - The message type to filter by
     * @param limit - Maximum number of messages to return
     * @returns Promise<Message[]> Array of messages matching the type
     */
    async getMessagesByType(
        type: Message['type'],
        limit?: number
    ): Promise<Message[]> {
        await this.ensureSessionInitialized();

        const filteredMessages = this.messages.filter(
            (message) => message.type === type
        );

        // Apply limit if specified (return the most recent messages)
        return limit && limit > 0
            ? filteredMessages.slice(-limit)
            : filteredMessages;
    }

    /**
     * Search messages by regex pattern with optional type filtering.
     *
     * @param pattern - Regular expression pattern to search for
     * @param limit - Maximum number of messages to return
     * @param type - Optional message type to filter by
     * @returns Promise<Message[]> Array of matching messages
     */
    async searchByRegex(
        pattern: string,
        limit?: number,
        type?: Message['type']
    ): Promise<Message[]> {
        await this.ensureSessionInitialized();

        try {
            const regex = new RegExp(pattern, 'i');
            let filteredMessages = this.messages.filter((message) => {
                // Filter by type if specified
                if (type && message.type !== type) {
                    return false;
                }
                // Search in message content
                return regex.test(message.content);
            });

            // Apply limit if specified
            if (limit && limit > 0) {
                filteredMessages = filteredMessages.slice(0, limit);
            }

            return filteredMessages;
        } catch (error) {
            // If regex is invalid, treat it as a simple string search
            const searchText = pattern.toLowerCase();
            let filteredMessages = this.messages.filter((message) => {
                // Filter by type if specified
                if (type && message.type !== type) {
                    return false;
                }
                // Simple case-insensitive string search
                return message.content.toLowerCase().includes(searchText);
            });

            // Apply limit if specified
            if (limit && limit > 0) {
                filteredMessages = filteredMessages.slice(0, limit);
            }

            return filteredMessages;
        }
    }

    /**
     * Get message by ID.
     *
     * @param messageId - The ID of the message to retrieve
     * @returns Promise<Message | null> The message if found, null otherwise
     */
    async getMessageById(messageId: string): Promise<Message | null> {
        await this.ensureSessionInitialized();
        const message = this.messages.find((m) => m.id === messageId);
        return message || null;
    }

    private clearMessages(): void {
        this.messages = [];
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
        try {
            // Clear messages when switching to a different session
            if (event.type === 'session-switched') {
                this.clearMessages();
                this.currentSessionName = event.activeSession.name;
            }
        } catch (error) {
            console.error('Error handling session change:', error);
        }
    }

    private async ensureSessionInitialized(): Promise<void> {
        if (!this.currentSessionName) {
            const activeSession = await this.sessionManager.getActiveSession();
            this.currentSessionName = activeSession.name;
        }
    }

    /**
     * Enforce the maximum cache limit by removing oldest messages if necessary.
     */
    private enforceMaxCacheLimit(): void {
        if (this.messages.length > this.maxCachedCount) {
            // Remove oldest messages to stay within limit
            // Messages are already sorted chronologically, so remove from beginning
            this.messages = this.messages.slice(-this.maxCachedCount);
        }
    }
}
