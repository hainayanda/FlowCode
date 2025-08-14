import { describe, it, expect, beforeEach } from 'vitest';
import { OpenAIEmbeddingFactory } from '../../../../src/application/embedded-agents/openai/openai-embedding-factory.js';
import { EmbeddingAgentConfig } from '../../../../src/application/embedded-agents/base-embedding-agent.js';

describe('OpenAIEmbeddingFactory', () => {
  let factory: OpenAIEmbeddingFactory;

  beforeEach(() => {
    factory = new OpenAIEmbeddingFactory();
  });

  describe('supportsProvider', () => {
    it('should support openai provider', () => {
      expect(factory.supportsProvider('openai')).toBe(true);
    });

    it('should not support other providers', () => {
      expect(factory.supportsProvider('cohere')).toBe(false);
      expect(factory.supportsProvider('voyage')).toBe(false);
      expect(factory.supportsProvider('jina')).toBe(false);
    });
  });

  describe('getProviderName', () => {
    it('should return openai', () => {
      expect(factory.getProviderName()).toBe('openai');
    });
  });

  describe('getModels', () => {
    it('should return all supported models', () => {
      const models = factory.getModels();
      
      expect(models).toHaveLength(2);
      expect(models[0]).toEqual({
        provider: 'openai',
        model: 'text-embedding-3-small',
        alias: 'openai-embed-small',
        description: 'OpenAI text-embedding-3-small (1536 dims, cost-effective)'
      });
      expect(models[1]).toEqual({
        provider: 'openai',
        model: 'text-embedding-ada-002',
        alias: 'openai-embed-ada',
        description: 'OpenAI text-embedding-ada-002 (1536 dims, legacy)'
      });
    });

    it('should return a copy of models array', () => {
      const models1 = factory.getModels();
      const models2 = factory.getModels();
      
      expect(models1).not.toBe(models2);
      expect(models1).toEqual(models2);
    });
  });

  describe('supportsModel', () => {
    it('should support model by name', () => {
      expect(factory.supportsModel('text-embedding-3-small')).toBe(true);
      expect(factory.supportsModel('text-embedding-ada-002')).toBe(true);
    });

    it('should support model by alias', () => {
      expect(factory.supportsModel('openai-embed-small')).toBe(true);
      expect(factory.supportsModel('openai-embed-ada')).toBe(true);
    });

    it('should not support unsupported models', () => {
      expect(factory.supportsModel('text-embedding-3-large')).toBe(false);
      expect(factory.supportsModel('unknown-model')).toBe(false);
    });
  });

  describe('getModelByAlias', () => {
    it('should return model by alias', () => {
      const model = factory.getModelByAlias('openai-embed-small');
      
      expect(model).toEqual({
        provider: 'openai',
        model: 'text-embedding-3-small',
        alias: 'openai-embed-small',
        description: 'OpenAI text-embedding-3-small (1536 dims, cost-effective)'
      });
    });

    it('should return null for unknown alias', () => {
      const model = factory.getModelByAlias('unknown-alias');
      expect(model).toBe(null);
    });
  });

  describe('createEmbeddingAgent', () => {
    const validConfig: EmbeddingAgentConfig = {
      provider: 'openai',
      model: 'text-embedding-3-small',
      enabled: true,
      apiKey: 'test-api-key'
    };

    it('should create agent with valid config', () => {
      const agent = factory.createEmbeddingAgent(validConfig);
      
      expect(agent).toBeDefined();
      expect(agent.getProvider()).toBe('openai');
      expect(agent.getModel()).toBe('text-embedding-3-small');
    });

    it('should create agent with model alias', () => {
      const configWithAlias: EmbeddingAgentConfig = {
        ...validConfig,
        model: 'openai-embed-small'
      };

      const agent = factory.createEmbeddingAgent(configWithAlias);
      
      expect(agent).toBeDefined();
      expect(agent.getProvider()).toBe('openai');
    });

    it('should throw error for unsupported provider', () => {
      const invalidConfig: EmbeddingAgentConfig = {
        ...validConfig,
        provider: 'unsupported'
      };

      expect(() => factory.createEmbeddingAgent(invalidConfig))
        .toThrow("Provider 'unsupported' not supported by OpenAI embedding factory");
    });

    it('should throw error for unsupported model', () => {
      const invalidConfig: EmbeddingAgentConfig = {
        ...validConfig,
        model: 'unsupported-model'
      };

      expect(() => factory.createEmbeddingAgent(invalidConfig))
        .toThrow("Model 'unsupported-model' not supported by OpenAI embedding factory");
    });
  });
});