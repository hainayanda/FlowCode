import { describe, it, expect, beforeEach } from 'vitest';
import { firstValueFrom } from 'rxjs';
import { WorkerInitializerStage } from '../../../src/application/services/initializer-stages/worker-initializer-stage.js';
import { InitializerStageType } from '../../../src/application/interfaces/initializer-stage.js';
import { MockAgentFactory, MockCredentialReader } from './initializer-stage.mocks.js';

describe('WorkerInitializerStage', () => {
  let stage: WorkerInitializerStage;
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
    stage = new WorkerInitializerStage(mockAgentFactory, mockCredentialReader);
  });

  describe('initialization', () => {
    it('should have correct stage properties', () => {
      expect(stage.stageType).toBe(InitializerStageType.Worker);
      expect(stage.name).toBe('Worker Configuration');
      expect(stage.description).toBe('Configure workers for the multi-agent system');
    });

    it('should start as not completed', () => {
      expect(stage.isCompleted()).toBe(false);
      expect(stage.canProceedToNext()).toBe(false);
    });
  });

  describe('start', () => {
    it('should start successfully and show add worker prompt', async () => {
      const result = stage.start(mockContext);
      
      expect(result.isSuccess).toBe(true);
      
      const message = await firstValueFrom(stage.messages$);
      expect(message.content).toBe('Do you want to add a worker to your multi-agent system?');
      
      const options = await firstValueFrom(stage.options$);
      expect(options.choices).toHaveLength(2);
      expect(options.choices[0]).toBe('Yes, add a worker');
      expect(options.choices[1]).toBe('No, skip worker configuration');
    });
  });

  describe('skip worker configuration', () => {
    beforeEach(() => {
      stage.start(mockContext);
    });

    it('should complete stage when skipping worker configuration', async () => {
      const result = stage.processOptionSelection(1); // No, skip
      
      expect(result.isSuccess).toBe(true);
      expect(stage.isCompleted()).toBe(true);
      expect(stage.canProceedToNext()).toBe(true);
      
      const data = stage.getCollectedData();
      expect(data.workers).toEqual([]);
    });
  });

  describe('add worker workflow', () => {
    beforeEach(() => {
      stage.start(mockContext);
    });

    it('should proceed to worker name input when choosing to add worker', async () => {
      const result = stage.processOptionSelection(0); // Yes, add a worker
      
      expect(result.isSuccess).toBe(true);
      expect(stage.isCompleted()).toBe(false);
      
      const message = await firstValueFrom(stage.messages$);
      expect(message.content).toContain('Enter the worker name');
    });

    it('should handle valid worker name', () => {
      stage.processOptionSelection(0); // Yes, add a worker
      
      const result = stage.processResponse('code-worker');
      
      expect(result.isSuccess).toBe(true);
    });

    it('should reject invalid worker name', () => {
      stage.processOptionSelection(0); // Yes, add a worker
      
      const result = stage.processResponse('a'); // Too short
      
      expect(result.isSuccess).toBe(false);
      expect(result.error).toBe('Worker name must be at least 2 characters long.');
    });

    it('should reject duplicate worker name', async () => {
      stage.processOptionSelection(0); // Yes, add a worker
      stage.processResponse('test-worker');
      stage.processResponse('Test worker description for testing');
      stage.processOptionSelection(0); // Select first model
      
      // Wait for first worker to complete
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Start adding another worker
      stage.processOptionSelection(0); // Yes, add another worker
      
      const result = stage.processResponse('test-worker'); // Same name
      
      expect(result.isSuccess).toBe(false);
      expect(result.error).toBe('A worker with this name already exists.');
    });
  });

  describe('worker description', () => {
    beforeEach(() => {
      stage.start(mockContext);
      stage.processOptionSelection(0); // Yes, add a worker
      stage.processResponse('test-worker');
    });

    it('should handle valid worker description', () => {
      const result = stage.processResponse('A specialized worker for testing purposes');
      
      expect(result.isSuccess).toBe(true);
    });

    it('should reject invalid worker description', () => {
      const result = stage.processResponse('short'); // Too short
      
      expect(result.isSuccess).toBe(false);
      expect(result.error).toBe('Worker description must be at least 10 characters long.');
    });
  });

  describe('worker model selection', () => {
    beforeEach(() => {
      stage.start(mockContext);
      stage.processOptionSelection(0); // Yes, add a worker
      stage.processResponse('test-worker');
      stage.processResponse('A specialized worker for testing purposes');
    });

    it('should show model selection after description', async () => {
      const message = await firstValueFrom(stage.messages$);
      expect(message.content).toContain('Select a model for the test-worker worker');
      
      const options = await firstValueFrom(stage.options$);
      expect(options.choices).toHaveLength(3);
      expect(options.choices[0]).toContain('GPT-4');
    });

    it('should handle valid model selection', () => {
      const result = stage.processOptionSelection(0); // Select GPT-4
      
      expect(result.isSuccess).toBe(true);
      expect(mockCredentialReader.hasCredentialCalled).toBe(true);
    });

    it('should reject invalid model selection', () => {
      const result = stage.processOptionSelection(99);
      
      expect(result.isSuccess).toBe(false);
      expect(result.error).toBe('Invalid model selection.');
    });
  });

  describe('complete worker flow', () => {
    it('should complete full worker creation flow', async () => {
      mockCredentialReader.setCredential('openai', { 
        apiKey: 'sk-test-key', 
        lastUsed: '2023-01-01T00:00:00.000Z' 
      });

      stage.start(mockContext);
      stage.processOptionSelection(0); // Yes, add a worker
      stage.processResponse('code-worker');
      stage.processResponse('A specialized worker for code generation and analysis');
      stage.processOptionSelection(0); // Select GPT-4
      
      // Allow async operations to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const data = stage.getCollectedData();
      expect(data.workers).toHaveLength(1);
      
      const worker = (data.workers as any[])[0];
      expect(worker.name).toBe('code-worker');
      expect(worker.description).toBe('A specialized worker for code generation and analysis');
      expect(worker.model).toBe('gpt-4');
      expect(worker.apiKey).toBe('sk-test-key');
    });

    it('should handle multiple workers', async () => {
      mockCredentialReader.setCredential('openai', { 
        apiKey: 'sk-test-key', 
        lastUsed: '2023-01-01T00:00:00.000Z' 
      });
      mockCredentialReader.setCredential('anthropic', { 
        apiKey: 'sk-ant-test-key', 
        lastUsed: '2023-01-01T00:00:00.000Z' 
      });

      stage.start(mockContext);
      
      // First worker
      stage.processOptionSelection(0); // Yes, add a worker
      stage.processResponse('code-worker');
      stage.processResponse('A specialized worker for code generation');
      stage.processOptionSelection(0); // Select GPT-4
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Add another worker
      stage.processOptionSelection(0); // Yes, add another worker
      stage.processResponse('ui-worker');
      stage.processResponse('A specialized worker for UI development');
      stage.processOptionSelection(1); // Select Claude
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Finish
      stage.processOptionSelection(1); // No, continue
      
      const data = stage.getCollectedData();
      expect(data.workers).toHaveLength(2);
      
      const workers = data.workers as any[];
      expect(workers[0].name).toBe('code-worker');
      expect(workers[1].name).toBe('ui-worker');
      
      expect(stage.isCompleted()).toBe(true);
      expect(stage.canProceedToNext()).toBe(true);
    });
  });

  describe('reset', () => {
    it('should reset stage state', async () => {
      mockCredentialReader.setCredential('openai', { 
        apiKey: 'sk-test-key', 
        lastUsed: '2023-01-01T00:00:00.000Z' 
      });

      stage.start(mockContext);
      stage.processOptionSelection(0); // Yes, add a worker
      stage.processResponse('test-worker');
      stage.processResponse('Test worker description');
      stage.processOptionSelection(0); // Select model
      
      await new Promise(resolve => setTimeout(resolve, 100));
      stage.processOptionSelection(1); // No, continue
      
      expect(stage.isCompleted()).toBe(true);
      
      stage.reset();
      
      expect(stage.isCompleted()).toBe(false);
      expect(stage.canProceedToNext()).toBe(false);
      
      const data = stage.getCollectedData();
      expect(data.workers).toEqual([]);
    });
  });
});