import { beforeEach, describe, expect, it } from 'vitest';
import { AgentRegistry } from '../../../src/application/agents/agent-registry';
import { AgentFactory } from '../../../src/application/interfaces/agent-factory';
import {
    MockAgentFactory,
    MockEmbedderFactory,
    createMockAgentModel,
    createMockAgentModelConfig,
    createMockEmbeddingConfig,
} from './agent-registry.mocks';
import { MockToolbox } from './toolbox.mocks';

describe('AgentRegistry', () => {
    let agentRegistry: AgentRegistry;
    let mockAgentFactory1: MockAgentFactory;
    let mockAgentFactory2: MockAgentFactory;
    let mockEmbedderFactory: MockEmbedderFactory;
    let agentFactories: AgentFactory[];

    beforeEach(() => {
        const model1 = createMockAgentModel({
            alias: 'model-1',
            provider: 'provider-1',
        });
        const model2 = createMockAgentModel({
            alias: 'model-2',
            provider: 'provider-1',
        });
        const model3 = createMockAgentModel({
            alias: 'model-3',
            provider: 'provider-2',
        });

        mockAgentFactory1 = new MockAgentFactory([model1, model2]);
        mockAgentFactory2 = new MockAgentFactory([model3]);
        mockEmbedderFactory = new MockEmbedderFactory();

        agentFactories = [mockAgentFactory1, mockAgentFactory2];
        agentRegistry = new AgentRegistry(agentFactories, mockEmbedderFactory);
    });

    describe('constructor', () => {
        it('should initialize with provided factories and config reader', () => {
            expect(agentRegistry).toBeDefined();
            expect(agentRegistry.models).toHaveLength(3);
        });
    });

    describe('models getter', () => {
        it('should return all models from all factories', () => {
            const models = agentRegistry.models;
            expect(models).toHaveLength(3);
            expect(models[0].alias).toBe('model-1');
            expect(models[1].alias).toBe('model-2');
            expect(models[2].alias).toBe('model-3');
        });

        it('should return empty array when no factories have models', () => {
            const emptyFactories = [new MockAgentFactory([])];
            const registry = new AgentRegistry(
                emptyFactories,
                mockEmbedderFactory
            );
            expect(registry.models).toEqual([]);
        });
    });

    describe('createWorker', () => {
        it('should create worker with correct factory for matching model', () => {
            const config = createMockAgentModelConfig({ model: 'model-1' });
            const mockToolbox = new MockToolbox();

            const worker = agentRegistry.createWorker(
                'test-worker',
                config,
                mockToolbox
            );

            expect(worker).toBeDefined();
            expect(mockAgentFactory1.getCreatedWorkers()).toHaveLength(1);
            expect(mockAgentFactory2.getCreatedWorkers()).toHaveLength(0);
        });

        it('should create worker with second factory when model matches', () => {
            const config = createMockAgentModelConfig({ model: 'model-3' });
            const mockToolbox = new MockToolbox();

            const worker = agentRegistry.createWorker(
                'test-worker',
                config,
                mockToolbox
            );

            expect(worker).toBeDefined();
            expect(mockAgentFactory1.getCreatedWorkers()).toHaveLength(0);
            expect(mockAgentFactory2.getCreatedWorkers()).toHaveLength(1);
        });
    });

    describe('createEmbedder', () => {
        it('should delegate to embedder factory', () => {
            const config = createMockEmbeddingConfig();

            const embedder = agentRegistry.createEmbedder(config);

            expect(embedder).toBeDefined();
            expect(mockEmbedderFactory.getCreatedEmbedders()).toHaveLength(1);
        });

        it('should pass config to embedder factory', () => {
            const config = createMockEmbeddingConfig({ enabled: false });

            const embedder = agentRegistry.createEmbedder(config);

            expect(embedder).toBeDefined();
            expect(mockEmbedderFactory.getCreatedEmbedders()).toHaveLength(1);
        });
    });

    describe('integration scenarios', () => {
        it('should handle multiple worker creations with different factories', () => {
            const config1 = createMockAgentModelConfig({ model: 'model-1' });
            const config2 = createMockAgentModelConfig({ model: 'model-3' });

            const worker1 = agentRegistry.createWorker('worker-1', config1);
            const worker2 = agentRegistry.createWorker('worker-2', config2);

            expect(worker1).toBeDefined();
            expect(worker2).toBeDefined();
            expect(mockAgentFactory1.getCreatedWorkers()).toHaveLength(1);
            expect(mockAgentFactory2.getCreatedWorkers()).toHaveLength(1);
        });

        it('should handle multiple embedder creations', () => {
            const config1 = createMockEmbeddingConfig();
            const config2 = createMockEmbeddingConfig({ enabled: false });

            const embedder1 = agentRegistry.createEmbedder(config1);
            const embedder2 = agentRegistry.createEmbedder(config2);

            expect(embedder1).toBeDefined();
            expect(embedder2).toBeDefined();
            expect(mockEmbedderFactory.getCreatedEmbedders()).toHaveLength(2);
        });

        it('should work with empty factory list', () => {
            const emptyRegistry = new AgentRegistry([], mockEmbedderFactory);

            expect(emptyRegistry.models).toEqual([]);

            const config = createMockAgentModelConfig({ model: 'any-model' });
            expect(() => {
                emptyRegistry.createWorker('test', config);
            }).toThrow('No factory found for model any-model');
        });
    });
});
