import { describe, it, expect, beforeEach } from 'vitest';
import { CohereEmbeddingFactory } from '../../../../src/application/embedded-agents/cohere/cohere-embedding-factory.js';
import { EmbeddingAgentConfig } from '../../../../src/application/embedded-agents/base-embedding-agent.js';

describe('CohereEmbeddingFactory', () => {
  let factory: CohereEmbeddingFactory;

  beforeEach(() => {
    factory = new CohereEmbeddingFactory();
  });

  describe('supportsProvider', () => {
    it('should support cohere provider', () => {
      expect(factory.supportsProvider('cohere')).toBe(true);
    });

    it('should not support other providers', () => {
      expect(factory.supportsProvider('openai')).toBe(false);
      expect(factory.supportsProvider('voyage')).toBe(false);
      expect(factory.supportsProvider('jina')).toBe(false);
    });
  });

  describe('getProviderName', () => {
    it('should return cohere', () => {
      expect(factory.getProviderName()).toBe('cohere');
    });
  });

  describe('getModels', () => {
    it('should return all supported models', () => {
      const models = factory.getModels();
      
      expect(models).toHaveLength(2);
      expect(models[0]).toEqual({
        provider: 'cohere',
        model: 'embed-english-light-v3.0',
        alias: 'cohere-embed-en-light',
        description: 'Cohere English Light v3.0 (384 dims, fast & efficient)'
      });
      expect(models[1]).toEqual({
        provider: 'cohere',
        model: 'embed-multilingual-light-v3.0',
        alias: 'cohere-embed-multi-light',
        description: 'Cohere Multilingual Light v3.0 (384 dims, 100+ languages)'
      });
    });
  });

  describe('supportsModel', () => {
    it('should support model by name', () => {
      expect(factory.supportsModel('embed-english-light-v3.0')).toBe(true);
      expect(factory.supportsModel('embed-multilingual-light-v3.0')).toBe(true);
    });

    it('should support model by alias', () => {
      expect(factory.supportsModel('cohere-embed-en-light')).toBe(true);
      expect(factory.supportsModel('cohere-embed-multi-light')).toBe(true);
    });

    it('should not support unsupported models', () => {
      expect(factory.supportsModel('embed-english-v3.0')).toBe(false);
      expect(factory.supportsModel('unknown-model')).toBe(false);
    });
  });

  describe('getModelByAlias', () => {
    it('should return model by alias', () => {
      const model = factory.getModelByAlias('cohere-embed-en-light');
      
      expect(model).toEqual({
        provider: 'cohere',
        model: 'embed-english-light-v3.0',
        alias: 'cohere-embed-en-light',
        description: 'Cohere English Light v3.0 (384 dims, fast & efficient)'
      });
    });

    it('should return null for unknown alias', () => {
      const model = factory.getModelByAlias('unknown-alias');
      expect(model).toBe(null);
    });
  });

  describe('createEmbeddingAgent', () => {
    const validConfig: EmbeddingAgentConfig = {
      provider: 'cohere',
      model: 'embed-english-light-v3.0',
      enabled: true,
      apiKey: 'test-api-key'
    };

    it('should create agent with valid config', () => {
      const agent = factory.createEmbeddingAgent(validConfig);
      
      expect(agent).toBeDefined();
      expect(agent.getProvider()).toBe('cohere');
      expect(agent.getModel()).toBe('embed-english-light-v3.0');
    });

    it('should throw error for unsupported provider', () => {
      const invalidConfig: EmbeddingAgentConfig = {
        ...validConfig,
        provider: 'unsupported'
      };

      expect(() => factory.createEmbeddingAgent(invalidConfig))
        .toThrow("Provider 'unsupported' not supported by Cohere embedding factory");
    });

    it('should throw error for unsupported model', () => {
      const invalidConfig: EmbeddingAgentConfig = {
        ...validConfig,
        model: 'unsupported-model'
      };

      expect(() => factory.createEmbeddingAgent(invalidConfig))
        .toThrow("Model 'unsupported-model' not supported by Cohere embedding factory");
    });
  });
});