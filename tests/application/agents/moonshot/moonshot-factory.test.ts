import { describe, it, expect, beforeEach } from 'vitest';
import { MoonshotFactory } from '../../../../src/application/agents/moonshot/moonshot-factory.js';
import { MockToolbox, createMockAgentConfig } from '../base-agent.mocks.js';

describe('MoonshotFactory', () => {
  let factory: MoonshotFactory;
  let toolbox: MockToolbox;

  beforeEach(() => {
    factory = new MoonshotFactory();
    toolbox = new MockToolbox();
  });

  describe('createAgent', () => {
    it('should create MoonshotAgent instance', () => {
      const config = { ...createMockAgentConfig(), provider: 'moonshot' };
      const agent = factory.createAgent(config, toolbox);
      
      expect(agent).toBeDefined();
      expect(agent.getProvider()).toBe('moonshot');
    });
  });

  describe('supportsProvider', () => {
    it('should return true for moonshot provider', () => {
      expect(factory.supportsProvider('moonshot')).toBe(true);
    });

    it('should return false for other providers', () => {
      expect(factory.supportsProvider('openai')).toBe(false);
      expect(factory.supportsProvider('anthropic')).toBe(false);
      expect(factory.supportsProvider('')).toBe(false);
    });
  });

  describe('getProviderName', () => {
    it('should return moonshot', () => {
      expect(factory.getProviderName()).toBe('moonshot');
    });
  });

  describe('getModels', () => {
    it('should return array of Moonshot models', () => {
      const models = factory.getModels();
      
      expect(models).toHaveLength(3);
      expect(models.every(model => model.provider === 'moonshot')).toBe(true);
    });

    it('should include expected models', () => {
      const models = factory.getModels();
      const modelNames = models.map(m => m.model);
      
      expect(modelNames).toContain('moonshot-v1-8k');
      expect(modelNames).toContain('moonshot-v1-32k');
      expect(modelNames).toContain('moonshot-v1-128k');
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
      expect(factory.supportsModel('moonshot-v1-8k')).toBe(true);
      expect(factory.supportsModel('moonshot-v1-32k')).toBe(true);
      expect(factory.supportsModel('moonshot-v1-128k')).toBe(true);
    });

    it('should return true for supported aliases', () => {
      expect(factory.supportsModel('moonshot-8k')).toBe(true);
      expect(factory.supportsModel('moonshot-32k')).toBe(true);
      expect(factory.supportsModel('moonshot-128k')).toBe(true);
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
      const model = factory.getModelByAlias('moonshot-8k');
      
      expect(model).toBeDefined();
      expect(model?.provider).toBe('moonshot');
      expect(model?.model).toBe('moonshot-v1-8k');
      expect(model?.alias).toBe('moonshot-8k');
      expect(model?.description).toContain('8K context window');
    });

    it('should return model definition for different aliases', () => {
      const model32k = factory.getModelByAlias('moonshot-32k');
      expect(model32k?.model).toBe('moonshot-v1-32k');
      expect(model32k?.description).toContain('32K context window');
      
      const model128k = factory.getModelByAlias('moonshot-128k');
      expect(model128k?.model).toBe('moonshot-v1-128k');
      expect(model128k?.description).toContain('128K context window');
    });

    it('should return null for invalid alias', () => {
      expect(factory.getModelByAlias('unknown-alias')).toBeNull();
      expect(factory.getModelByAlias('')).toBeNull();
      expect(factory.getModelByAlias('gpt-4')).toBeNull();
    });
  });
});