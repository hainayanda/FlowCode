import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InitializerStageFactoryMock } from './initializer-stage-factory.mocks.js';
import { MockConfigStore } from '../services/config-service.mocks.js';
import { MockSettingsStore } from '../services/settings-service.mocks.js';
import { MockCredentialStore } from '../stores/credential-repository.mocks.js';
import { InitializerStageMock } from './initializer-stage.mocks.js';
import { InitializationState } from '../../../src/application/interfaces/initializer.js';
import { InitializerStageType } from '../../../src/application/interfaces/initializer-stage.js';
import { Result } from '../../../src/shared/result.js';


import { InitializerCommandHandler } from '../../../src/application/commands/initializer/initializer-command-handler.js';

class TestableInitializerCommandHandler extends InitializerCommandHandler {
  public isDirectoryInitialized = false;
  
  protected isCurrentDirectoryInitialized(): boolean {
    return this.isDirectoryInitialized;
  }
}

describe('InitializerCommandHandler', () => {
  let handler: TestableInitializerCommandHandler;
  let stageFactory: InitializerStageFactoryMock;
  let configWriter: MockConfigStore;
  let settingsWriter: MockSettingsStore;
  let credentialWriter: MockCredentialStore;
  let mockStage: InitializerStageMock;

  beforeEach(() => {
    stageFactory = new InitializerStageFactoryMock();
    configWriter = new MockConfigStore();
    settingsWriter = new MockSettingsStore();
    credentialWriter = new MockCredentialStore();
    mockStage = new InitializerStageMock();

    // Reset directory initialized flag
    // (will be set in the constructor)

    handler = new TestableInitializerCommandHandler(
      '/test/root',
      stageFactory,
      configWriter,
      settingsWriter,
      credentialWriter
    );
  });

  describe('execute', () => {
    it('should fail for unsupported command', async () => {
      const result = await handler.execute('unsupported', []);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Initializer service only supports "init" command');
    });

    it('should fail if directory already initialized', async () => {
      handler.isDirectoryInitialized = true;
      
      const result = await handler.execute('init', []);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('FlowCode project is already initialized in this directory.');
    });

    it('should start initialization successfully', async () => {
      stageFactory.setMockStage(mockStage);
      
      const result = await handler.execute('init', []);
      
      expect(result.success).toBe(true);
      expect(result.message).toBe('FlowCode initialization started. Follow the prompts to configure your project.');
    });
  });

  describe('getCommands', () => {
    it('should return init command definition', () => {
      const commands = handler.getCommands();
      
      expect(commands).toHaveLength(1);
      expect(commands[0].name).toBe('init');
      expect(commands[0].description).toBe('Initialize FlowCode project in current directory');
    });
  });

  describe('supports', () => {
    it('should support init command', () => {
      expect(handler.supports('init')).toBe(true);
    });

    it('should not support other commands', () => {
      expect(handler.supports('other')).toBe(false);
    });
  });

  describe('processResponse', () => {
    it('should fail if no active stage', () => {
      const result = handler.processResponse('test');
      
      expect(result.isSuccess).toBe(false);
      expect(result.error).toBe('No active stage to process response.');
    });

    it('should process response through active stage', async () => {
      stageFactory.setMockStage(mockStage);
      await handler.execute('init', []);
      
      const result = handler.processResponse('test response');
      
      expect(result.isSuccess).toBe(true);
      expect(mockStage.processResponseCalled).toBe(true);
      expect(mockStage.lastResponse).toBe('test response');
    });
  });

  describe('processOptionSelection', () => {
    it('should fail if no active stage', () => {
      const result = handler.processOptionSelection(0);
      
      expect(result.isSuccess).toBe(false);
      expect(result.error).toBe('No active stage to process option selection.');
    });

    it('should process option selection through active stage', async () => {
      stageFactory.setMockStage(mockStage);
      await handler.execute('init', []);
      
      const result = handler.processOptionSelection(1);
      
      expect(result.isSuccess).toBe(true);
      expect(mockStage.processOptionSelectionCalled).toBe(true);
      expect(mockStage.lastOptionIndex).toBe(1);
    });
  });

  describe('isInteractive', () => {
    it('should return false when not started', () => {
      expect(handler.isInteractive()).toBe(false);
    });

    it('should return true when in progress', async () => {
      stageFactory.setMockStage(mockStage);
      await handler.execute('init', []);
      
      expect(handler.isInteractive()).toBe(true);
    });
  });

  describe('reset', () => {
    it('should reset to initial state', async () => {
      stageFactory.setMockStage(mockStage);
      await handler.execute('init', []);
      
      handler.reset();
      
      expect(handler.isInteractive()).toBe(false);
    });
  });

  describe('stage completion flow', () => {
    it('should progress through stages when completed', async () => {
      const stage1 = new InitializerStageMock();
      const stage2 = new InitializerStageMock();
      
      stageFactory.setMockStages([stage1, stage2]);
      
      await handler.execute('init', []);
      expect(stageFactory.createStageCalls).toBe(1);
      
      // Complete first stage
      stage1.complete();
      handler.processResponse('test');
      
      // Wait for async stage transition
      await new Promise(resolve => setTimeout(resolve, 550));
      
      expect(stageFactory.createStageCalls).toBe(2);
      expect(stage2.startCalled).toBe(true);
    });

    it('should complete initialization after all stages', async () => {
      // Create 5 stages (one for each stage type in the handler)
      const stages = [
        new InitializerStageMock(),
        new InitializerStageMock(),
        new InitializerStageMock(),
        new InitializerStageMock(),
        new InitializerStageMock()
      ];
      stageFactory.setMockStages(stages);
      
      await handler.execute('init', []);
      
      // Complete all stages in sequence
      for (let i = 0; i < stages.length; i++) {
        stages[i].complete();
        handler.processResponse('test');
        // Small delay between stages to account for the 500ms setTimeout in the handler
        await new Promise(resolve => setTimeout(resolve, 600));
      }
      
      // Wait for final async completion
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      expect(settingsWriter.ensureSettingsDirectoryCalled).toBe(true);
      expect(configWriter.writeConfigCalled).toBe(true);
      expect(settingsWriter.writeSettingsCalled).toBe(true);
    });
  });

  describe('observables', () => {
    it('should provide messages observable', () => {
      const messages$ = handler.messages$;
      expect(messages$).toBeDefined();
    });

    it('should provide options observable', () => {
      const options$ = handler.options$;
      expect(options$).toBeDefined();
    });

    it('should emit messages during initialization', async () => {
      const messages: any[] = [];
      handler.messages$.subscribe(msg => messages.push(msg));
      
      stageFactory.setMockStage(mockStage);
      await handler.execute('init', []);
      
      expect(messages.length).toBeGreaterThan(1);
      expect(messages.some(msg => msg.content.includes('initialization'))).toBe(true);
    });
  });
});