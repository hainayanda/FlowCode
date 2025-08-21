import { Embedder, EmbedderFactory } from '../interfaces/embedder';
import { ConfigReader } from '../interfaces/config-store';

/**
 * Service for handling text embeddings through dependency injection.
 * Uses an EmbedderFactory to create and manage embedder instances.
 * Automatically updates embedder when configuration changes.
 */
export class EmbedderService implements Embedder {
    private embedder: Embedder;

    /**
     * Creates a new EmbedderService instance.
     * @param factory - Factory for creating embedder instances
     * @param configStore - Configuration store to get embedding config
     */
    constructor(
        private readonly factory: EmbedderFactory,
        private readonly configStore: ConfigReader
    ) {
        this.embedder = this.factory.createEmbedder(
            this.configStore.embeddingConfig
        );
        this.setupConfigListener();
    }

    /**
     * Sets up listener for embedding configuration changes.
     * Recreates the embedder when the embedding config is updated.
     */
    private setupConfigListener(): void {
        this.configStore.on('embedding-config-changed', () => {
            this.embedder = this.factory.createEmbedder(
                this.configStore.embeddingConfig
            );
        });
    }

    /**
     * Whether the embedder is available for use.
     */
    get isAvailable(): boolean {
        return this.embedder.isAvailable;
    }

    /**
     * Generates an embedding vector from the input text.
     * @param text - The text to embed
     * @returns Promise resolving to the embedding vector
     */
    async embed(text: string): Promise<number[]> {
        return this.embedder.embed(text);
    }
}
