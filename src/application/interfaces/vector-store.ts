import { VectorSearchResult } from '../models/sqlite-message';

/**
 * Interface for reading vector data and performing similarity searches.
 * Provides methods to query stored vectors based on similarity metrics.
 */
export interface VectorReader {
    /**
     * Searches for vectors similar to the provided vector using cosine similarity or other metrics.
     * Returns results ordered by similarity score (highest first).
     *
     * @param vector - The query vector to find similar vectors for
     * @param limit - Maximum number of results to return (optional, defaults to implementation-specific limit)
     * @returns Promise resolving to array of vector search results with similarity scores
     */
    searchSimilar(
        vector: number[],
        limit?: number
    ): Promise<VectorSearchResult[]>;
}

/**
 * Interface for writing vector data to storage.
 * Handles persistence of vector embeddings with associated message references.
 */
export interface VectorWriter {
    /**
     * Stores a vector embedding associated with a message ID.
     * If a vector for the same message ID already exists, behavior is implementation-specific.
     *
     * @param vector - The embedding vector to store (typically from text embedding models)
     * @param messageId - Unique identifier of the message this vector represents
     * @throws Error if storage operation fails
     */
    storeVector(vector: number[], messageId: string): Promise<void>;
}

/**
 * Combined interface for vector storage operations.
 * Provides both read and write capabilities for vector embeddings.
 * Implementations typically use this for semantic search and similarity matching.
 */
export interface VectorStore extends VectorReader, VectorWriter {}
