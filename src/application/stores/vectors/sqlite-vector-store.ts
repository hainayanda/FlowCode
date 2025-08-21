import Database from 'better-sqlite3';
import { VectorStore } from '../../interfaces/vector-store';
import { SessionManager } from '../../interfaces/session-manager';
import { VectorSearchResult } from '../../models/sqlite-message';
import { SessionChangeEvent } from '../../models/session-events';
import { SessionInfo } from '../../models/sessions';
import { calculateCosineSimilarityFromBuffers } from '../../../utils/vector-similarity';

/**
 * SQLite-based vector store implementation using custom SQLite functions for similarity search.
 *
 * Provides persistent storage for vector embeddings using SQLite database with
 * custom cosine similarity function for efficient vector similarity search operations.
 * Automatically switches databases when the active session changes.
 */
export class SQLiteVectorStore implements VectorStore {
    private sessionManager: SessionManager;
    private isClosed: boolean = false;
    private isInitialized: boolean = false;

    /**
     * Creates a new SQLiteVectorStore instance.
     *
     * @param sessionManager - Session manager to get database path from
     */
    constructor(sessionManager: SessionManager) {
        this.sessionManager = sessionManager;
        this.setupSessionChangeListener();
    }

    /**
     * Store a vector embedding for a message.
     *
     * @param vector - The vector embedding to store
     * @param messageId - The associated message ID
     * @returns Promise<void> Resolves when the vector is stored
     * @throws Error if vector storage fails
     */
    async storeVector(vector: number[], messageId: string): Promise<void> {
        if (vector.length === 0) {
            throw new Error('Vector cannot be empty');
        }

        const session = await this.getSession();
        await this.ensureInitialized(session.database);

        const stmt = session.database.prepare(`
                INSERT OR REPLACE INTO vectors (id, messageId, vector)
                VALUES (?, ?, ?)
            `);

        // Use messageId as the primary key for replacement behavior
        const vectorId = messageId;

        // Convert vector array to blob for storage
        const vectorBlob = new Float32Array(vector);

        try {
            stmt.run(vectorId, messageId, Buffer.from(vectorBlob.buffer));
        } catch (error) {
            throw new Error(`Vector storage failed: ${error}`);
        }
    }

    /**
     * Search for similar vectors using cosine similarity.
     *
     * @param vector - The query vector to search with
     * @param limit - Maximum number of results to return (default: 10)
     * @returns Promise<VectorSearchResult[]> Array of similar vectors with similarity scores
     * @throws Error if vector search fails
     */
    async searchSimilar(
        vector: number[],
        limit: number = 10
    ): Promise<VectorSearchResult[]> {
        const session = await this.getSession();
        await this.ensureInitialized(session.database);

        // Convert query vector to Float32Array buffer for SQLite function
        const queryVectorBuffer = Buffer.from(new Float32Array(vector).buffer);

        // Use SQLite function for vector similarity search
        // Filter out results with negative similarity (which shouldn't happen with proper vectors)
        const query = `
            SELECT 
                id, 
                messageId, 
                vector,
                cosine_similarity(vector, ?) as similarity
            FROM vectors
            WHERE cosine_similarity(vector, ?) >= 0
            ORDER BY similarity DESC
            LIMIT ?
        `;

        try {
            const rows = session.database
                .prepare(query)
                .all(queryVectorBuffer, queryVectorBuffer, limit) as Array<{
                id: string;
                messageId: string;
                vector: Buffer;
                similarity: number;
            }>;

            return rows.map((row) => ({
                id: row.id,
                messageId: row.messageId,
                vector: Array.from(new Float32Array(row.vector.buffer)),
                similarity: row.similarity,
            }));
        } catch (error) {
            throw new Error(`Vector search failed: ${error}`);
        }
    }

    /**
     * Close the vector store and clean up event listeners.
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
            throw new Error('Vector store has been closed');
        }

        return await this.sessionManager.getActiveSession();
    }

    private async ensureInitialized(
        database: Database.Database
    ): Promise<void> {
        if (this.isInitialized) return;

        // Register cosine similarity function
        database.function(
            'cosine_similarity',
            (vectorA: Buffer, vectorB: Buffer): number => {
                return calculateCosineSimilarityFromBuffers(vectorA, vectorB);
            }
        );

        // Create vectors table
        database.exec(`
                CREATE TABLE IF NOT EXISTS vectors (
                    id TEXT PRIMARY KEY,
                    messageId TEXT NOT NULL,
                    vector BLOB NOT NULL,
                    created_at INTEGER DEFAULT (strftime('%s', 'now'))
                );
            `);

        // Create index for faster messageId lookups
        database.exec(`
                CREATE INDEX IF NOT EXISTS idx_vectors_messageId ON vectors(messageId);
                CREATE INDEX IF NOT EXISTS idx_vectors_created_at ON vectors(created_at);
            `);

        this.isInitialized = true;
    }
}
