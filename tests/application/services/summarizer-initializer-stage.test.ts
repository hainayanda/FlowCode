import { describe, it, expect, beforeEach } from 'vitest';
import { firstValueFrom } from 'rxjs';
import { SummarizerInitializerStage } from '../../../src/application/services/initializer-stages/summarizer-initializer-stage.js';
import { InitializerStageType } from '../../../src/application/interfaces/initializer-stage.js';
import { MockAgentFactory, MockCredentialReader } from './initializer-stage.mocks.js';

describe('SummarizerInitializerStage', () => {
  let stage: SummarizerInitializerStage;
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
    stage = new SummarizerInitializerStage(mockAgentFactory, mockCredentialReader);
  });

  describe('initialization', () => {
    it('should have correct stage properties', () => {
      expect(stage.stageType).toBe(InitializerStageType.Summarizer);
      expect(stage.name).toBe('Summarizer Configuration');
      expect(stage.description).toBe('Configure summarizer for conversation context management');
    });

    it('should start as not completed', () => {
      expect(stage.isCompleted()).toBe(false);
      expect(stage.canProceedToNext()).toBe(true); // Can proceed even if disabled
    });
  });

  describe('start', () => {
    it('should start successfully and show summarizer prompt', async () => {
      const result = stage.start(mockContext);
      
      expect(result.isSuccess).toBe(true);
      
      const message = await firstValueFrom(stage.messages$);
      expect(message.content).toContain('Do you want to enable conversation summarizer');
      
      const options = await firstValueFrom(stage.options$);
      expect(options.choices).toHaveLength(2);
      expect(options.choices[0]).toBe('Yes, enable summarizer');
      expect(options.choices[1]).toBe('No, disable summarizer');
    });
  });

  describe('disable summarizer', () => {
    beforeEach(() => {
      stage.start(mockContext);
    });

    it('should complete stage when disabling summarizer', async () => {
      const result = stage.processOptionSelection(1); // No, disable
      
      expect(result.isSuccess).toBe(true);
      expect(stage.isCompleted()).toBe(true);
      expect(stage.canProceedToNext()).toBe(true);
      
      const data = stage.getCollectedData();
      expect(data.summarizer).toBeNull();
    });
  });

  describe('enable summarizer', () => {
    beforeEach(() => {
      stage.start(mockContext);
    });

    it('should show model selection when enabling summarizer', async () => {
      const result = stage.processOptionSelection(0); // Yes, enable
      
      expect(result.isSuccess).toBe(true);
      expect(stage.isCompleted()).toBe(false);
      
      const message = await firstValueFrom(stage.messages$);
      expect(message.content).toContain('Select a model for the summarizer');
      
      const options = await firstValueFrom(stage.options$);
      expect(options.choices).toHaveLength(3);
      expect(options.choices[0]).toContain('GPT-4');
    });

    it('should handle model selection with existing API key', async () => {
      mockCredentialReader.setCredential('openai', { 
        apiKey: 'sk-test-key', 
        lastUsed: '2023-01-01T00:00:00.000Z' 
      });

      stage.processOptionSelection(0); // Yes, enable
      const result = stage.processOptionSelection(0); // Select GPT-4
      
      expect(result.isSuccess).toBe(true);
      
      // Allow async operations to complete
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(stage.isCompleted()).toBe(true);
      expect(stage.canProceedToNext()).toBe(true);
      
      const data = stage.getCollectedData();
      expect(data.summarizer).toEqual({
        provider: 'openai',
        model: 'gpt-4',
        apiKey: 'sk-test-key'
      });
    });

    it('should request API key when not available', async () => {
      mockCredentialReader.clearCredentials();

      stage.processOptionSelection(0); // Yes, enable
      stage.processOptionSelection(0); // Select GPT-4
      
      // Allow async operations to complete
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(stage.isCompleted()).toBe(false);
      
      const message = await firstValueFrom(stage.messages$);
      expect(message.content).toContain('Please enter your API key for openai');
    });

    it('should handle API key input', async () => {
      mockCredentialReader.clearCredentials();

      stage.processOptionSelection(0); // Yes, enable
      stage.processOptionSelection(0); // Select GPT-4
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const result = stage.processResponse('sk-valid-api-key-12345');
      
      expect(result.isSuccess).toBe(true);
      expect(stage.isCompleted()).toBe(true);
      
      const data = stage.getCollectedData();
      expect(data.summarizer).toEqual({
        provider: 'openai',
        model: 'gpt-4',
        apiKey: 'sk-valid-api-key-12345'
      });
    });

    it('should reject invalid API key', async () => {
      mockCredentialReader.clearCredentials();

      stage.processOptionSelection(0); // Yes, enable
      stage.processOptionSelection(0); // Select GPT-4
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const result = stage.processResponse('short');
      
      expect(result.isSuccess).toBe(false);
      expect(result.error).toBe('Invalid API key. Please enter a valid API key.');
      expect(stage.isCompleted()).toBe(false);
    });
  });

  describe('invalid inputs', () => {
    beforeEach(() => {
      stage.start(mockContext);
    });

    it('should reject invalid option selection', () => {
      const result = stage.processOptionSelection(99);
      
      expect(result.isSuccess).toBe(false);
      expect(result.error).toBe('Invalid model selection.');
    });

    it('should reject text input when not in API key step', () => {
      const result = stage.processResponse('some text');
      
      expect(result.isSuccess).toBe(false);
      expect(result.error).toBe('Text input not supported at this step. Please select an option.');
    });
  });

  describe('reset', () => {
    it('should reset stage state', async () => {
      mockCredentialReader.setCredential('openai', { 
        apiKey: 'sk-test-key', 
        lastUsed: '2023-01-01T00:00:00.000Z' 
      });

      stage.start(mockContext);
      stage.processOptionSelection(0); // Yes, enable
      stage.processOptionSelection(0); // Select model
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(stage.isCompleted()).toBe(true);
      
      stage.reset();
      
      expect(stage.isCompleted()).toBe(false);
      
      const data = stage.getCollectedData();
      expect(data.summarizer).toBeNull();
    });
  });
});