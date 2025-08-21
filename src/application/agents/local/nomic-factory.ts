import { Embedder, EmbedderFactory } from '../../interfaces/embedder';
import { EmbeddingConfig } from '../../models/config';
import { NomicEmbedder } from './nomic-embedder';

/**
 * Factory for creating Nomic embedder instances.
 *
 * Provides local embedding capabilities using Nomic's embedding models,
 * allowing for on-device text vectorization without external API calls.
 */
export class NomicFactory implements EmbedderFactory {
    /**
     * Creates a new Nomic embedder instance with the provided configuration.
     *
     * @param config - Configuration for the embedding model including model name and parameters
     * @returns Configured NomicEmbedder ready for local text embedding operations
     */
    createEmbedder(config: EmbeddingConfig): Embedder {
        return new NomicEmbedder(config);
    }
}
