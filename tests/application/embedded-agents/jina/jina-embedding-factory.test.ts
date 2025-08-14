import { describe, it, expect, beforeEach } from 'vitest';
import { JinaEmbeddingFactory } from '../../../../src/application/embedded-agents/jina/jina-embedding-factory.js';
import { EmbeddingAgentConfig } from '../../../../src/application/embedded-agents/base-embedding-agent.js';

describe('JinaEmbeddingFactory', () => {
  let factory: JinaEmbeddingFactory;

  beforeEach(() => {
    factory = new JinaEmbeddingFactory();
  });

  describe('supportsProvider', () => {
    it('should support jina provider', () => {
      expect(factory.supportsProvider('jina')).toBe(true);
    });

    it('should not support other providers', () => {
      expect(factory.supportsProvider('openai')).toBe(false);
      expect(factory.supportsProvider('cohere')).toBe(false);
      expect(factory.supportsProvider('voyage')).toBe(false);
    });
  });

  describe('getProviderName', () => {
    it('should return jina', () => {
      expect(factory.getProviderName()).toBe('jina');
    });
  });

  describe('getModels', () => {
    it('should return all supported models', () => {
      const models = factory.getModels();
      
      expect(models).toHaveLength(2);
      expect(models[0]).toEqual({
        provider: 'jina',
        model: 'jina-clip-v2',
        alias: 'jina-clip',
        description: 'Jina CLIP v2 (768 dims, multimodal text/image)'
      });
      expect(models[1]).toEqual({
        provider: 'jina',
        model: 'jina-embeddings-v3',
        alias: 'jina-embed-v3',
        description: 'Jina Embeddings v3 (1024 dims, multilingual)'
      });
    });
  });

  describe('supportsModel', () => {
    it('should support model by name', () => {
      expect(factory.supportsModel('jina-clip-v2')).toBe(true);
      expect(factory.supportsModel('jina-embeddings-v3')).toBe(true);
    });

    it('should support model by alias', () => {
      expect(factory.supportsModel('jina-clip')).toBe(true);
      expect(factory.supportsModel('jina-embed-v3')).toBe(true);
    });

    it('should not support unsupported models', () => {
      expect(factory.supportsModel('jina-embeddings-v2')).toBe(false);
      expect(factory.supportsModel('unknown-model')).toBe(false);
    });
  });

  describe('createEmbeddingAgent', () => {
    const validConfig: EmbeddingAgentConfig = {
      provider: 'jina',
      model: 'jina-clip-v2',
      enabled: true,
      apiKey: 'test-api-key'
    };

    it('should create agent with valid config', () => {
      const agent = factory.createEmbeddingAgent(validConfig);
      
      expect(agent).toBeDefined();
      expect(agent.getProvider()).toBe('jina');
      expect(agent.getModel()).toBe('jina-clip-v2');
    });

    it('should throw error for unsupported provider', () => {
      const invalidConfig: EmbeddingAgentConfig = {
        ...validConfig,
        provider: 'unsupported'
      };

      expect(() => factory.createEmbeddingAgent(invalidConfig))
        .toThrow("Provider 'unsupported' not supported by Jina embedding factory");
    });
  });
});