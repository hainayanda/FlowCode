import { describe, it, expect, beforeEach } from 'vitest';
import { WorkerInitializerStage } from '../../../src/application/commands/initializer/initializer-stages/worker-initializer-stage.js';
import { InitializerStageType } from '../../../src/application/interfaces/initializer-stage.js';
import { MockAgentFactory, createMockModels } from '../agents/agent-factory.mocks.js';
import { MockCredentialStore } from '../stores/credential-repository.mocks.js';

describe('WorkerInitializerStage', () => {
  let stage: WorkerInitializerStage;
  let agentFactory: MockAgentFactory;
  let credentialReader: MockCredentialStore;

  beforeEach(() => {
    agentFactory = new MockAgentFactory('test', createMockModels('test'));
    credentialReader = new MockCredentialStore();
    
    stage = new WorkerInitializerStage(agentFactory, credentialReader);
  });

  describe('properties', () => {
    it('should have correct stage properties', () => {
      expect(stage.stageType).toBe(InitializerStageType.Worker);
      expect(stage.name).toBe('Worker Configuration');
      expect(stage.description).toBe('Configure workers for the multi-agent system');
    });

    it('should provide observables', () => {
      expect(stage.messages$).toBeDefined();
      expect(stage.options$).toBeDefined();
    });
  });

  describe('start', () => {
    it('should start successfully and show add worker prompt', () => {
      const context = {
        rootDirectory: '/test',
        flowcodeDirectory: '/test/.flowcode',
        collectedData: new Map()
      };

      const result = stage.start(context);
      
      expect(result.isSuccess).toBe(true);
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
      
      expect(messages.some(msg => msg.content.includes('add a worker'))).toBe(true);
      expect(options.some(opt => opt.choices.includes('Yes, add a worker'))).toBe(true);
    });
  });

  describe('processOptionSelection - add worker flow', () => {
    beforeEach(() => {
      const context = {
        rootDirectory: '/test',
        flowcodeDirectory: '/test/.flowcode',
        collectedData: new Map()
      };
      stage.start(context);
    });

    it('should handle skipping worker configuration', () => {
      const result = stage.processOptionSelection(1); // No, skip
      
      expect(result.isSuccess).toBe(true);
      expect(stage.isCompleted()).toBe(true);
    });

    it('should handle adding a worker', () => {
      const result = stage.processOptionSelection(0); // Yes, add a worker
      
      expect(result.isSuccess).toBe(true);
      expect(stage.isCompleted()).toBe(false);
    });
  });

  describe('worker creation flow', () => {
    beforeEach(() => {
      const context = {
        rootDirectory: '/test',
        flowcodeDirectory: '/test/.flowcode',
        collectedData: new Map()
      };
      stage.start(context);
      stage.processOptionSelection(0); // Choose to add worker
    });

    it('should handle worker name input', () => {
      const result = stage.processResponse('code-worker');
      
      expect(result.isSuccess).toBe(true);
    });

    it('should fail for invalid worker name', () => {
      const result = stage.processResponse('c');
      
      expect(result.isSuccess).toBe(false);
      expect(result.error).toContain('must be at least 2 characters');
    });

    it('should handle worker description after name', () => {
      stage.processResponse('code-worker');
      
      const result = stage.processResponse('This worker handles code generation and analysis tasks');
      
      expect(result.isSuccess).toBe(true);
    });

    it('should fail for short description', () => {
      stage.processResponse('code-worker');
      
      const result = stage.processResponse('short');
      
      expect(result.isSuccess).toBe(false);
      expect(result.error).toContain('must be at least 10 characters');
    });

    it('should show model selection after description', async () => {
      const messages: any[] = [];
      stage.messages$.subscribe(msg => messages.push(msg));

      stage.processResponse('code-worker');
      stage.processResponse('This worker handles code generation and analysis tasks');

      // Wait for async operations to complete
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(messages.some(msg => msg.content.includes('Select a model'))).toBe(true);
      // Models are fetched during showWorkerModelSelection
    });
  });

  describe('model selection and API key', () => {
    beforeEach(() => {
      const context = {
        rootDirectory: '/test',
        flowcodeDirectory: '/test/.flowcode',
        collectedData: new Map()
      };
      stage.start(context);
      stage.processOptionSelection(0); // Add worker
      stage.processResponse('code-worker');
      stage.processResponse('This worker handles code generation and analysis tasks');
    });

    it('should handle model selection', () => {
      const result = stage.processOptionSelection(0);
      
      expect(result.isSuccess).toBe(true);
    });

    it('should fail for invalid model selection', () => {
      const result = stage.processOptionSelection(999);
      
      expect(result.isSuccess).toBe(false);
      expect(result.error).toBe('Invalid model selection.');
    });

    it('should handle API key input', async () => {
      stage.processOptionSelection(0); // Select first model
      
      // Wait for async checkWorkerApiKey to complete and transition to API key step
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const result = stage.processResponse('test-test-api-key-11111123456');
      
      expect(result.isSuccess).toBe(true);
    });

    it('should fail for invalid API key', async () => {
      stage.processOptionSelection(0); // Select first model
      
      // Wait for async checkWorkerApiKey to complete and transition to API key step
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const result = stage.processResponse('short');
      
      expect(result.isSuccess).toBe(false);
      expect(result.error).toContain('Invalid API key');
    });
  });

  describe('multiple workers', () => {
    beforeEach(() => {
      const context = {
        rootDirectory: '/test',
        flowcodeDirectory: '/test/.flowcode',
        collectedData: new Map()
      };
      stage.start(context);
    });

    it('should allow adding multiple workers', async () => {
      // Add first worker
      stage.processOptionSelection(0); // Add worker
      stage.processResponse('code-worker');
      stage.processResponse('This worker handles code generation tasks');
      stage.processOptionSelection(0); // Select model
      await new Promise(resolve => setTimeout(resolve, 10)); // Wait for async API key check
      stage.processResponse('test-api-key-111111');
      
      // Add another worker
      stage.processOptionSelection(0); // Yes, add another
      stage.processResponse('ui-worker');
      stage.processResponse('This worker handles UI generation tasks');
      stage.processOptionSelection(0); // Select model
      await new Promise(resolve => setTimeout(resolve, 10)); // Wait for async API key check
      stage.processResponse('test-api-key-222222');
      
      // Complete
      stage.processOptionSelection(1); // No, continue
      
      const data = stage.getCollectedData();
      expect(data.workers).toHaveLength(2);
      expect(stage.isCompleted()).toBe(true);
    });

    it('should prevent duplicate worker names', async () => {
      // Add first worker
      stage.processOptionSelection(0); // Add worker
      stage.processResponse('code-worker');
      stage.processResponse('This worker handles code generation tasks');
      stage.processOptionSelection(0); // Select model
      await new Promise(resolve => setTimeout(resolve, 10)); // Wait for async API key check
      stage.processResponse('test-api-key-111111');
      
      // Try to add worker with same name
      stage.processOptionSelection(0); // Yes, add another
      
      const result = stage.processResponse('code-worker');
      
      expect(result.isSuccess).toBe(false);
      expect(result.error).toContain('already exists');
    });
  });

  describe('completion states', () => {
    it('should not be completed initially', () => {
      expect(stage.isCompleted()).toBe(false);
      expect(stage.canProceedToNext()).toBe(false);
    });

    it('should be completed when skipped', () => {
      const context = {
        rootDirectory: '/test',
        flowcodeDirectory: '/test/.flowcode',
        collectedData: new Map()
      };
      stage.start(context);
      
      stage.processOptionSelection(1); // Skip
      
      expect(stage.isCompleted()).toBe(true);
      expect(stage.canProceedToNext()).toBe(true);
    });

    it('should be completed after adding workers', async () => {
      const context = {
        rootDirectory: '/test',
        flowcodeDirectory: '/test/.flowcode',
        collectedData: new Map()
      };
      stage.start(context);
      
      stage.processOptionSelection(0); // Add worker
      stage.processResponse('code-worker');
      stage.processResponse('This worker handles code generation tasks');
      stage.processOptionSelection(0); // Select model
      await new Promise(resolve => setTimeout(resolve, 10)); // Wait for async API key check
      stage.processResponse('test-api-key-111111');
      stage.processOptionSelection(1); // No more workers
      
      expect(stage.isCompleted()).toBe(true);
      expect(stage.canProceedToNext()).toBe(true);
    });
  });

  describe('getCollectedData', () => {
    it('should return empty workers array initially', () => {
      const data = stage.getCollectedData();
      
      expect(data.workers).toEqual([]);
    });

    it('should return workers after completion', async () => {
      const context = {
        rootDirectory: '/test',
        flowcodeDirectory: '/test/.flowcode',
        collectedData: new Map()
      };
      stage.start(context);
      
      stage.processOptionSelection(0); // Add worker
      stage.processResponse('code-worker');
      stage.processResponse('This worker handles code generation tasks');
      stage.processOptionSelection(0); // Select model
      await new Promise(resolve => setTimeout(resolve, 10)); // Wait for async API key check
      stage.processResponse('test-api-key-123456');
      
      stage.processOptionSelection(1); // No more workers
      
      const data = stage.getCollectedData();
      const workers = data.workers as any[];
      
      expect(workers).toHaveLength(1);
      expect(workers[0].name).toBe('code-worker');
      expect(workers[0].description).toBe('This worker handles code generation tasks');
      expect(workers[0].model).toBeDefined();
      expect(workers[0].apiKey).toBe('test-api-key-123456');
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
      
      stage.processOptionSelection(0); // Add worker
      stage.processResponse('code-worker');
      
      stage.reset();
      
      expect(stage.isCompleted()).toBe(false);
      expect(stage.canProceedToNext()).toBe(false);
      
      const data = stage.getCollectedData();
      expect(data.workers).toEqual([]);
    });
  });
});