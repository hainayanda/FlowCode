import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { firstValueFrom, take, toArray } from 'rxjs';
import { ConsoleViewModel } from '../../../../src/presentation/view-models/console/console-view-model.js';
import { ConsoleMessage } from '../../../../src/presentation/model/message.js';
import { 
  MockConsoleRouter, 
  MockConsoleUseCase, 
  createDomainMessage, 
  createDomainOption 
} from './console-view-model.mocks.js';

describe('ConsoleViewModel', () => {
  let viewModel: ConsoleViewModel;
  let mockRouter: MockConsoleRouter;
  let mockUseCase: MockConsoleUseCase;

  beforeEach(() => {
    mockRouter = new MockConsoleRouter();
    mockUseCase = new MockConsoleUseCase();
    viewModel = new ConsoleViewModel(mockRouter, mockUseCase);
  });

  afterEach(() => {
    mockRouter.reset();
    mockUseCase.reset();
  });

  describe('Initialization', () => {
    it('should initialize with available commands from use case', () => {
      expect(mockUseCase.getAvailableCommands()).toHaveLength(4);
      expect(mockUseCase.getAvailableCommands().map(c => c.name)).toEqual([
        'init', 'config', 'workers', 'help'
      ]);
    });

    it('should expose reactive state streams', () => {
      expect(viewModel.messages$).toBeDefined();
      expect(viewModel.inputText$).toBeDefined();
      expect(viewModel.options$).toBeDefined();
    });

    it('should start with empty input text', async () => {
      const inputText = await firstValueFrom(viewModel.inputText$);
      expect(inputText).toBe('');
    });
  });

  describe('User Input Processing', () => {
    describe('Command Detection and Routing', () => {
      it('should route command input to processCommand', async () => {
        await viewModel.onUserInput('init project-name');
        
        expect(mockUseCase.processCommandCalled).toBe(true);
        expect(mockUseCase.processAIInputCalled).toBe(false);
        expect(mockUseCase.lastCommand).toBe('init');
        expect(mockUseCase.lastCommandArgs).toEqual(['project-name']);
      });

      it('should route command alias to processCommand', async () => {
        await viewModel.onUserInput('i project-name');
        
        expect(mockUseCase.processCommandCalled).toBe(true);
        expect(mockUseCase.lastCommand).toBe('i');
        expect(mockUseCase.lastCommandArgs).toEqual(['project-name']);
      });

      it('should route non-command input to processAIInput', async () => {
        await viewModel.onUserInput('implement user authentication');
        
        expect(mockUseCase.processAIInputCalled).toBe(true);
        expect(mockUseCase.processCommandCalled).toBe(false);
        expect(mockUseCase.lastAIInput).toBe('implement user authentication');
      });

      it('should handle empty input gracefully', async () => {
        await viewModel.onUserInput('');
        await viewModel.onUserInput('   ');
        
        expect(mockUseCase.processAIInputCalled).toBe(false);
        expect(mockUseCase.processCommandCalled).toBe(false);
      });
    });

    describe('Special Router Commands', () => {
      it('should navigate to TUI on "tui" command', async () => {
        await viewModel.onUserInput('tui');
        
        expect(mockRouter.navigateToTUICalled).toBe(true);
        expect(mockUseCase.processCommandCalled).toBe(false);
        expect(mockUseCase.processAIInputCalled).toBe(false);
      });

      it('should handle tui command with extra spaces', async () => {
        await viewModel.onUserInput('  tui  ');
        
        expect(mockRouter.navigateToTUICalled).toBe(true);
      });
    });
  });

  describe('Input History Management', () => {
    beforeEach(async () => {
      // Add some history items
      await viewModel.onUserInput('first command');
      await viewModel.onUserInput('second command');
      await viewModel.onUserInput('third command');
    });

    it('should navigate up through history', async () => {
      viewModel.onUpArrow();
      let inputText = await firstValueFrom(viewModel.inputText$);
      expect(inputText).toBe('third command');

      viewModel.onUpArrow();
      inputText = await firstValueFrom(viewModel.inputText$);
      expect(inputText).toBe('second command');

      viewModel.onUpArrow();
      inputText = await firstValueFrom(viewModel.inputText$);
      expect(inputText).toBe('first command');
    });

    it('should not go beyond history bounds when navigating up', async () => {
      // Go up through all history
      viewModel.onUpArrow();
      viewModel.onUpArrow();
      viewModel.onUpArrow();
      viewModel.onUpArrow(); // Beyond bounds
      
      const inputText = await firstValueFrom(viewModel.inputText$);
      expect(inputText).toBe('first command'); // Should stay at first
    });

    it('should navigate down through history', async () => {
      // Go up first
      viewModel.onUpArrow();
      viewModel.onUpArrow();
      
      // Then down
      viewModel.onDownArrow();
      const inputText = await firstValueFrom(viewModel.inputText$);
      expect(inputText).toBe('third command');
    });

    it('should clear input when navigating down beyond current', async () => {
      viewModel.onUpArrow();
      viewModel.onDownArrow();
      
      const inputText = await firstValueFrom(viewModel.inputText$);
      expect(inputText).toBe('');
    });

    it('should handle empty history gracefully', () => {
      const emptyViewModel = new ConsoleViewModel(new MockConsoleRouter(), new MockConsoleUseCase());
      
      // Should not throw
      expect(() => emptyViewModel.onUpArrow()).not.toThrow();
      expect(() => emptyViewModel.onDownArrow()).not.toThrow();
    });

    it('should not add duplicate consecutive entries to history', async () => {
      await viewModel.onUserInput('duplicate');
      await viewModel.onUserInput('duplicate');
      
      // Should only be one entry for the duplicate
      viewModel.onUpArrow();
      const firstInput = await firstValueFrom(viewModel.inputText$);
      
      viewModel.onUpArrow();
      const secondInput = await firstValueFrom(viewModel.inputText$);
      
      expect(firstInput).toBe('duplicate');
      expect(secondInput).toBe('third command'); // Previous unique entry
    });
  });

  describe('Message Transformation', () => {
    it('should transform plain domain messages correctly', async () => {
      const messagePromise = firstValueFrom(viewModel.messages$);
      
      mockUseCase.emitMessage(createDomainMessage('user-input', 'Hello'));
      const message = await messagePromise;
      
      expect(message).toBeInstanceOf(ConsoleMessage);
      expect(message.type).toBe('user');
      expect(message.content).toBe('Hello');
    });

    it('should transform AI response messages correctly', async () => {
      const messagePromise = firstValueFrom(viewModel.messages$);
      
      mockUseCase.emitMessage(createDomainMessage('ai-response', 'AI response', {
        workerId: 'code-worker',
        isStreaming: true
      }));
      const message = await messagePromise;
      
      expect(message.type).toBe('worker');
      expect(message.content).toBe('AI response');
      expect((message.metadata as any)?.workerId).toBe('code-worker');
      expect((message.metadata as any)?.isStreaming).toBe(true);
    });

    it('should transform thinking messages correctly', async () => {
      const messagePromise = firstValueFrom(viewModel.messages$);
      
      mockUseCase.emitMessage(createDomainMessage('ai-thinking', 'Processing...', {
        workerId: 'taskmaster'
      }));
      const message = await messagePromise;
      
      expect(message.type).toBe('thinking');
      expect(message.content).toBe('Processing...');
      expect((message.metadata as any)?.workerId).toBe('taskmaster');
    });

    it('should transform error messages correctly', async () => {
      const messagePromise = firstValueFrom(viewModel.messages$);
      
      mockUseCase.emitMessage(createDomainMessage('error', 'Something went wrong', {
        errorCode: 'ERR_001',
        recoverable: true
      }));
      const message = await messagePromise;
      
      expect(message.type).toBe('error');
      expect(message.content).toBe('Something went wrong');
      expect((message.metadata as any)?.errorCode).toBe('ERR_001');
      expect((message.metadata as any)?.recoverable).toBe(true);
    });

    it('should transform file operation messages correctly', async () => {
      const messagePromise = firstValueFrom(viewModel.messages$);
      
      mockUseCase.emitMessage(createDomainMessage('file-operation', 'File edited', {
        filePath: '/src/test.ts',
        fileOperation: 'edit',
        totalLinesAdded: 5,
        totalLinesRemoved: 2
      }));
      const message = await messagePromise;
      
      expect(message.type).toBe('file');
      expect(message.content).toBe('File edited');
      expect((message.metadata as any)?.filePath).toBe('/src/test.ts');
      expect((message.metadata as any)?.fileOperation).toBe('edit');
      expect((message.metadata as any)?.totalLinesAdded).toBe(5);
      expect((message.metadata as any)?.totalLinesRemoved).toBe(2);
    });
  });

  describe('Option Handling', () => {
    it('should transform domain options correctly', async () => {
      const optionPromise = firstValueFrom(viewModel.options$);
      
      mockUseCase.emitOption(createDomainOption(
        'Continue with operation?',
        ['Yes', 'No', 'Always'],
        1
      ));
      const option = await optionPromise;
      
      expect(option.message).toBe('Continue with operation?');
      expect(option.options).toEqual(['Yes', 'No', 'Always']);
      expect(option.selectedIndex).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle message stream errors gracefully', async () => {
      const messagePromise = firstValueFrom(viewModel.messages$);
      
      mockUseCase.emitError(new Error('Stream error'));
      const message = await messagePromise;
      
      expect(message.type).toBe('error');
      expect(message.content).toContain('Stream error');
    });

    it('should handle input processing errors', async () => {
      // Mock use case to throw error
      mockUseCase.processAIInput = vi.fn().mockRejectedValue(new Error('Processing failed'));
      
      const messagePromise = firstValueFrom(viewModel.messages$);
      
      await viewModel.onUserInput('test input');
      
      const message = await messagePromise;
      expect(message.type).toBe('error');
      expect(message.content).toContain('Processing failed');
    });
  });

  describe('Exit Handling', () => {
    it('should delegate exit to router', () => {
      viewModel.onExit();
      
      expect(mockRouter.exitCalled).toBe(true);
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle multiple messages in sequence', async () => {
      const messages: ConsoleMessage[] = [];
      viewModel.messages$.pipe(take(3), toArray()).subscribe(msgs => {
        messages.push(...msgs);
      });
      
      mockUseCase.emitMessage(createDomainMessage('user-input', 'First'));
      mockUseCase.emitMessage(createDomainMessage('ai-response', 'Second', { workerId: 'test' }));
      mockUseCase.emitMessage(createDomainMessage('system', 'Third'));
      
      await new Promise(resolve => setTimeout(resolve, 10)); // Wait for async processing
      
      expect(messages).toHaveLength(3);
      expect(messages[0].type).toBe('user');
      expect(messages[1].type).toBe('worker');
      expect(messages[2].type).toBe('system');
    });

    it('should reset input text after successful input processing', async () => {
      await viewModel.onUserInput('test input');
      
      const inputText = await firstValueFrom(viewModel.inputText$);
      expect(inputText).toBe('');
    });
  });
});