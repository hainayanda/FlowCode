import { describe, it, expect, beforeEach } from 'vitest';
import { firstValueFrom } from 'rxjs';
import { EmbeddingInitializerStage } from '../../../src/application/services/initializer-stages/embedding-initializer-stage.js';
import { InitializerStageType } from '../../../src/application/interfaces/initializer-stage.js';
import { MockEmbeddingAgentFactory, MockCredentialReader } from './initializer-stage.mocks.js';

describe('EmbeddingInitializerStage', () => {
  let stage: EmbeddingInitializerStage;
  let mockEmbeddingAgentFactory: MockEmbeddingAgentFactory;
  let mockCredentialReader: MockCredentialReader;

  const mockContext = {
    rootDirectory: '/test/root',
    flowcodeDirectory: '/test/root/.flowcode',
    collectedData: new Map()
  };

  beforeEach(() => {
    mockEmbeddingAgentFactory = new MockEmbeddingAgentFactory();
    mockCredentialReader = new MockCredentialReader();
    stage = new EmbeddingInitializerStage(mockEmbeddingAgentFactory, mockCredentialReader);
  });

  describe('initialization', () => {
    it('should have correct stage properties', () => {
      expect(stage.stageType).toBe(InitializerStageType.Embedding);
      expect(stage.name).toBe('Embedding Configuration');
      expect(stage.description).toBe('Configure vector embeddings for semantic search and context retrieval');
    });

    it('should start as not completed', () => {
      expect(stage.isCompleted()).toBe(false);
      expect(stage.canProceedToNext()).toBe(true); // Can proceed even if disabled
    });
  });

  describe('start', () => {
    it('should start successfully and show embedding prompt', async () => {
      const result = stage.start(mockContext);
      
      expect(result.isSuccess).toBe(true);
      
      const message = await firstValueFrom(stage.messages$);
      expect(message.content).toContain('Do you want to enable vector embeddings');
      expect(message.content).toContain('Find relevant past conversations');
      
      const options = await firstValueFrom(stage.options$);
      expect(options.choices).toHaveLength(2);
      expect(options.choices[0]).toBe('Yes, enable embeddings');
      expect(options.choices[1]).toBe('No, disable embeddings');
    });
  });

  describe('disable embeddings', () => {
    beforeEach(() => {
      stage.start(mockContext);
    });

    it('should complete stage when disabling embeddings', async () => {
      const result = stage.processOptionSelection(1); // No, disable
      
      expect(result.isSuccess).toBe(true);
      expect(stage.isCompleted()).toBe(true);
      expect(stage.canProceedToNext()).toBe(true);
      
      const data = stage.getCollectedData();
      expect(data.embedding).toBeNull();
    });
  });

  describe('enable embeddings', () => {
    beforeEach(() => {
      stage.start(mockContext);
    });

    it('should show model selection when enabling embeddings', async () => {
      const result = stage.processOptionSelection(0); // Yes, enable
      
      expect(result.isSuccess).toBe(true);
      expect(stage.isCompleted()).toBe(false);
      
      const message = await firstValueFrom(stage.messages$);
      expect(message.content).toContain('Select a model for embeddings');
      
      const options = await firstValueFrom(stage.options$);
      expect(options.choices).toHaveLength(2);
      expect(options.choices[0]).toContain('OpenAI Small Embedding');
      expect(options.choices[1]).toContain('Cohere English v3');
    });

    it('should handle no available models', async () => {
      // Create empty factory
      const emptyFactory = new MockEmbeddingAgentFactory();
      emptyFactory.getModels = () => [];
      
      const stageWithEmptyFactory = new EmbeddingInitializerStage(emptyFactory, mockCredentialReader);
      stageWithEmptyFactory.start(mockContext);
      
      const result = stageWithEmptyFactory.processOptionSelection(0); // Yes, enable
      
      expect(result.isSuccess).toBe(true);
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(stageWithEmptyFactory.isCompleted()).toBe(true);
      
      const data = stageWithEmptyFactory.getCollectedData();
      expect(data.embedding).toBeNull();
    });

    it('should handle model selection with existing API key', async () => {
      mockCredentialReader.setCredential('openai', { 
        apiKey: 'sk-test-key', 
        lastUsed: '2023-01-01T00:00:00.000Z' 
      });

      stage.processOptionSelection(0); // Yes, enable
      const result = stage.processOptionSelection(0); // Select OpenAI embedding
      
      expect(result.isSuccess).toBe(true);
      
      // Allow async operations to complete
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(stage.isCompleted()).toBe(true);
      expect(stage.canProceedToNext()).toBe(true);
      
      const data = stage.getCollectedData();
      expect(data.embedding).toEqual({
        provider: 'openai',
        model: 'text-embedding-3-small',
        apiKey: 'sk-test-key'
      });
    });

    it('should request API key when not available', async () => {
      mockCredentialReader.clearCredentials();

      stage.processOptionSelection(0); // Yes, enable
      stage.processOptionSelection(0); // Select OpenAI embedding
      
      // Allow async operations to complete
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(stage.isCompleted()).toBe(false);
      
      const message = await firstValueFrom(stage.messages$);
      expect(message.content).toContain('Please enter your API key for openai');
    });

    it('should handle API key input', async () => {
      mockCredentialReader.clearCredentials();

      stage.processOptionSelection(0); // Yes, enable
      stage.processOptionSelection(0); // Select OpenAI embedding
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const result = stage.processResponse('sk-valid-api-key-12345');
      
      expect(result.isSuccess).toBe(true);
      expect(stage.isCompleted()).toBe(true);
      
      const data = stage.getCollectedData();
      expect(data.embedding).toEqual({
        provider: 'openai',
        model: 'text-embedding-3-small',
        apiKey: 'sk-valid-api-key-12345'
      });
    });

    it('should reject invalid API key', async () => {
      mockCredentialReader.clearCredentials();

      stage.processOptionSelection(0); // Yes, enable
      stage.processOptionSelection(0); // Select OpenAI embedding
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const result = stage.processResponse('short');
      
      expect(result.isSuccess).toBe(false);
      expect(result.error).toBe('Invalid API key. Please enter a valid API key.');
      expect(stage.isCompleted()).toBe(false);
    });

    it('should handle different providers', async () => {
      mockCredentialReader.setCredential('cohere', { 
        apiKey: 'co-test-key', 
        lastUsed: '2023-01-01T00:00:00.000Z' 
      });

      stage.processOptionSelection(0); // Yes, enable
      const result = stage.processOptionSelection(1); // Select Cohere embedding
      
      expect(result.isSuccess).toBe(true);
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(stage.isCompleted()).toBe(true);
      
      const data = stage.getCollectedData();
      expect(data.embedding).toEqual({
        provider: 'cohere',
        model: 'embed-english-v3.0',
        apiKey: 'co-test-key'
      });
    });
  });

  describe('invalid inputs', () => {
    beforeEach(() => {
      stage.start(mockContext);
    });

    it('should reject invalid option selection in embedding choice', () => {
      const result = stage.processOptionSelection(99);
      
      expect(result.isSuccess).toBe(false);
      expect(result.error).toBe('Option selection not supported at this step.');
    });

    it('should reject invalid model selection', () => {
      stage.processOptionSelection(0); // Yes, enable
      
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
      expect(data.embedding).toBeNull();
    });
  });
});