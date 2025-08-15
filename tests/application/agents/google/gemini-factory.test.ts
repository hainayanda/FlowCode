import { describe, it, expect, beforeEach } from 'vitest';
import { GeminiFactory } from '../../../../src/application/agents/google/gemini-factory.js';
import { MockToolbox, createMockAgentConfig } from '../base-agent.mocks.js';

describe('GeminiFactory', () => {
  let factory: GeminiFactory;
  let toolbox: MockToolbox;

  beforeEach(() => {
    factory = new GeminiFactory();
    toolbox = new MockToolbox();
  });

  describe('createAgent', () => {
    it('should create GeminiAgent instance', () => {
      const config = { ...createMockAgentConfig(), provider: 'google' };
      const agent = factory.createAgent(config, toolbox);
      
      expect(agent).toBeDefined();
      expect(agent.getProvider()).toBe('google');
    });
  });

  describe('supportsProvider', () => {
    it('should return true for google provider', () => {
      expect(factory.supportsProvider('google')).toBe(true);
    });

    it('should return true for gemini provider', () => {
      expect(factory.supportsProvider('gemini')).toBe(true);
    });

    it('should return false for other providers', () => {
      expect(factory.supportsProvider('openai')).toBe(false);
      expect(factory.supportsProvider('anthropic')).toBe(false);
      expect(factory.supportsProvider('')).toBe(false);
    });
  });

  describe('getProviderName', () => {
    it('should return google', () => {
      expect(factory.getProviderName()).toBe('google');
    });
  });

  describe('getModels', () => {
    it('should return array of Google Gemini models', () => {
      const models = factory.getModels();
      
      expect(models).toHaveLength(8);
      expect(models.every(model => model.provider === 'google')).toBe(true);
    });

    it('should include expected models', () => {
      const models = factory.getModels();
      const modelNames = models.map(m => m.model);
      
      expect(modelNames).toContain('gemini-2.5-pro');
      expect(modelNames).toContain('gemini-2.5-flash');
      expect(modelNames).toContain('gemini-2.0-flash');
      expect(modelNames).toContain('gemini-1.5-pro');
      expect(modelNames).toContain('gemini-1.5-flash');
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
      expect(factory.supportsModel('gemini-2.5-pro')).toBe(true);
      expect(factory.supportsModel('gemini-2.5-flash')).toBe(true);
      expect(factory.supportsModel('gemini-2.0-flash')).toBe(true);
    });

    it('should return true for supported aliases', () => {
      expect(factory.supportsModel('gemini-2.5-pro')).toBe(true);
      expect(factory.supportsModel('gemini-2.5-flash-lite')).toBe(true);
      expect(factory.supportsModel('gemini-2.0-pro-exp')).toBe(true);
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
      const model = factory.getModelByAlias('gemini-2.5-pro');
      
      expect(model).toBeDefined();
      expect(model?.provider).toBe('google');
      expect(model?.model).toBe('gemini-2.5-pro');
      expect(model?.alias).toBe('gemini-2.5-pro');
      expect(model?.description).toContain('Most intelligent Gemini model');
    });

    it('should return model definition for different aliases', () => {
      const flashModel = factory.getModelByAlias('gemini-2.5-flash');
      expect(flashModel?.model).toBe('gemini-2.5-flash');
      
      const liteModel = factory.getModelByAlias('gemini-2.5-flash-lite');
      expect(liteModel?.model).toBe('gemini-2.5-flash-lite');
      
      const expModel = factory.getModelByAlias('gemini-2.0-pro-exp');
      expect(expModel?.model).toBe('gemini-2.0-pro-experimental');
    });

    it('should return null for invalid alias', () => {
      expect(factory.getModelByAlias('unknown-alias')).toBeNull();
      expect(factory.getModelByAlias('')).toBeNull();
      expect(factory.getModelByAlias('gpt-4')).toBeNull();
    });
  });
});