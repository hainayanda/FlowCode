import { describe, it, expect, beforeEach } from 'vitest';
import { AgentFactory } from '../../../src/application/agents/agent-factory';
import {
    AgentModelConfig,
    EmbeddingConfig,
} from '../../../src/application/models/config';
import {
    Toolbox,
    ToolDefinition,
    ToolCallParameter,
} from '../../../src/application/interfaces/toolbox';
import {
    AsyncControl,
    AsyncControlResponse,
} from '../../../src/application/models/async-control';
import { Message } from '../../../src/application/models/messages';

// Mock toolbox for testing
class MockToolbox implements Toolbox {
    tools: ToolDefinition[] = [];

    async *callTool(
        _parameter: ToolCallParameter
    ): AsyncGenerator<Message, AsyncControlResponse, AsyncControl> {
        return {
            messages: [],
            completedReason: 'completed' as const,
            usage: {
                inputTokens: 0,
                outputTokens: 0,
                toolsUsed: 0,
            },
        };
    }
}

describe('AgentFactory', () => {
    let factory: AgentFactory;
    let mockToolbox: MockToolbox;

    beforeEach(() => {
        factory = new AgentFactory();
        mockToolbox = new MockToolbox();
    });

    describe('constructor', () => {
        it('should initialize without any dependencies', () => {
            expect(factory).toBeDefined();
            expect(() => new AgentFactory()).not.toThrow();
        });

        it('should have access to all provider models', () => {
            const models = factory.models;
            expect(models).toBeDefined();
            expect(Array.isArray(models)).toBe(true);
            expect(models.length).toBeGreaterThan(0);
        });
    });

    describe('models', () => {
        it('should return aggregated models from all providers', () => {
            const models = factory.models;

            // Should include models from multiple providers
            const providers = new Set(models.map((m) => m.provider));
            expect(providers.size).toBeGreaterThan(1);
            expect(providers).toContain('anthropic');
            expect(providers).toContain('openai');
        });

        it('should have required model properties', () => {
            const models = factory.models;

            models.forEach((model) => {
                expect(model).toHaveProperty('provider');
                expect(model).toHaveProperty('model');
                expect(model).toHaveProperty('alias');
                expect(model).toHaveProperty('description');
                expect(typeof model.provider).toBe('string');
                expect(typeof model.model).toBe('string');
                expect(typeof model.alias).toBe('string');
                expect(typeof model.description).toBe('string');
            });
        });
    });

    describe('createWorker', () => {
        it('should create worker for supported models', () => {
            const models = factory.models;
            expect(models.length).toBeGreaterThan(0);

            const firstModel = models[0];
            const config: AgentModelConfig = {
                model: firstModel.alias,
                provider: firstModel.provider,
                apiKey: 'test-key',
                maxTokens: 1000,
            };

            expect(() =>
                factory.createWorker('test-worker', config)
            ).not.toThrow();
        });

        it('should create different instances on each call', () => {
            const models = factory.models;
            const firstModel = models[0];
            const config: AgentModelConfig = {
                model: firstModel.alias,
                provider: firstModel.provider,
                apiKey: 'test-key',
                maxTokens: 1000,
            };

            const worker1 = factory.createWorker('worker1', config);
            const worker2 = factory.createWorker('worker2', config);

            expect(worker1).toBeDefined();
            expect(worker2).toBeDefined();
            expect(worker1).not.toBe(worker2);
        });

        it('should create worker with toolbox', () => {
            const models = factory.models;
            const firstModel = models[0];
            const config: AgentModelConfig = {
                model: firstModel.alias,
                provider: firstModel.provider,
                apiKey: 'test-key',
                maxTokens: 1000,
            };

            expect(() =>
                factory.createWorker('test-worker', config, mockToolbox)
            ).not.toThrow();
        });

        it('should throw error for unsupported model', () => {
            const config: AgentModelConfig = {
                model: 'non-existent-model',
                provider: 'non-existent-provider',
                apiKey: 'test-key',
                maxTokens: 1000,
            };

            expect(() => factory.createWorker('test-worker', config)).toThrow(
                'No factory found for model non-existent-model'
            );
        });

        it('should create workers for different providers', () => {
            const anthropicModel = factory.models.find(
                (m) => m.provider === 'anthropic'
            );
            const openaiModel = factory.models.find(
                (m) => m.provider === 'openai'
            );

            if (anthropicModel && openaiModel) {
                const anthropicConfig: AgentModelConfig = {
                    model: anthropicModel.alias,
                    provider: anthropicModel.provider,
                    apiKey: 'test-key',
                };
                const openaiConfig: AgentModelConfig = {
                    model: openaiModel.alias,
                    provider: openaiModel.provider,
                    apiKey: 'test-key',
                };

                expect(() =>
                    factory.createWorker('anthropic-worker', anthropicConfig)
                ).not.toThrow();
                expect(() =>
                    factory.createWorker('openai-worker', openaiConfig)
                ).not.toThrow();
            }
        });
    });

    describe('createEmbedder', () => {
        it('should create embedder instance', () => {
            const config: EmbeddingConfig = {
                enabled: true,
            };

            expect(() => factory.createEmbedder(config)).not.toThrow();
        });

        it('should create different embedder instances on each call', () => {
            const config: EmbeddingConfig = {
                enabled: true,
            };

            const embedder1 = factory.createEmbedder(config);
            const embedder2 = factory.createEmbedder(config);

            expect(embedder1).toBeDefined();
            expect(embedder2).toBeDefined();
            expect(embedder1).not.toBe(embedder2);
        });

        it('should create embedder with different configurations', () => {
            const config1: EmbeddingConfig = {
                enabled: true,
            };
            const config2: EmbeddingConfig = {
                enabled: false,
            };

            expect(() => factory.createEmbedder(config1)).not.toThrow();
            expect(() => factory.createEmbedder(config2)).not.toThrow();
        });
    });

    describe('getAvailableModels', () => {
        it('should return array of model aliases', () => {
            const aliases = factory.getAvailableModels();

            expect(Array.isArray(aliases)).toBe(true);
            expect(aliases.length).toBeGreaterThan(0);
            aliases.forEach((alias) => {
                expect(typeof alias).toBe('string');
                expect(alias.length).toBeGreaterThan(0);
            });
        });

        it('should include common model aliases', () => {
            const aliases = factory.getAvailableModels();

            // Should include some expected models (this may vary based on actual implementations)
            expect(aliases.length).toBeGreaterThan(0);
        });
    });

    describe('getModelsByProvider', () => {
        it('should return models for specific provider', () => {
            const anthropicModels = factory.getModelsByProvider('anthropic');

            expect(Array.isArray(anthropicModels)).toBe(true);
            anthropicModels.forEach((model) => {
                expect(model.provider).toBe('anthropic');
            });
        });

        it('should return empty array for non-existent provider', () => {
            const models = factory.getModelsByProvider('non-existent-provider');
            expect(Array.isArray(models)).toBe(true);
            expect(models.length).toBe(0);
        });

        it('should return different results for different providers', () => {
            const anthropicModels = factory.getModelsByProvider('anthropic');
            const openaiModels = factory.getModelsByProvider('openai');

            if (anthropicModels.length > 0 && openaiModels.length > 0) {
                expect(anthropicModels).not.toEqual(openaiModels);
            }
        });
    });

    describe('isModelSupported', () => {
        it('should return true for supported models', () => {
            const models = factory.models;
            expect(models.length).toBeGreaterThan(0);

            const firstModel = models[0];
            expect(factory.isModelSupported(firstModel.alias)).toBe(true);
        });

        it('should return false for unsupported models', () => {
            expect(factory.isModelSupported('non-existent-model')).toBe(false);
        });

        it('should handle empty string', () => {
            expect(factory.isModelSupported('')).toBe(false);
        });
    });

    describe('getAvailableProviders', () => {
        it('should return array of unique provider names', () => {
            const providers = factory.getAvailableProviders();

            expect(Array.isArray(providers)).toBe(true);
            expect(providers.length).toBeGreaterThan(0);

            // Check uniqueness
            const uniqueProviders = new Set(providers);
            expect(uniqueProviders.size).toBe(providers.length);

            providers.forEach((provider) => {
                expect(typeof provider).toBe('string');
                expect(provider.length).toBeGreaterThan(0);
            });
        });

        it('should include expected providers', () => {
            const providers = factory.getAvailableProviders();

            expect(providers).toContain('anthropic');
            expect(providers).toContain('openai');
        });
    });

    describe('integration scenarios', () => {
        it('should handle multiple workers creation', () => {
            const models = factory.models.slice(0, 3); // Test with first 3 models

            models.forEach((model, index) => {
                const config: AgentModelConfig = {
                    model: model.alias,
                    provider: model.provider,
                    apiKey: `test-key-${index}`,
                    maxTokens: 1000 + index * 100,
                };

                expect(() =>
                    factory.createWorker(`worker-${index}`, config)
                ).not.toThrow();
            });
        });

        it('should work with complex configurations', () => {
            const models = factory.models;
            expect(models.length).toBeGreaterThan(0);

            const model = models[0];
            const config: AgentModelConfig = {
                model: model.alias,
                provider: model.provider,
                apiKey: 'complex-test-key',
                maxTokens: 2000,
                baseUrl: 'https://custom-endpoint.com',
            };

            expect(() =>
                factory.createWorker('complex-worker', config, mockToolbox)
            ).not.toThrow();
        });

        it('should maintain independence between instances', () => {
            const models = factory.models;
            const model = models[0];
            const config: AgentModelConfig = {
                model: model.alias,
                provider: model.provider,
                apiKey: 'test-key',
            };

            // Create multiple workers
            const workers = Array.from({ length: 5 }, (_, i) =>
                factory.createWorker(`worker-${i}`, config)
            );

            // All should be defined and unique
            workers.forEach((worker) => expect(worker).toBeDefined());

            // Check uniqueness
            for (let i = 0; i < workers.length; i++) {
                for (let j = i + 1; j < workers.length; j++) {
                    expect(workers[i]).not.toBe(workers[j]);
                }
            }
        });
    });
});
