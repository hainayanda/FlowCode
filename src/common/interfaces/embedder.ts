import { EmbeddingConfig } from '../../application/stores/models/config';

/**
 * Interface for text embedding services.
 * Provides functionality to convert text into numerical vector representations for semantic operations.
 */
export interface Embedder {
    /** Whether the embedder is available for use */
    isAvailable: boolean;

    /**
     * Generates an embedding vector from the input text.
     * @param text - The text to embed
     * @returns Promise resolving to the embedding vector
     */
    embed(text: string): Promise<number[]>;
}

/**
 * Factory interface for creating embedding models.
 *
 * Handles creation of embedder instances for vector operations and semantic search.
 */
export interface EmbedderFactory {
    /**
     * Creates a new embedder instance.
     *
     * @param config - Configuration for the embedding model
     * @returns Configured embedder ready for vector operations
     */
    createEmbedder(config: EmbeddingConfig): Embedder;
}
