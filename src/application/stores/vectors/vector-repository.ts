import { VectorStore } from '../interfaces/vector-store';
import { VectorSearchResult } from '../models/sqlite-message';

/**
 * Repository pattern implementation for vector storage using dual stores.
 *
 * Combines a fast cached store with a persistent store to provide optimal
 * performance while ensuring data durability. The cached store serves as a
 * first-level cache for recent vectors, while the persistent store maintains
 * the complete vector history.
 *
 * Storage Strategy:
 * - All writes go to both stores for consistency
 * - Reads try cached store first, fall back to persistent store
 * - Vector similarity search intelligently combines both stores
 */
export class VectorRepository implements VectorStore {
    private readonly cachedStore: VectorStore;
    private readonly persistentStore: VectorStore;

    /**
     * Creates a new VectorRepository instance.
     *
     * @param cachedStore - Fast in-memory store for recent vectors
     * @param persistentStore - Durable store for complete vector history
     */
    constructor(cachedStore: VectorStore, persistentStore: VectorStore) {
        this.cachedStore = cachedStore;
        this.persistentStore = persistentStore;
    }

    /**
     * Store a vector embedding for a message.
     *
     * Writes to both cached and persistent stores to ensure consistency
     * and availability across both storage layers.
     *
     * @param vector - The vector embedding to store
     * @param messageId - The associated message ID
     * @returns Promise<void> Resolves when the vector is stored in both stores
     */
    async storeVector(vector: number[], messageId: string): Promise<void> {
        // Store in both stores for consistency
        await Promise.all([
            this.cachedStore.storeVector(vector, messageId),
            this.persistentStore.storeVector(vector, messageId),
        ]);
    }

    /**
     * Search for similar vectors with intelligent caching and fallback.
     *
     * Strategy:
     * 1. Get results from both cached and persistent stores in parallel
     * 2. Combine and deduplicate results (cached takes precedence for duplicates)
     * 3. Sort by similarity score and apply limit
     * 4. This ensures we get the best available results from both stores
     *
     * @param vector - The query vector to search with
     * @param limit - Maximum number of results to return (default: 10)
     * @returns Promise<VectorSearchResult[]> Array of similar vectors with similarity scores
     */
    async searchSimilar(
        vector: number[],
        limit: number = 10
    ): Promise<VectorSearchResult[]> {
        // Search both stores in parallel for optimal performance
        const [cachedResults, persistentResults] = await Promise.all([
            this.cachedStore.searchSimilar(vector, limit),
            this.persistentStore.searchSimilar(vector, limit),
        ]);

        // Combine results, with cached results taking precedence for duplicates
        const resultMap = new Map<string, VectorSearchResult>();

        // Add persistent results first
        for (const result of persistentResults) {
            resultMap.set(result.messageId, result);
        }

        // Add cached results, overwriting duplicates (cached takes precedence)
        for (const result of cachedResults) {
            resultMap.set(result.messageId, result);
        }

        // Convert back to array, sort by similarity descending, and apply limit
        const combinedResults = Array.from(resultMap.values());
        combinedResults.sort((a, b) => b.similarity - a.similarity);

        return combinedResults.slice(0, limit);
    }
}
