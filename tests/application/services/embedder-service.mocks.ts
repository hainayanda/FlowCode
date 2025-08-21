import { EventEmitter } from 'events';
import {
    Embedder,
    EmbedderFactory,
} from '../../../src/application/interfaces/embedder';
import { ConfigReader } from '../../../src/application/interfaces/config-store';
import {
    AgentModelConfig,
    EmbeddingConfig,
    FlowCodeConfig,
    SummarizerConfig,
    TaskmasterConfig,
} from '../../../src/application/models/config';

/**
 * Mock implementation of Embedder for testing
 */
export class MockEmbedder implements Embedder {
    constructor(
        private config: EmbeddingConfig,
        private mockIsAvailable: boolean = true,
        private mockEmbedding: number[] = [0.1, 0.2, 0.3]
    ) {}

    get isAvailable(): boolean {
        return this.mockIsAvailable && this.config.enabled;
    }

    async embed(text: string): Promise<number[]> {
        if (!this.isAvailable) {
            throw new Error('Embedder is not available');
        }
        return [...this.mockEmbedding, text.length / 100]; // Include text length for testing
    }
}

/**
 * Mock implementation of EmbedderFactory for testing
 */
export class MockEmbedderFactory implements EmbedderFactory {
    private createdEmbedders: MockEmbedder[] = [];

    constructor(
        private mockIsAvailable: boolean = true,
        private mockEmbedding: number[] = [0.1, 0.2, 0.3]
    ) {}

    createEmbedder(config: EmbeddingConfig): Embedder {
        const embedder = new MockEmbedder(
            config,
            this.mockIsAvailable,
            this.mockEmbedding
        );
        this.createdEmbedders.push(embedder);
        return embedder;
    }

    getCreatedEmbedders(): MockEmbedder[] {
        return this.createdEmbedders;
    }

    getCreationCount(): number {
        return this.createdEmbedders.length;
    }
}

/**
 * Mock implementation of ConfigReader for testing
 */
export class MockConfigReader extends EventEmitter implements ConfigReader {
    private _config: FlowCodeConfig;
    private _isInitialized = true;

    constructor(embeddingConfig: EmbeddingConfig = { enabled: true }) {
        super();
        this._config = {
            version: '1.0.0',
            embedding: embeddingConfig,
        };
    }

    get config(): FlowCodeConfig {
        return this._config;
    }

    get taskMasterConfig(): TaskmasterConfig | undefined {
        return this._config.taskmaster;
    }

    get summarizerConfig(): SummarizerConfig | undefined {
        return this._config.summarizer;
    }

    get embeddingConfig(): EmbeddingConfig {
        return this._config.embedding;
    }

    get agentConfig(): Record<string, AgentModelConfig> {
        return this._config.agents ?? {};
    }

    get isInitialized(): boolean {
        return this._isInitialized;
    }

    async fetchConfig(): Promise<FlowCodeConfig> {
        return this._config;
    }

    async fetchTaskmasterConfig(): Promise<TaskmasterConfig | undefined> {
        return this.taskMasterConfig;
    }

    async fetchSummarizerConfig(): Promise<SummarizerConfig | undefined> {
        return this.summarizerConfig;
    }

    async fetchEmbeddingConfig(): Promise<EmbeddingConfig> {
        return this.embeddingConfig;
    }

    async fetchAgentConfig(
        name: string
    ): Promise<AgentModelConfig | undefined> {
        return this.getAgentConfig(name);
    }

    getAgentConfig(name: string): AgentModelConfig | undefined {
        return this.agentConfig[name];
    }

    // Helper methods for testing
    updateEmbeddingConfig(config: EmbeddingConfig): void {
        this._config = {
            ...this._config,
            embedding: config,
        };
        this.emit('embedding-config-changed');
    }

    setInitialized(initialized: boolean): void {
        this._isInitialized = initialized;
    }
}
