import { describe, it, expect, beforeEach } from 'vitest';
import { TaskmasterModelInitializerStage } from '../../../src/application/commands/initializer/initializer-stages/taskmaster-model-initializer-stage.js';
import { InitializerStageType } from '../../../src/application/interfaces/initializer-stage.js';
import { MockAgentFactory, createMockModels } from '../agents/agent-factory.mocks.js';
import { MockCredentialStore } from '../services/credential-service.mocks.js';

describe('TaskmasterModelInitializerStage', () => {
  let stage: TaskmasterModelInitializerStage;
  let agentFactory: MockAgentFactory;
  let credentialReader: MockCredentialStore;

  beforeEach(() => {
    agentFactory = new MockAgentFactory('test', createMockModels('test'));
    credentialReader = new MockCredentialStore();
    
    stage = new TaskmasterModelInitializerStage(agentFactory, credentialReader);
  });

  describe('properties', () => {
    it('should have correct stage properties', () => {
      expect(stage.stageType).toBe(InitializerStageType.TaskmasterModel);
      expect(stage.name).toBe('Taskmaster Model Selection');
      expect(stage.description).toBe('Select the AI model for the taskmaster agent');
    });

    it('should provide observables', () => {
      expect(stage.messages$).toBeDefined();
      expect(stage.options$).toBeDefined();
    });
  });

  describe('start', () => {
    it('should start successfully and show model selection', () => {
      const context = {
        rootDirectory: '/test',
        flowcodeDirectory: '/test/.flowcode',
        collectedData: new Map()
      };

      const result = stage.start(context);
      
      expect(result.isSuccess).toBe(true);
      // Models are fetched during showModelSelection
    });

    it('should emit initial message and options', async () => {
      const context = {
        rootDirectory: '/test',
        flowcodeDirectory: '/test/.flowcode',
        collectedData: new Map()
      };

      const messages: any[] = [];
      const options: any[] = [];

      stage.messages$.subscribe(msg => messages.push(msg));
      stage.options$.subscribe(opt => options.push(opt));

      stage.start(context);

      // Wait for async operations to complete
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(messages.some(msg => msg.content.includes('Select a model'))).toBe(true);
      expect(options.some(opt => opt.choices.length > 0)).toBe(true);
    });
  });

  describe('processOptionSelection', () => {
    beforeEach(() => {
      const context = {
        rootDirectory: '/test',
        flowcodeDirectory: '/test/.flowcode',
        collectedData: new Map()
      };
      stage.start(context);
    });

    it('should handle valid model selection', () => {
      const result = stage.processOptionSelection(0);
      
      expect(result.isSuccess).toBe(true);
    });

    it('should fail for invalid option index', () => {
      const result = stage.processOptionSelection(999);
      
      expect(result.isSuccess).toBe(false);
      expect(result.error).toBe('Invalid model selection.');
    });

    it('should collect selected model data', () => {
      stage.processOptionSelection(0);
      
      const collectedData = stage.getCollectedData();
      expect(collectedData.model).toBeDefined();
      expect(collectedData.provider).toBeDefined();
    });
  });

  describe('processResponse', () => {
    it('should handle API key input when in api-key step', async () => {
      const context = {
        rootDirectory: '/test',
        flowcodeDirectory: '/test/.flowcode',
        collectedData: new Map()
      };
      stage.start(context);
      
      // Select a model first to trigger API key request
      stage.processOptionSelection(0);
      
      // Wait for async credential check to complete
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const result = stage.processResponse('test-api-key-123456');
      
      expect(result.isSuccess).toBe(true);
    });

    it('should fail for invalid API key', async () => {
      const context = {
        rootDirectory: '/test',
        flowcodeDirectory: '/test/.flowcode',
        collectedData: new Map()
      };
      stage.start(context);
      
      stage.processOptionSelection(0);
      
      // Wait for async credential check to complete
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const result = stage.processResponse('short');
      
      expect(result.isSuccess).toBe(false);
      expect(result.error).toContain('Invalid API key');
    });
  });

  describe('completion', () => {
    it('should not be completed initially', () => {
      expect(stage.isCompleted()).toBe(false);
      expect(stage.canProceedToNext()).toBe(false);
    });

    it('should be completed after API key is provided', async () => {
      const context = {
        rootDirectory: '/test',
        flowcodeDirectory: '/test/.flowcode',
        collectedData: new Map()
      };
      stage.start(context);
      
      stage.processOptionSelection(0);
      
      // Wait for async credential check to complete
      await new Promise(resolve => setTimeout(resolve, 10));
      
      stage.processResponse('test-api-key-123456');
      
      expect(stage.isCompleted()).toBe(true);
      expect(stage.canProceedToNext()).toBe(true);
    });

    it('should be completed if credentials already exist', async () => {
      credentialReader.setHasCredential(true);
      credentialReader.setCredential({
        apiKey: 'existing-key',
        lastUsed: new Date().toISOString()
      });

      const context = {
        rootDirectory: '/test',
        flowcodeDirectory: '/test/.flowcode',
        collectedData: new Map()
      };
      stage.start(context);
      
      stage.processOptionSelection(0);
      
      // Wait for async credential check
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(stage.isCompleted()).toBe(true);
    });
  });

  describe('getCollectedData', () => {
    it('should return empty data initially', () => {
      const data = stage.getCollectedData();
      
      expect(data.model).toBe(null);
      expect(data.provider).toBe(null);
      expect(data.apiKey).toBe(null);
    });

    it('should return collected data after completion', async () => {
      const context = {
        rootDirectory: '/test',
        flowcodeDirectory: '/test/.flowcode',
        collectedData: new Map()
      };
      stage.start(context);
      
      stage.processOptionSelection(0);
      
      // Wait for async credential check to complete
      await new Promise(resolve => setTimeout(resolve, 10));
      
      stage.processResponse('test-api-key-123456');
      
      const data = stage.getCollectedData();
      
      expect(data.model).toBeDefined();
      expect(data.provider).toBeDefined();
      expect(data.apiKey).toBe('test-api-key-123456');
    });
  });

  describe('reset', () => {
    it('should reset to initial state', () => {
      const context = {
        rootDirectory: '/test',
        flowcodeDirectory: '/test/.flowcode',
        collectedData: new Map()
      };
      stage.start(context);
      
      stage.processOptionSelection(0);
      stage.processResponse('test-api-key-123456');
      
      stage.reset();
      
      expect(stage.isCompleted()).toBe(false);
      expect(stage.canProceedToNext()).toBe(false);
      
      const data = stage.getCollectedData();
      expect(data.model).toBe(null);
      expect(data.provider).toBe(null);
      expect(data.apiKey).toBe(null);
    });
  });
});