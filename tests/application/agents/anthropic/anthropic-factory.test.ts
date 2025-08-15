import { describe, it, expect, beforeEach } from 'vitest';
import { AnthropicFactory } from '../../../../src/application/agents/anthropic/anthropic-factory.js';
import { MockToolbox, createMockAgentConfig } from '../base-agent.mocks.js';

describe('AnthropicFactory', () => {
  let factory: AnthropicFactory;
  let toolbox: MockToolbox;

  beforeEach(() => {
    factory = new AnthropicFactory();
    toolbox = new MockToolbox();
  });

  describe('createAgent', () => {
    it('should create AnthropicAgent instance', () => {
      const config = { ...createMockAgentConfig(), provider: 'anthropic' };
      const agent = factory.createAgent(config, toolbox);
      
      expect(agent).toBeDefined();
      expect(agent.getProvider()).toBe('anthropic');
    });
  });

  describe('supportsProvider', () => {
    it('should return true for anthropic provider', () => {
      expect(factory.supportsProvider('anthropic')).toBe(true);
    });

    it('should return false for other providers', () => {
      expect(factory.supportsProvider('openai')).toBe(false);
      expect(factory.supportsProvider('google')).toBe(false);
      expect(factory.supportsProvider('')).toBe(false);
    });
  });

  describe('getProviderName', () => {
    it('should return anthropic', () => {
      expect(factory.getProviderName()).toBe('anthropic');
    });
  });

  describe('getModels', () => {
    it('should return array of Anthropic models', () => {
      const models = factory.getModels();
      
      expect(models).toHaveLength(8);
      expect(models.every(model => model.provider === 'anthropic')).toBe(true);
    });

    it('should include expected models', () => {
      const models = factory.getModels();
      const modelNames = models.map(m => m.model);
      
      expect(modelNames).toContain('claude-opus-4.1');
      expect(modelNames).toContain('claude-sonnet-4');
      expect(modelNames).toContain('claude-3.7-sonnet');
      expect(modelNames).toContain('claude-3-5-sonnet-20241022');
      expect(modelNames).toContain('claude-3-5-haiku-20241022');
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
      expect(factory.supportsModel('claude-opus-4.1')).toBe(true);
      expect(factory.supportsModel('claude-sonnet-4')).toBe(true);
      expect(factory.supportsModel('claude-3.7-sonnet')).toBe(true);
    });

    it('should return true for supported aliases', () => {
      expect(factory.supportsModel('opus-4.1')).toBe(true);
      expect(factory.supportsModel('sonnet-4')).toBe(true);
      expect(factory.supportsModel('sonnet-3.7')).toBe(true);
      expect(factory.supportsModel('haiku-3.5')).toBe(true);
    });

    it('should return false for unsupported models', () => {
      expect(factory.supportsModel('gpt-4')).toBe(false);
      expect(factory.supportsModel('gemini-pro')).toBe(false);
      expect(factory.supportsModel('')).toBe(false);
      expect(factory.supportsModel('unknown-model')).toBe(false);
    });
  });

  describe('getModelByAlias', () => {
    it('should return model definition for valid alias', () => {
      const model = factory.getModelByAlias('opus-4.1');
      
      expect(model).toBeDefined();
      expect(model?.provider).toBe('anthropic');
      expect(model?.model).toBe('claude-opus-4.1');
      expect(model?.alias).toBe('opus-4.1');
      expect(model?.description).toContain('Most capable Claude model');
    });

    it('should return model definition for different aliases', () => {
      const sonnet4Model = factory.getModelByAlias('sonnet-4');
      expect(sonnet4Model?.model).toBe('claude-sonnet-4');
      
      const haiku35Model = factory.getModelByAlias('haiku-3.5');
      expect(haiku35Model?.model).toBe('claude-3-5-haiku-20241022');
      
      const sonnet35Model = factory.getModelByAlias('sonnet-3.5');
      expect(sonnet35Model?.model).toBe('claude-3-5-sonnet-20241022');
    });

    it('should return null for invalid alias', () => {
      expect(factory.getModelByAlias('unknown-alias')).toBeNull();
      expect(factory.getModelByAlias('')).toBeNull();
      expect(factory.getModelByAlias('gpt-4')).toBeNull();
    });
  });
});