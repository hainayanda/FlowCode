import { FeatureExtractionPipeline, pipeline } from '@xenova/transformers';
import { AgentEmbedder } from '../../interfaces/agent';
import { EmbeddingConfig } from '../../models/config';

/**
 * Local embedder implementation using Nomic's text embedding model.
 * Runs completely offline using the @xenova/transformers library for browser/Node.js compatibility.
 */
export class NomicEmbedder implements AgentEmbedder {
    private config: EmbeddingConfig;
    private embeddingPipeline: FeatureExtractionPipeline | null = null;

    /**
     * Creates a new NomicEmbedder instance.
     * @param config - Configuration controlling whether embedding is enabled
     */
    constructor(config: EmbeddingConfig) {
        this.config = config;
    }

    /**
     * Whether the embedder is available for use based on configuration.
     */
    get isAvailable(): boolean {
        return this.config.enabled;
    }

    /**
     * Generates an embedding vector from the input text using Nomic's model.
     * Uses local processing with quantized model for better performance.
     *
     * @param text - The text to embed
     * @returns Promise resolving to the embedding vector as a number array
     * @throws Error if embedder is not available or processing fails
     */
    async embed(text: string): Promise<number[]> {
        if (!this.isAvailable) {
            throw new Error('Embedder is not available');
        }

        const pipeline = await this.initialize();

        const result = await pipeline(text, {
            pooling: 'mean',
            normalize: true,
        });
        if (result && typeof result === 'object' && 'data' in result) {
            return Array.from(result.data as Float32Array);
        } else if (Array.isArray(result)) {
            return result[0] || [];
        } else {
            throw new Error('Unexpected embedding result format');
        }
    }

    private async initialize(): Promise<FeatureExtractionPipeline> {
        if (this.embeddingPipeline) {
            return this.embeddingPipeline;
        }
        this.embeddingPipeline = await pipeline(
            'feature-extraction',
            'nomic-embed-text-v1.5',
            {
                quantized: true, // Use quantized model for better performance
            }
        );
        return this.embeddingPipeline;
    }
}
