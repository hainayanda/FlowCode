import { AgentEmbedder } from "../../interfaces/agents";
import { EmbeddingConfig } from "../../models/config";
import { pipeline, FeatureExtractionPipeline } from '@xenova/transformers';

export class NomicEmbedder implements AgentEmbedder {
    private config: EmbeddingConfig;
    private embeddingPipeline: FeatureExtractionPipeline | null = null;

    get isAvailable(): boolean {
        return this.config.enabled;
    }

    constructor(config: EmbeddingConfig) {
        this.config = config;
    }

    async embed(text: string): Promise<number[]> {
        if (!this.isAvailable) {
            throw new Error("Embedder is not available");
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
        this.embeddingPipeline = await pipeline('feature-extraction', 'nomic-embed-text-v1.5', {
            quantized: true, // Use quantized model for better performance
        });
        return this.embeddingPipeline;
    }
}