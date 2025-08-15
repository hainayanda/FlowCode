import { describe, it, expect, beforeEach } from 'vitest';
import { firstValueFrom } from 'rxjs';
import { TaskmasterModelInitializerStage } from '../../../src/application/services/initializer-stages/taskmaster-model-initializer-stage.js';
import { InitializerStageType } from '../../../src/application/interfaces/initializer-stage.js';
import { MockAgentFactory, MockCredentialReader } from './initializer-stage.mocks.js';

describe('TaskmasterModelInitializerStage', () => {
  let stage: TaskmasterModelInitializerStage;
  let mockAgentFactory: MockAgentFactory;
  let mockCredentialReader: MockCredentialReader;

  const mockContext = {
    rootDirectory: '/test/root',
    flowcodeDirectory: '/test/root/.flowcode',
    collectedData: new Map()
  };

  beforeEach(() => {
    mockAgentFactory = new MockAgentFactory();
    mockCredentialReader = new MockCredentialReader();
    stage = new TaskmasterModelInitializerStage(mockAgentFactory, mockCredentialReader);
  });

  describe('initialization', () => {
    it('should have correct stage properties', () => {
      expect(stage.stageType).toBe(InitializerStageType.TaskmasterModel);
      expect(stage.name).toBe('Taskmaster Model Selection');
      expect(stage.description).toBe('Select the AI model for the taskmaster agent');
    });

    it('should start as not completed', () => {
      expect(stage.isCompleted()).toBe(false);
      expect(stage.canProceedToNext()).toBe(false);
    });

    it('should provide observable streams', () => {
      expect(stage.messages$).toBeDefined();
      expect(stage.options$).toBeDefined();
    });
  });

  describe('start', () => {
    it('should start successfully and show model selection', async () => {
      const result = stage.start(mockContext);
      
      expect(result.isSuccess).toBe(true);
      
      const message = await firstValueFrom(stage.messages$);
      expect(message.content).toBe('Select a model for your taskmaster agent:');
      
      const options = await firstValueFrom(stage.options$);
      expect(options.choices).toHaveLength(3);
      expect(options.choices[0]).toContain('GPT-4');
      expect(options.choices[1]).toContain('Claude 3 Sonnet');
      expect(options.choices[2]).toContain('Gemini Pro');
    });
  });

  describe('processOptionSelection', () => {
    beforeEach(async () => {
      stage.start(mockContext);
    });

    it('should handle valid model selection', async () => {
      const result = stage.processOptionSelection(0); // Select GPT-4
      
      expect(result.isSuccess).toBe(true);
      expect(mockCredentialReader.hasCredentialCalled).toBe(true);
      expect(mockCredentialReader.lastProviderQueried).toBe('openai');
    });

    it('should reject invalid model selection', () => {
      const result = stage.processOptionSelection(99);
      
      expect(result.isSuccess).toBe(false);
      expect(result.error).toBe('Invalid model selection.');
    });

    it('should complete stage when API key is available', async () => {
      mockCredentialReader.setCredential('openai', { 
        apiKey: 'sk-test-key', 
        lastUsed: '2023-01-01T00:00:00.000Z' 
      });

      const result = stage.processOptionSelection(0);
      expect(result.isSuccess).toBe(true);

      // Allow async operations to complete
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(stage.isCompleted()).toBe(true);
      expect(stage.canProceedToNext()).toBe(true);
    });

    it('should request API key when not available', async () => {
      mockCredentialReader.clearCredentials();

      const result = stage.processOptionSelection(0);
      expect(result.isSuccess).toBe(true);

      // Allow async operations to complete
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(stage.isCompleted()).toBe(false);
      
      const message = await firstValueFrom(stage.messages$);
      expect(message.content).toContain('Please enter your API key for openai');
    });
  });

  describe('processResponse', () => {
    beforeEach(async () => {
      stage.start(mockContext);
      mockCredentialReader.clearCredentials();
      stage.processOptionSelection(0); // Select GPT-4, will trigger API key request
      await new Promise(resolve => setTimeout(resolve, 50)); // Wait for async operations
    });

    it('should handle valid API key input', () => {
      const result = stage.processResponse('sk-valid-api-key-12345');
      
      expect(result.isSuccess).toBe(true);
      expect(stage.isCompleted()).toBe(true);
      expect(stage.canProceedToNext()).toBe(true);
    });

    it('should reject invalid API key', () => {
      const result = stage.processResponse('short');
      
      expect(result.isSuccess).toBe(false);
      expect(result.error).toBe('Invalid API key. Please enter a valid API key.');
      expect(stage.isCompleted()).toBe(false);
    });

    it('should reject empty API key', () => {
      const result = stage.processResponse('');
      
      expect(result.isSuccess).toBe(false);
      expect(result.error).toBe('Invalid API key. Please enter a valid API key.');
    });
  });

  describe('getCollectedData', () => {
    it('should return empty data initially', () => {
      const data = stage.getCollectedData();
      
      expect(data.model).toBeNull();
      expect(data.provider).toBeNull();
      expect(data.apiKey).toBeNull();
    });

    it('should return collected data after completion', async () => {
      stage.start(mockContext);
      mockCredentialReader.setCredential('openai', { 
        apiKey: 'sk-test-key', 
        lastUsed: '2023-01-01T00:00:00.000Z' 
      });
      
      stage.processOptionSelection(0); // Select GPT-4
      await new Promise(resolve => setTimeout(resolve, 50)); // Wait for completion
      
      const data = stage.getCollectedData();
      
      expect(data.model).toBe('gpt-4');
      expect(data.provider).toBe('openai');
      expect(data.apiKey).toBe('sk-test-key');
    });
  });

  describe('reset', () => {
    it('should reset stage state', async () => {
      stage.start(mockContext);
      stage.processOptionSelection(0);
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(stage.isCompleted()).toBe(true);
      
      stage.reset();
      
      expect(stage.isCompleted()).toBe(false);
      expect(stage.canProceedToNext()).toBe(false);
      
      const data = stage.getCollectedData();
      expect(data.model).toBeNull();
      expect(data.provider).toBeNull();
      expect(data.apiKey).toBeNull();
    });
  });
});