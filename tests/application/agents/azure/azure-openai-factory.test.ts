import { describe, it, expect, beforeEach } from 'vitest';
import { AzureOpenAIFactory } from '../../../../src/application/agents/azure/azure-openai-factory.js';
import { MockToolbox, createMockAgentConfig } from '../base-agent.mocks.js';

describe('AzureOpenAIFactory', () => {
  let factory: AzureOpenAIFactory;
  let toolbox: MockToolbox;

  beforeEach(() => {
    factory = new AzureOpenAIFactory();
    toolbox = new MockToolbox();
  });

  describe('createAgent', () => {
    it('should create AzureOpenAIAgent instance', () => {
      const config = { ...createMockAgentConfig(), provider: 'azure' };
      const agent = factory.createAgent(config, toolbox);
      
      expect(agent).toBeDefined();
      expect(agent.getProvider()).toBe('azure');
    });
  });

  describe('supportsProvider', () => {
    it('should return true for azure provider', () => {
      expect(factory.supportsProvider('azure')).toBe(true);
    });

    it('should return true for azure-openai provider', () => {
      expect(factory.supportsProvider('azure-openai')).toBe(true);
    });

    it('should return false for other providers', () => {
      expect(factory.supportsProvider('openai')).toBe(false);
      expect(factory.supportsProvider('anthropic')).toBe(false);
      expect(factory.supportsProvider('')).toBe(false);
    });
  });

  describe('getProviderName', () => {
    it('should return azure', () => {
      expect(factory.getProviderName()).toBe('azure');
    });
  });

  describe('getModels', () => {
    it('should return array of Azure OpenAI models', () => {
      const models = factory.getModels();
      
      expect(models).toHaveLength(10);
      expect(models.every(model => model.provider === 'azure')).toBe(true);
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
      
      expect(models1).not.toBe(models2);
      expect(models1).toEqual(models2);
    });
  });

  describe('supportsModel', () => {
    it('should return true for supported model names', () => {
      expect(factory.supportsModel('gpt-5')).toBe(true);
      expect(factory.supportsModel('gpt-5-mini')).toBe(true);
      expect(factory.supportsModel('o3')).toBe(true);
    });

    it('should return true for supported aliases', () => {
      expect(factory.supportsModel('azure-gpt-5')).toBe(true);
      expect(factory.supportsModel('azure-gpt-4.5')).toBe(true);
      expect(factory.supportsModel('azure-o4-mini')).toBe(true);
    });

    it('should return false for unsupported models', () => {
      expect(factory.supportsModel('claude-3')).toBe(false);
      expect(factory.supportsModel('gemini-pro')).toBe(false);
      expect(factory.supportsModel('')).toBe(false);
      expect(factory.supportsModel('unknown-model')).toBe(false);
    });
  });

  describe('getModelByAlias', () => {
    it('should return model definition for valid alias', () => {
      const model = factory.getModelByAlias('azure-gpt-5');
      
      expect(model).toBeDefined();
      expect(model?.provider).toBe('azure');
      expect(model?.model).toBe('gpt-5');
      expect(model?.alias).toBe('azure-gpt-5');
      expect(model?.description).toContain('enterprise security');
    });

    it('should return model definition for different aliases', () => {
      const gpt45Model = factory.getModelByAlias('azure-gpt-4.5');
      expect(gpt45Model?.model).toBe('gpt-4.5');
      
      const o3Model = factory.getModelByAlias('azure-o3');
      expect(o3Model?.model).toBe('o3');
      
      const miniModel = factory.getModelByAlias('azure-gpt-5-mini');
      expect(miniModel?.model).toBe('gpt-5-mini');
    });

    it('should return null for invalid alias', () => {
      expect(factory.getModelByAlias('unknown-alias')).toBeNull();
      expect(factory.getModelByAlias('')).toBeNull();
      expect(factory.getModelByAlias('gpt-3.5-turbo')).toBeNull();
    });
  });
});