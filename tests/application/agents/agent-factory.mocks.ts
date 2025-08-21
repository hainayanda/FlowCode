import { AgentWorker } from '../../../src/application/interfaces/agent';
import { AgentWorkerFactory } from '../../../src/application/interfaces/agent-worker-factory';
import {
    Embedder,
    EmbedderFactory,
} from '../../../src/application/interfaces/embedder';
import { Toolbox } from '../../../src/application/interfaces/toolbox';
import { AgentModel } from '../../../src/application/models/agent-model';
import {
    AgentModelConfig,
    EmbeddingConfig,
} from '../../../src/application/models/config';
import { TestWorker } from './test-worker.mocks';

export class MockAgentWorkerFactory implements AgentWorkerFactory {
    public models: AgentModel[];
    private createdWorkers: AgentWorker[] = [];

    constructor(models: AgentModel[]) {
        this.models = models;
    }

    createWorker(
        name: string,
        config: AgentModelConfig,
        toolbox?: Toolbox
    ): AgentWorker {
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
    private createdEmbedders: Embedder[] = [];

    createEmbedder(config: EmbeddingConfig): Embedder {
        const embedder = new MockEmbedder();
        this.createdEmbedders.push(embedder);
        return embedder;
    }

    getCreatedEmbedders(): Embedder[] {
        return this.createdEmbedders;
    }

    clearCreatedEmbedders(): void {
        this.createdEmbedders = [];
    }
}

export class MockEmbedder implements Embedder {
    isAvailable: boolean = true;
    async embed(text: string): Promise<number[]> {
        return [0.1, 0.2, 0.3, 0.4, 0.5];
    }
}

export function createMockAgentModel(
    overrides: Partial<AgentModel> = {}
): AgentModel {
    return {
        provider: 'test-provider',
        model: 'test-model',
        alias: 'test-alias',
        description: 'Test model description',
        ...overrides,
    };
}

export function createMockAgentModelConfig(
    overrides: Partial<AgentModelConfig> = {}
): AgentModelConfig {
    return {
        model: 'test-model',
        provider: 'test-provider',
        apiKey: 'test-key',
        maxTokens: 4096,
        ...overrides,
    };
}

export function createMockEmbeddingConfig(
    overrides: Partial<EmbeddingConfig> = {}
): EmbeddingConfig {
    return {
        enabled: true,
        ...overrides,
    };
}
