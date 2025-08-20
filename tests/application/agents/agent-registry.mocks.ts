import { AgentFactory, EmbedderFactory } from "../../../src/application/interfaces/agent-factory";
import { AgentEmbedder, AgentSummarizer, AgentWorker } from "../../../src/application/interfaces/agents";
import { ConfigReader } from "../../../src/application/interfaces/config-store";
import { Toolbox } from "../../../src/application/interfaces/toolbox";
import { AgentModel } from "../../../src/application/models/agent-model";
import { AgentModelConfig, EmbeddingConfig, FlowCodeConfig, SummarizerConfig, TaskmasterConfig } from "../../../src/application/models/config";
import { MockToolbox } from "./toolbox.mocks";
import { TestWorker } from "./test-worker.mocks";

export class MockAgentFactory implements AgentFactory {
    public models: AgentModel[];
    private createdWorkers: AgentWorker[] = [];

    constructor(models: AgentModel[]) {
        this.models = models;
    }

    createWorker(name: string, config: AgentModelConfig, summarizer?: AgentSummarizer, toolbox?: Toolbox): AgentWorker {
        const worker = new TestWorker(name, config, toolbox);
        this.createdWorkers.push(worker);
        return worker;
    }

    getCreatedWorkers(): AgentWorker[] {
        return this.createdWorkers;
    }

    clearCreatedWorkers(): void {
        this.createdWorkers = [];
    }
}

export class MockEmbedderFactory implements EmbedderFactory {
    private createdEmbedders: AgentEmbedder[] = [];

    createEmbedder(config: EmbeddingConfig): AgentEmbedder {
        const embedder = new MockAgentEmbedder();
        this.createdEmbedders.push(embedder);
        return embedder;
    }

    getCreatedEmbedders(): AgentEmbedder[] {
        return this.createdEmbedders;
    }

    clearCreatedEmbedders(): void {
        this.createdEmbedders = [];
    }
}

export class MockAgentEmbedder implements AgentEmbedder {
    async embed(text: string): Promise<number[]> {
        return [0.1, 0.2, 0.3, 0.4, 0.5];
    }
}

export class MockConfigReader implements ConfigReader {
    public config: FlowCodeConfig;
    public taskMasterConfig: TaskmasterConfig;
    public summarizerConfig: SummarizerConfig;
    public embeddingConfig: EmbeddingConfig;

    constructor(
        config?: Partial<FlowCodeConfig>,
        taskMasterConfig?: Partial<TaskmasterConfig>,
        summarizerConfig?: Partial<SummarizerConfig>,
        embeddingConfig?: Partial<EmbeddingConfig>
    ) {
        this.taskMasterConfig = {
            model: 'test-taskmaster-model',
            provider: 'test-provider',
            maxContext: 100,
            minContext: 5,
            ...taskMasterConfig
        };

        this.summarizerConfig = {
            model: 'test-summarizer-model',
            provider: 'test-provider',
            apiKey: 'test-key',
            enabled: true,
            maxTokens: 4096,
            ...summarizerConfig
        };

        this.embeddingConfig = {
            enabled: true,
            ...embeddingConfig
        };

        this.config = {
            version: '1.0.0',
            taskmaster: this.taskMasterConfig,
            summarizer: this.summarizerConfig,
            embedding: this.embeddingConfig,
            ...config
        };
    }

    async fetchConfig(): Promise<FlowCodeConfig> {
        return this.config;
    }

    setSummarizerEnabled(enabled: boolean): void {
        this.summarizerConfig.enabled = enabled;
    }

    setSummarizerModel(model: string): void {
        this.summarizerConfig.model = model;
    }
}

export function createMockAgentModel(overrides: Partial<AgentModel> = {}): AgentModel {
    return {
        provider: 'test-provider',
        model: 'test-model',
        alias: 'test-alias',
        description: 'Test model description',
        ...overrides
    };
}

export function createMockAgentModelConfig(overrides: Partial<AgentModelConfig> = {}): AgentModelConfig {
    return {
        model: 'test-model',
        provider: 'test-provider',
        apiKey: 'test-key',
        maxTokens: 4096,
        ...overrides
    };
}

export function createMockEmbeddingConfig(overrides: Partial<EmbeddingConfig> = {}): EmbeddingConfig {
    return {
        enabled: true,
        ...overrides
    };
}