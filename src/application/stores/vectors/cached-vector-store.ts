import { calculateCosineSimilarity } from '../../../common/utils/vector-similarity';
import { SessionManager } from '../../services/interfaces/session-manager';
import { VectorStore } from '../interfaces/vector-store';
import { SessionChangeEvent } from '../models/session-events';
import { VectorSearchResult } from '../models/sqlite-message';

/**
 * In-memory vector store implementation.
 *
 * Provides fast, array-based storage for vector embeddings in memory.
 * Supports vector similarity search with configurable similarity thresholds.
 * Automatically clears vectors when the active session changes.
 */
export class CachedVectorStore implements VectorStore {
    private vectors: Array<{
        id: string;
        messageId: string;
        vector: number[];
        timestamp: number;
    }> = [];
    private sessionManager: SessionManager;
    private currentSessionName: string | null = null;
    private readonly maxCachedCount: number;

    /**
     * Creates a new CachedVectorStore instance.
     *
     * @param sessionManager - Session manager to track session changes
     * @param maxCachedCount - Maximum number of vectors to cache (default: 1000)
     */
    constructor(sessionManager: SessionManager, maxCachedCount: number = 1000) {
        this.sessionManager = sessionManager;
        this.maxCachedCount = maxCachedCount;
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

        await this.ensureSessionInitialized();

        // Find existing vector with same message ID and replace it
        const existingIndex = this.vectors.findIndex(
            (v) => v.messageId === messageId
        );

        const vectorEntry = {
            id: messageId, // Use messageId as the primary key for replacement behavior
            messageId: messageId,
            vector: [...vector], // Create a copy to avoid reference issues
            timestamp: Date.now(),
        };

        if (existingIndex >= 0) {
            this.vectors[existingIndex] = vectorEntry;
        } else {
            this.vectors.push(vectorEntry);
        }

        // Sort vectors by timestamp to maintain chronological order
        this.vectors.sort((a, b) => a.timestamp - b.timestamp);

        // Enforce max cache limit by removing oldest vectors
        this.enforceMaxCacheLimit();
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
        await this.ensureSessionInitialized();

        // Calculate similarity for all vectors
        const results: VectorSearchResult[] = [];

        for (const vectorEntry of this.vectors) {
            const similarity = calculateCosineSimilarity(
                vector,
                vectorEntry.vector
            );

            // Filter out results with negative similarity (which shouldn't happen with proper vectors)
            if (similarity >= 0) {
                results.push({
                    id: vectorEntry.id,
                    messageId: vectorEntry.messageId,
                    vector: [...vectorEntry.vector], // Return a copy
                    similarity: similarity,
                });
            }
        }

        // Sort by similarity in descending order and limit results
        results.sort((a, b) => b.similarity - a.similarity);
        return results.slice(0, limit);
    }

    /**
     * Close the vector store and clean up event listeners.
     *
     * @returns Promise<void> Resolves when cleanup is complete
     */
    async close(): Promise<void> {
        // Remove session change listener
        this.sessionManager.removeListener(
            'session-changed',
            this.handleSessionChange.bind(this)
        );

        // Clear cached vectors
        this.clearVectors();
    }

    private clearVectors(): void {
        this.vectors = [];
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
            // Clear vectors when switching to a different session
            if (event.type === 'session-switched') {
                this.clearVectors();
                this.currentSessionName = event.activeSession.name;
            }
        } catch {
            // Ignore errors
        }
    }

    private async ensureSessionInitialized(): Promise<void> {
        if (!this.currentSessionName) {
            const activeSession = await this.sessionManager.getActiveSession();
            this.currentSessionName = activeSession.name;
        }
    }

    /**
     * Enforce the maximum cache limit by removing oldest vectors if necessary.
     */
    private enforceMaxCacheLimit(): void {
        if (this.vectors.length > this.maxCachedCount) {
            // Remove oldest vectors to stay within limit
            // Vectors are already sorted chronologically, so remove from beginning
            this.vectors = this.vectors.slice(-this.maxCachedCount);
        }
    }
}
