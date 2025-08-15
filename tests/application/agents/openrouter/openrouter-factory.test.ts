import { describe, it, expect, beforeEach } from 'vitest';
import { OpenRouterFactory } from '../../../../src/application/agents/openrouter/openrouter-factory.js';
import { MockToolbox, createMockAgentConfig } from '../base-agent.mocks.js';

describe('OpenRouterFactory', () => {
  let factory: OpenRouterFactory;
  let toolbox: MockToolbox;

  beforeEach(() => {
    factory = new OpenRouterFactory();
    toolbox = new MockToolbox();
  });

  describe('createAgent', () => {
    it('should create OpenRouterAgent instance', () => {
      const config = { ...createMockAgentConfig(), provider: 'openrouter' };
      const agent = factory.createAgent(config, toolbox);
      
      expect(agent).toBeDefined();
      expect(agent.getProvider()).toBe('openrouter');
    });
  });

  describe('supportsProvider', () => {
    it('should return true for openrouter provider', () => {
      expect(factory.supportsProvider('openrouter')).toBe(true);
    });

    it('should return false for other providers', () => {
      expect(factory.supportsProvider('openai')).toBe(false);
      expect(factory.supportsProvider('anthropic')).toBe(false);
      expect(factory.supportsProvider('')).toBe(false);
    });
  });

  describe('getProviderName', () => {
    it('should return openrouter', () => {
      expect(factory.getProviderName()).toBe('openrouter');
    });
  });

  describe('getModels', () => {
    it('should return array of OpenRouter models', () => {
      const models = factory.getModels();
      
      expect(models).toHaveLength(15);
      expect(models.every(model => model.provider === 'openrouter')).toBe(true);
    });

    it('should include expected models', () => {
      const models = factory.getModels();
      const modelNames = models.map(m => m.model);
      
      expect(modelNames).toContain('openai/gpt-5');
      expect(modelNames).toContain('anthropic/claude-opus-4.1');
      expect(modelNames).toContain('google/gemini-2.5-pro-experimental');
      expect(modelNames).toContain('meta-llama/llama-3.3-70b-instruct');
      expect(modelNames).toContain('deepseek/deepseek-v3');
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
      expect(factory.supportsModel('openai/gpt-5')).toBe(true);
      expect(factory.supportsModel('anthropic/claude-opus-4.1')).toBe(true);
      expect(factory.supportsModel('google/gemini-2.5-pro-experimental')).toBe(true);
    });

    it('should return true for supported aliases', () => {
      expect(factory.supportsModel('or-gpt-5')).toBe(true);
      expect(factory.supportsModel('or-claude-opus-4.1')).toBe(true);
      expect(factory.supportsModel('or-gemini-2.5-pro')).toBe(true);
      expect(factory.supportsModel('or-llama-3.3-70b')).toBe(true);
      expect(factory.supportsModel('or-deepseek-v3')).toBe(true);
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
      const model = factory.getModelByAlias('or-gpt-5');
      
      expect(model).toBeDefined();
      expect(model?.provider).toBe('openrouter');
      expect(model?.model).toBe('openai/gpt-5');
      expect(model?.alias).toBe('or-gpt-5');
      expect(model?.description).toContain('OpenRouter gateway');
    });

    it('should return model definition for different aliases', () => {
      const claudeModel = factory.getModelByAlias('or-claude-opus-4.1');
      expect(claudeModel?.model).toBe('anthropic/claude-opus-4.1');
      
      const geminiModel = factory.getModelByAlias('or-gemini-2.5-pro');
      expect(geminiModel?.model).toBe('google/gemini-2.5-pro-experimental');
      
      const llamaModel = factory.getModelByAlias('or-llama-3.3-70b');
      expect(llamaModel?.model).toBe('meta-llama/llama-3.3-70b-instruct');
    });

    it('should return null for invalid alias', () => {
      expect(factory.getModelByAlias('unknown-alias')).toBeNull();
      expect(factory.getModelByAlias('')).toBeNull();
      expect(factory.getModelByAlias('gpt-4')).toBeNull();
    });
  });
});