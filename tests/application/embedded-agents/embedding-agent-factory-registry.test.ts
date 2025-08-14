import { describe, it, expect, beforeEach } from 'vitest';
import { EmbeddingAgentFactoryRegistry } from '../../../src/application/embedded-agents/embedding-agent-factory-registry.js';
import { OpenAIEmbeddingFactory } from '../../../src/application/embedded-agents/openai/openai-embedding-factory.js';
import { CohereEmbeddingFactory } from '../../../src/application/embedded-agents/cohere/cohere-embedding-factory.js';
import { EmbeddingAgentConfig } from '../../../src/application/embedded-agents/base-embedding-agent.js';

describe('EmbeddingAgentFactoryRegistry', () => {
  let registry: EmbeddingAgentFactoryRegistry;
  let openaiFactory: OpenAIEmbeddingFactory;
  let cohereFactory: CohereEmbeddingFactory;

  beforeEach(() => {
    registry = new EmbeddingAgentFactoryRegistry();
    openaiFactory = new OpenAIEmbeddingFactory();
    cohereFactory = new CohereEmbeddingFactory();
  });

  describe('registerFactory', () => {
    it('should register factories successfully', () => {
      registry.registerFactory(openaiFactory);
      registry.registerFactory(cohereFactory);

      expect(registry.supportsProvider('openai')).toBe(true);
      expect(registry.supportsProvider('cohere')).toBe(true);
    });

    it('should override factory when registering same provider', () => {
      const newOpenaiFactory = new OpenAIEmbeddingFactory();
      
      registry.registerFactory(openaiFactory);
      registry.registerFactory(newOpenaiFactory);

      expect(registry.getSupportedProviders()).toEqual(['openai']);
    });
  });

  describe('EmbeddingAgentFactory interface implementation', () => {
    beforeEach(() => {
      registry.registerFactory(openaiFactory);
      registry.registerFactory(cohereFactory);
    });

    describe('createEmbeddingAgent', () => {
      it('should create agent with valid config', () => {
        const config: EmbeddingAgentConfig = {
          provider: 'openai',
          model: 'text-embedding-3-small',
          enabled: true,
          apiKey: 'test-api-key'
        };

        const agent = registry.createEmbeddingAgent(config);

        expect(agent).toBeDefined();
        expect(agent.getProvider()).toBe('openai');
        expect(agent.getModel()).toBe('text-embedding-3-small');
      });

      it('should throw error for unregistered provider', () => {
        const config: EmbeddingAgentConfig = {
          provider: 'unregistered',
          model: 'some-model',
          enabled: true,
          apiKey: 'test-api-key'
        };

        expect(() => registry.createEmbeddingAgent(config))
          .toThrow('No embedding agent factory registered for provider: unregistered');
      });
    });

    describe('supportsProvider', () => {
      it('should return true for registered providers', () => {
        expect(registry.supportsProvider('openai')).toBe(true);
        expect(registry.supportsProvider('cohere')).toBe(true);
      });

      it('should return false for unregistered providers', () => {
        expect(registry.supportsProvider('voyage')).toBe(false);
        expect(registry.supportsProvider('jina')).toBe(false);
      });
    });

    describe('getProviderName', () => {
      it('should return registry provider name', () => {
        expect(registry.getProviderName()).toBe('embedding-registry');
      });
    });

    describe('getModels', () => {
      it('should return all models from all registered factories', () => {
        const models = registry.getModels();

        expect(models.length).toBeGreaterThan(0);
        
        // Should include OpenAI models
        expect(models.some(m => m.provider === 'openai')).toBe(true);
        
        // Should include Cohere models
        expect(models.some(m => m.provider === 'cohere')).toBe(true);
      });

      it('should return empty array when no factories registered', () => {
        const emptyRegistry = new EmbeddingAgentFactoryRegistry();
        const models = emptyRegistry.getModels();

        expect(models).toEqual([]);
      });
    });

    describe('supportsModel', () => {
      it('should support models from registered factories', () => {
        expect(registry.supportsModel('text-embedding-3-small')).toBe(true);
        expect(registry.supportsModel('embed-english-light-v3.0')).toBe(true);
      });

      it('should support model aliases', () => {
        expect(registry.supportsModel('openai-embed-small')).toBe(true);
        expect(registry.supportsModel('cohere-embed-en-light')).toBe(true);
      });

      it('should not support unknown models', () => {
        expect(registry.supportsModel('unknown-model')).toBe(false);
      });
    });

    describe('getModelByAlias', () => {
      it('should return model by alias', () => {
        const model = registry.getModelByAlias('openai-embed-small');

        expect(model).toEqual({
          provider: 'openai',
          model: 'text-embedding-3-small',
          alias: 'openai-embed-small',
          description: 'OpenAI text-embedding-3-small (1536 dims, cost-effective)'
        });
      });

      it('should return null for unknown alias', () => {
        const model = registry.getModelByAlias('unknown-alias');

        expect(model).toBe(null);
      });
    });
  });

  describe('Additional registry methods', () => {
    beforeEach(() => {
      registry.registerFactory(openaiFactory);
      registry.registerFactory(cohereFactory);
    });

    describe('getSupportedProviders', () => {
      it('should return all registered provider names', () => {
        const providers = registry.getSupportedProviders();

        expect(providers).toContain('openai');
        expect(providers).toContain('cohere');
        expect(providers).toHaveLength(2);
      });
    });

    describe('hasProvider', () => {
      it('should return true for registered providers', () => {
        expect(registry.hasProvider('openai')).toBe(true);
        expect(registry.hasProvider('cohere')).toBe(true);
      });

      it('should return false for unregistered providers', () => {
        expect(registry.hasProvider('voyage')).toBe(false);
      });
    });

    describe('getModelsByProvider', () => {
      it('should return models for specific provider', () => {
        const openaiModels = registry.getModelsByProvider('openai');

        expect(openaiModels).toHaveLength(2);
        expect(openaiModels.every(m => m.provider === 'openai')).toBe(true);
      });

      it('should return empty array for unknown provider', () => {
        const models = registry.getModelsByProvider('unknown');

        expect(models).toEqual([]);
      });
    });

    describe('getProviderForModel', () => {
      it('should return provider for model name', () => {
        const provider = registry.getProviderForModel('text-embedding-3-small');

        expect(provider).toBe('openai');
      });

      it('should return provider for model alias', () => {
        const provider = registry.getProviderForModel('cohere-embed-en-light');

        expect(provider).toBe('cohere');
      });

      it('should return null for unknown model', () => {
        const provider = registry.getProviderForModel('unknown-model');

        expect(provider).toBe(null);
      });
    });

    describe('resolveModelName', () => {
      it('should resolve alias to model name', () => {
        const modelName = registry.resolveModelName('openai-embed-small');

        expect(modelName).toBe('text-embedding-3-small');
      });

      it('should return model name if already valid', () => {
        const modelName = registry.resolveModelName('text-embedding-3-small');

        expect(modelName).toBe('text-embedding-3-small');
      });

      it('should return null for unknown alias or model', () => {
        const modelName = registry.resolveModelName('unknown');

        expect(modelName).toBe(null);
      });
    });

    describe('getFactories', () => {
      it('should return all registered factories', () => {
        const factories = registry.getFactories();

        expect(factories).toHaveLength(2);
        expect(factories).toContain(openaiFactory);
        expect(factories).toContain(cohereFactory);
      });
    });
  });
});