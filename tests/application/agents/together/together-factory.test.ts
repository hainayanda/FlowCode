import { describe, it, expect, beforeEach } from 'vitest';
import { TogetherFactory } from '../../../../src/application/agents/together/together-factory.js';
import { MockToolbox, createMockAgentConfig } from '../base-agent.mocks.js';

describe('TogetherFactory', () => {
  let factory: TogetherFactory;
  let toolbox: MockToolbox;

  beforeEach(() => {
    factory = new TogetherFactory();
    toolbox = new MockToolbox();
  });

  describe('createAgent', () => {
    it('should create TogetherAgent instance', () => {
      const config = { ...createMockAgentConfig(), provider: 'together' };
      const agent = factory.createAgent(config, toolbox);
      
      expect(agent).toBeDefined();
      expect(agent.getProvider()).toBe('together');
    });
  });

  describe('supportsProvider', () => {
    it('should return true for together provider', () => {
      expect(factory.supportsProvider('together')).toBe(true);
    });

    it('should return false for other providers', () => {
      expect(factory.supportsProvider('openai')).toBe(false);
      expect(factory.supportsProvider('anthropic')).toBe(false);
      expect(factory.supportsProvider('')).toBe(false);
    });
  });

  describe('getProviderName', () => {
    it('should return together', () => {
      expect(factory.getProviderName()).toBe('together');
    });
  });

  describe('getModels', () => {
    it('should return array of Together models', () => {
      const models = factory.getModels();
      
      expect(models).toHaveLength(10);
      expect(models.every(model => model.provider === 'together')).toBe(true);
    });

    it('should include expected models', () => {
      const models = factory.getModels();
      const modelNames = models.map(m => m.model);
      
      expect(modelNames).toContain('meta-llama/Meta-Llama-3.3-70B-Instruct');
      expect(modelNames).toContain('meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo');
      expect(modelNames).toContain('deepseek-ai/deepseek-v3');
      expect(modelNames).toContain('Qwen/Qwen2.5-72B-Instruct-Turbo');
      expect(modelNames).toContain('mistralai/Mixtral-8x7B-Instruct-v0.1');
    });

    it('should return a copy of models array', () => {
      const models1 = factory.getModels();
      const models2 = factory.getModels();
      
      expect(models1).not.toBe(models2);
      expect(models1).toEqual(models2);
    });
  });

  describe('supportsModel', () => {
    it('should return true for supported model names', () => {
      expect(factory.supportsModel('meta-llama/Meta-Llama-3.3-70B-Instruct')).toBe(true);
      expect(factory.supportsModel('deepseek-ai/deepseek-v3')).toBe(true);
      expect(factory.supportsModel('Qwen/Qwen2.5-72B-Instruct-Turbo')).toBe(true);
    });

    it('should return true for supported aliases', () => {
      expect(factory.supportsModel('llama-3.3-70b')).toBe(true);
      expect(factory.supportsModel('llama-3.1-405b')).toBe(true);
      expect(factory.supportsModel('deepseek-v3')).toBe(true);
      expect(factory.supportsModel('qwen-2.5-72b')).toBe(true);
      expect(factory.supportsModel('mixtral-8x7b')).toBe(true);
    });

    it('should return false for unsupported models', () => {
      expect(factory.supportsModel('gpt-4')).toBe(false);
      expect(factory.supportsModel('claude-3')).toBe(false);
      expect(factory.supportsModel('')).toBe(false);
      expect(factory.supportsModel('unknown-model')).toBe(false);
    });
  });

  describe('getModelByAlias', () => {
    it('should return model definition for valid alias', () => {
      const model = factory.getModelByAlias('llama-3.3-70b');
      
      expect(model).toBeDefined();
      expect(model?.provider).toBe('together');
      expect(model?.model).toBe('meta-llama/Meta-Llama-3.3-70B-Instruct');
      expect(model?.alias).toBe('llama-3.3-70b');
      expect(model?.description).toContain('multilingual 70B model');
    });

    it('should return model definition for different aliases', () => {
      const deepseekModel = factory.getModelByAlias('deepseek-v3');
      expect(deepseekModel?.model).toBe('deepseek-ai/deepseek-v3');
      
      const qwenModel = factory.getModelByAlias('qwen-2.5-72b');
      expect(qwenModel?.model).toBe('Qwen/Qwen2.5-72B-Instruct-Turbo');
      
      const mixtralModel = factory.getModelByAlias('mixtral-8x7b');
      expect(mixtralModel?.model).toBe('mistralai/Mixtral-8x7B-Instruct-v0.1');
    });

    it('should return null for invalid alias', () => {
      expect(factory.getModelByAlias('unknown-alias')).toBeNull();
      expect(factory.getModelByAlias('')).toBeNull();
      expect(factory.getModelByAlias('gpt-4')).toBeNull();
    });
  });
});