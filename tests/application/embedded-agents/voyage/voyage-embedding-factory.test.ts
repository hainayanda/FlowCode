import { describe, it, expect, beforeEach } from 'vitest';
import { VoyageEmbeddingFactory } from '../../../../src/application/embedded-agents/voyage/voyage-embedding-factory.js';
import { EmbeddingAgentConfig } from '../../../../src/application/embedded-agents/base-embedding-agent.js';

describe('VoyageEmbeddingFactory', () => {
  let factory: VoyageEmbeddingFactory;

  beforeEach(() => {
    factory = new VoyageEmbeddingFactory();
  });

  describe('supportsProvider', () => {
    it('should support voyage provider', () => {
      expect(factory.supportsProvider('voyage')).toBe(true);
    });

    it('should not support other providers', () => {
      expect(factory.supportsProvider('openai')).toBe(false);
      expect(factory.supportsProvider('cohere')).toBe(false);
      expect(factory.supportsProvider('jina')).toBe(false);
    });
  });

  describe('getProviderName', () => {
    it('should return voyage', () => {
      expect(factory.getProviderName()).toBe('voyage');
    });
  });

  describe('getModels', () => {
    it('should return all supported models', () => {
      const models = factory.getModels();
      
      expect(models).toHaveLength(2);
      expect(models[0]).toEqual({
        provider: 'voyage',
        model: 'voyage-3-lite',
        alias: 'voyage-lite',
        description: 'Voyage 3 Lite (512 dims, optimized for retrieval)'
      });
      expect(models[1]).toEqual({
        provider: 'voyage',
        model: 'voyage-lite-02-instruct',
        alias: 'voyage-lite-instruct',
        description: 'Voyage Lite 02 Instruct (1024 dims, instruction-tuned)'
      });
    });
  });

  describe('supportsModel', () => {
    it('should support model by name', () => {
      expect(factory.supportsModel('voyage-3-lite')).toBe(true);
      expect(factory.supportsModel('voyage-lite-02-instruct')).toBe(true);
    });

    it('should support model by alias', () => {
      expect(factory.supportsModel('voyage-lite')).toBe(true);
      expect(factory.supportsModel('voyage-lite-instruct')).toBe(true);
    });

    it('should not support unsupported models', () => {
      expect(factory.supportsModel('voyage-3')).toBe(false);
      expect(factory.supportsModel('unknown-model')).toBe(false);
    });
  });

  describe('createEmbeddingAgent', () => {
    const validConfig: EmbeddingAgentConfig = {
      provider: 'voyage',
      model: 'voyage-3-lite',
      enabled: true,
      apiKey: 'test-api-key'
    };

    it('should create agent with valid config', () => {
      const agent = factory.createEmbeddingAgent(validConfig);
      
      expect(agent).toBeDefined();
      expect(agent.getProvider()).toBe('voyage');
      expect(agent.getModel()).toBe('voyage-3-lite');
    });

    it('should throw error for unsupported provider', () => {
      const invalidConfig: EmbeddingAgentConfig = {
        ...validConfig,
        provider: 'unsupported'
      };

      expect(() => factory.createEmbeddingAgent(invalidConfig))
        .toThrow("Provider 'unsupported' not supported by Voyage embedding factory");
    });
  });
});