import { describe, it, expect, beforeEach } from 'vitest';
import { OpenAIFactory } from '../../../../src/application/agents/openai/openai-factory.js';
import { MockToolbox, createMockAgentConfig } from '../base-agent.mocks.js';

describe('OpenAIFactory', () => {
  let factory: OpenAIFactory;
  let toolbox: MockToolbox;

  beforeEach(() => {
    factory = new OpenAIFactory();
    toolbox = new MockToolbox();
  });

  describe('createAgent', () => {
    it('should create OpenAIAgent instance', () => {
      const config = { ...createMockAgentConfig(), provider: 'openai' };
      const agent = factory.createAgent(config, toolbox);
      
      expect(agent).toBeDefined();
      expect(agent.getProvider()).toBe('openai');
    });
  });

  describe('supportsProvider', () => {
    it('should return true for openai provider', () => {
      expect(factory.supportsProvider('openai')).toBe(true);
    });

    it('should return false for other providers', () => {
      expect(factory.supportsProvider('anthropic')).toBe(false);
      expect(factory.supportsProvider('google')).toBe(false);
      expect(factory.supportsProvider('')).toBe(false);
    });
  });

  describe('getProviderName', () => {
    it('should return openai', () => {
      expect(factory.getProviderName()).toBe('openai');
    });
  });

  describe('getModels', () => {
    it('should return array of OpenAI models', () => {
      const models = factory.getModels();
      
      expect(models).toHaveLength(10);
      expect(models.every(model => model.provider === 'openai')).toBe(true);
    });

    it('should include expected models', () => {
      const models = factory.getModels();
      const modelNames = models.map(m => m.model);
      
      expect(modelNames).toContain('gpt-5');
      expect(modelNames).toContain('gpt-5-mini');
      expect(modelNames).toContain('gpt-4.5');
      expect(modelNames).toContain('o3');
      expect(modelNames).toContain('gpt-4o');
    });

    it('should return a copy of models array', () => {
      const models1 = factory.getModels();
      const models2 = factory.getModels();
      
      expect(models1).not.toBe(models2); // Different array instances
      expect(models1).toEqual(models2); // Same contents
    });
  });

  describe('supportsModel', () => {
    it('should return true for supported model names', () => {
      expect(factory.supportsModel('gpt-5')).toBe(true);
      expect(factory.supportsModel('gpt-4o-mini')).toBe(true);
      expect(factory.supportsModel('o3')).toBe(true);
    });

    it('should return true for supported aliases', () => {
      expect(factory.supportsModel('gpt-5')).toBe(true);
      expect(factory.supportsModel('gpt-4.5')).toBe(true);
      expect(factory.supportsModel('o4-mini')).toBe(true);
    });

    it('should return false for unsupported models', () => {
      expect(factory.supportsModel('gpt-3.5-turbo')).toBe(false);
      expect(factory.supportsModel('claude-3')).toBe(false);
      expect(factory.supportsModel('')).toBe(false);
      expect(factory.supportsModel('unknown-model')).toBe(false);
    });
  });

  describe('getModelByAlias', () => {
    it('should return model definition for valid alias', () => {
      const model = factory.getModelByAlias('gpt-5');
      
      expect(model).toBeDefined();
      expect(model?.provider).toBe('openai');
      expect(model?.model).toBe('gpt-5');
      expect(model?.alias).toBe('gpt-5');
      expect(model?.description).toContain('Latest and smartest OpenAI model');
    });

    it('should return model definition for different aliases', () => {
      const gpt4Model = factory.getModelByAlias('gpt-4.5');
      expect(gpt4Model?.model).toBe('gpt-4.5');
      
      const o3Model = factory.getModelByAlias('o3');
      expect(o3Model?.model).toBe('o3');
      
      const miniModel = factory.getModelByAlias('gpt-5-mini');
      expect(miniModel?.model).toBe('gpt-5-mini');
    });

    it('should return null for invalid alias', () => {
      expect(factory.getModelByAlias('unknown-alias')).toBeNull();
      expect(factory.getModelByAlias('')).toBeNull();
      expect(factory.getModelByAlias('gpt-3.5-turbo')).toBeNull();
    });
  });
});