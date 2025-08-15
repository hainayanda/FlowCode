import { describe, it, expect, beforeEach } from 'vitest';
import { firstValueFrom } from 'rxjs';
import { DocGenerationInitializerStage } from '../../../src/application/services/initializer-stages/doc-generation-initializer-stage.js';
import { InitializerStageType } from '../../../src/application/interfaces/initializer-stage.js';
import { MockAgentFactory, MockToolbox } from './initializer-stage.mocks.js';

describe('DocGenerationInitializerStage', () => {
  let stage: DocGenerationInitializerStage;
  let mockAgentFactory: MockAgentFactory;
  let mockToolbox: MockToolbox;

  const mockContext = {
    rootDirectory: '/test/root',
    flowcodeDirectory: '/test/root/.flowcode',
    collectedData: new Map([
      ['taskmaster-model-model', 'gpt-4'],
      ['taskmaster-model-provider', 'openai'],
      ['taskmaster-model-apiKey', 'sk-test-key'],
      ['workers', [
        { name: 'code-worker', model: 'gpt-4', description: 'Code generation worker' },
        { name: 'ui-worker', model: 'claude-3-sonnet', description: 'UI development worker' }
      ]],
      ['summarizer', { provider: 'openai', model: 'gpt-3.5-turbo' }],
      ['embedding', { provider: 'openai', model: 'text-embedding-3-small' }]
    ])
  };

  beforeEach(() => {
    mockAgentFactory = new MockAgentFactory();
    mockToolbox = new MockToolbox();
    stage = new DocGenerationInitializerStage(mockAgentFactory, mockToolbox);
  });

  describe('initialization', () => {
    it('should have correct stage properties', () => {
      expect(stage.stageType).toBe(InitializerStageType.DocGeneration);
      expect(stage.name).toBe('Documentation Generation');
      expect(stage.description).toBe('Generate markdown files for taskmaster and workers based on project analysis');
    });

    it('should start as not completed', () => {
      expect(stage.isCompleted()).toBe(false);
      expect(stage.canProceedToNext()).toBe(true); // Can proceed even if skipped
    });
  });

  describe('start', () => {
    it('should start successfully and show generation prompt', async () => {
      const result = stage.start(mockContext);
      
      expect(result.isSuccess).toBe(true);
      
      const message = await firstValueFrom(stage.messages$);
      expect(message.content).toContain('Do you want to generate markdown documentation files?');
      expect(message.content).toContain('TASKMASTER.md');
      expect(message.content).toContain('[worker-name].md');
      
      const options = await firstValueFrom(stage.options$);
      expect(options.choices).toHaveLength(2);
      expect(options.choices[0]).toBe('Yes, generate documentation');
      expect(options.choices[1]).toBe('No, skip documentation generation');
    });
  });

  describe('skip documentation generation', () => {
    beforeEach(() => {
      stage.start(mockContext);
    });

    it('should complete stage when skipping documentation', async () => {
      const result = stage.processOptionSelection(1); // No, skip
      
      expect(result.isSuccess).toBe(true);
      expect(stage.isCompleted()).toBe(true);
      expect(stage.canProceedToNext()).toBe(true);
      
      const data = stage.getCollectedData();
      expect(data.generateMarkdownFiles).toBe(false);
    });
  });

  describe('generate documentation', () => {
    beforeEach(() => {
      stage.start(mockContext);
    });

    it('should start documentation generation when enabled', async () => {
      const result = stage.processOptionSelection(0); // Yes, generate
      
      expect(result.isSuccess).toBe(true);
      expect(stage.isCompleted()).toBe(false);
      
      // Allow async operations to start
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(mockAgentFactory.createAgentCalled).toBe(true);
      expect(mockAgentFactory.lastAgentConfig?.model).toBe('gpt-4');
      expect(mockAgentFactory.lastAgentConfig?.provider).toBe('openai');
    });

    it('should handle agent creation failure gracefully', async () => {
      // Mock agent factory to throw error
      mockAgentFactory.createAgent = () => { throw new Error('Agent creation failed'); };
      
      const result = stage.processOptionSelection(0); // Yes, generate
      
      expect(result.isSuccess).toBe(true);
      
      // Allow async operations to complete
      await new Promise(resolve => setTimeout(resolve, 200));
      
      expect(stage.isCompleted()).toBe(true);
      
      const data = stage.getCollectedData();
      expect(data.generateMarkdownFiles).toBe(false);
    });

    it('should complete successfully with valid setup', async () => {
      const result = stage.processOptionSelection(0); // Yes, generate
      
      expect(result.isSuccess).toBe(true);
      
      // Allow async operations to complete
      await new Promise(resolve => setTimeout(resolve, 300));
      
      expect(stage.isCompleted()).toBe(true);
      expect(stage.canProceedToNext()).toBe(true);
      
      const data = stage.getCollectedData();
      expect(data.generateMarkdownFiles).toBe(true);
    });
  });

  describe('context handling', () => {
    it('should build initialization options from context', () => {
      stage.start(mockContext);
      
      const data = stage.getCollectedData();
      // Initial state should show generateMarkdownFiles as false until option is selected
      expect(data.generateMarkdownFiles).toBe(false);
    });

    it('should handle empty context gracefully', () => {
      const emptyContext = {
        rootDirectory: '/test/root',
        flowcodeDirectory: '/test/root/.flowcode',
        collectedData: new Map()
      };
      
      const result = stage.start(emptyContext);
      
      expect(result.isSuccess).toBe(true);
      expect(stage.isCompleted()).toBe(false);
    });

    it('should handle context without workers', () => {
      const contextWithoutWorkers = {
        rootDirectory: '/test/root',
        flowcodeDirectory: '/test/root/.flowcode',
        collectedData: new Map([
          ['taskmaster-model-model', 'gpt-4'],
          ['taskmaster-model-provider', 'openai']
        ])
      };
      
      const result = stage.start(contextWithoutWorkers);
      
      expect(result.isSuccess).toBe(true);
    });
  });

  describe('invalid inputs', () => {
    beforeEach(() => {
      stage.start(mockContext);
    });

    it('should reject text input', () => {
      const result = stage.processResponse('some text');
      
      expect(result.isSuccess).toBe(false);
      expect(result.error).toBe('Text input not supported at this step. Please select an option.');
    });

    it('should reject invalid option selection', () => {
      const result = stage.processOptionSelection(99);
      
      expect(result.isSuccess).toBe(false);
      expect(result.error).toBe('Invalid option selection. Please choose 0 or 1.');
    });
  });

  describe('reset', () => {
    it('should reset stage state', async () => {
      stage.start(mockContext);
      stage.processOptionSelection(0); // Yes, generate
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      stage.reset();
      
      expect(stage.isCompleted()).toBe(false);
      
      const data = stage.getCollectedData();
      expect(data.generateMarkdownFiles).toBe(false);
    });
  });

  describe('getCollectedData', () => {
    it('should return correct data structure', () => {
      const data = stage.getCollectedData();
      
      expect(data).toHaveProperty('generateMarkdownFiles');
      expect(typeof data.generateMarkdownFiles).toBe('boolean');
    });

    it('should update data after option selection', () => {
      stage.start(mockContext);
      
      let data = stage.getCollectedData();
      expect(data.generateMarkdownFiles).toBe(false);
      
      stage.processOptionSelection(0); // Yes, generate
      
      data = stage.getCollectedData();
      expect(data.generateMarkdownFiles).toBe(true);
    });
  });
});