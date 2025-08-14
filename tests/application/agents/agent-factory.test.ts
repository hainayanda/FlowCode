import { describe, it, expect, beforeEach } from 'vitest';
import { AgentFactoryRegistry } from '../../../src/application/agents/agent-factory.js';
import { MockAgentFactory, createMockModels } from './agent-factory.mocks.js';
import { MockToolbox, createMockAgentConfig } from './base-agent.mocks.js';

describe('AgentFactoryRegistry', () => {
  let registry: AgentFactoryRegistry;
  let openaiFactory: MockAgentFactory;
  let anthropicFactory: MockAgentFactory;
  let toolbox: MockToolbox;

  beforeEach(() => {
    registry = new AgentFactoryRegistry();
    openaiFactory = new MockAgentFactory('openai', createMockModels('openai'));
    anthropicFactory = new MockAgentFactory('anthropic', createMockModels('anthropic'));
    toolbox = new MockToolbox();

    registry.registerFactory(openaiFactory);
    registry.registerFactory(anthropicFactory);
  });

  describe('registerFactory', () => {
    it('should register a factory', () => {
      const newFactory = new MockAgentFactory('google', createMockModels('google'));
      registry.registerFactory(newFactory);
      
      expect(registry.supportsProvider('google')).toBe(true);
    });
  });

  describe('createAgent', () => {
    it('should create agent using the correct factory', () => {
      const config = { ...createMockAgentConfig(), provider: 'openai' };
      const agent = registry.createAgent(config, toolbox);
      
      expect(openaiFactory.createAgentCalled).toBe(true);
      expect(openaiFactory.lastConfig).toEqual(config);
      expect(openaiFactory.lastToolbox).toBe(toolbox);
      expect(agent).toBeDefined();
    });

    it('should throw error for unsupported provider', () => {
      const config = { ...createMockAgentConfig(), provider: 'unsupported' };
      
      expect(() => registry.createAgent(config, toolbox)).toThrow(
        'No agent factory registered for provider: unsupported'
      );
    });
  });

  describe('supportsProvider', () => {
    it('should return true for registered providers', () => {
      expect(registry.supportsProvider('openai')).toBe(true);
      expect(registry.supportsProvider('anthropic')).toBe(true);
    });

    it('should return false for unregistered providers', () => {
      expect(registry.supportsProvider('google')).toBe(false);
      expect(registry.supportsProvider('unknown')).toBe(false);
    });
  });

  describe('getProviderName', () => {
    it('should return agent-registry', () => {
      expect(registry.getProviderName()).toBe('agent-registry');
    });
  });

  describe('getModels', () => {
    it('should return models from all registered factories', () => {
      const models = registry.getModels();
      
      expect(models).toHaveLength(4); // 2 from each factory
      expect(models.some(m => m.provider === 'openai')).toBe(true);
      expect(models.some(m => m.provider === 'anthropic')).toBe(true);
    });
  });

  describe('supportsModel', () => {
    it('should return true for supported models', () => {
      expect(registry.supportsModel('openai-model-1')).toBe(true);
      expect(registry.supportsModel('anthropic-model-2')).toBe(true);
    });

    it('should return true for supported aliases', () => {
      expect(registry.supportsModel('openai-basic')).toBe(true);
      expect(registry.supportsModel('anthropic-advanced')).toBe(true);
    });

    it('should return false for unsupported models', () => {
      expect(registry.supportsModel('unknown-model')).toBe(false);
    });
  });

  describe('getModelByAlias', () => {
    it('should return model definition for valid alias', () => {
      const model = registry.getModelByAlias('openai-basic');
      
      expect(model).toBeDefined();
      expect(model?.provider).toBe('openai');
      expect(model?.alias).toBe('openai-basic');
    });

    it('should return null for invalid alias', () => {
      const model = registry.getModelByAlias('unknown-alias');
      expect(model).toBeNull();
    });
  });

  describe('getSupportedProviders', () => {
    it('should return array of registered provider names', () => {
      const providers = registry.getSupportedProviders();
      
      expect(providers).toContain('openai');
      expect(providers).toContain('anthropic');
      expect(providers).toHaveLength(2);
    });
  });

  describe('hasProvider', () => {
    it('should return true for registered providers', () => {
      expect(registry.hasProvider('openai')).toBe(true);
      expect(registry.hasProvider('anthropic')).toBe(true);
    });

    it('should return false for unregistered providers', () => {
      expect(registry.hasProvider('google')).toBe(false);
    });
  });

  describe('getModelsByProvider', () => {
    it('should return models for specific provider', () => {
      const openaiModels = registry.getModelsByProvider('openai');
      
      expect(openaiModels).toHaveLength(2);
      expect(openaiModels.every(m => m.provider === 'openai')).toBe(true);
    });

    it('should return empty array for unknown provider', () => {
      const unknownModels = registry.getModelsByProvider('unknown');
      expect(unknownModels).toHaveLength(0);
    });
  });

  describe('getProviderForModel', () => {
    it('should return provider for valid model', () => {
      const provider = registry.getProviderForModel('openai-model-1');
      expect(provider).toBe('openai');
    });

    it('should return provider for valid alias', () => {
      const provider = registry.getProviderForModel('anthropic-basic');
      expect(provider).toBe('anthropic');
    });

    it('should return null for unknown model', () => {
      const provider = registry.getProviderForModel('unknown-model');
      expect(provider).toBeNull();
    });
  });

  describe('resolveModelName', () => {
    it('should resolve alias to model name', () => {
      const modelName = registry.resolveModelName('openai-basic');
      expect(modelName).toBe('openai-model-1');
    });

    it('should return same name if already a valid model', () => {
      const modelName = registry.resolveModelName('openai-model-1');
      expect(modelName).toBe('openai-model-1');
    });

    it('should return null for unknown alias or model', () => {
      const modelName = registry.resolveModelName('unknown');
      expect(modelName).toBeNull();
    });
  });
});