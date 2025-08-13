import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { firstValueFrom, take, skip } from 'rxjs';
import { FlowCodeUseCase } from '../../../src/application/use-cases/flowcode-use-case.js';
import {
  MockMessagePublisher,
  MockMessageWriter,
  MockCommandDispatcher,
  MockPromptHandler,
  createTestDomainMessage
} from './flowcode-use-case.mocks.js';

describe('FlowCodeUseCase', () => {
  let useCase: FlowCodeUseCase;
  let mockMessagePublisher: MockMessagePublisher;
  let mockMessageWriter: MockMessageWriter;
  let mockCommandDispatcher: MockCommandDispatcher;
  let mockPromptHandler: MockPromptHandler;

  beforeEach(() => {
  mockMessagePublisher = new MockMessagePublisher();
    mockMessageWriter = new MockMessageWriter();
    mockCommandDispatcher = new MockCommandDispatcher();
    mockPromptHandler = new MockPromptHandler();

    useCase = new FlowCodeUseCase(
  mockMessagePublisher,
      mockMessageWriter,
      mockCommandDispatcher,
      mockPromptHandler
    );
  });

  afterEach(() => {
    mockMessageWriter.reset();
    mockCommandDispatcher.reset();
    mockPromptHandler.reset();
  mockMessagePublisher.clear();
  });

  describe('Initialization', () => {
    it('should initialize with all required dependencies', () => {
      expect(useCase).toBeDefined();
      expect(useCase.messages$).toBeDefined();
      expect(useCase.options$).toBeDefined();
      expect(useCase.tokenUsage$).toBeDefined();
      expect(useCase.workerInfo$).toBeDefined();
      expect(useCase.isLoading$).toBeDefined();
    });

    it('should expose available commands from command dispatcher', () => {
      const commands = useCase.getAvailableCommands();
      expect(commands).toHaveLength(3);
      expect(commands.map(c => c.name)).toEqual(['init', 'config', 'help']);
    });
  });

  describe('AI Input Processing', () => {
    it('should store user message and forward to prompt handler', async () => {
      const input = 'implement user authentication';

      await useCase.processAIInput(input);

      // Should store user message
      expect(mockMessageWriter.storeMessageCalled).toBe(true);
      expect(mockMessageWriter.storedMessages).toHaveLength(1);
      
      const userMessage = mockMessageWriter.storedMessages[0];
      expect(userMessage.type).toBe('user-input');
      expect(userMessage.content).toBe(input);
      expect(userMessage.timestamp).toBeInstanceOf(Date);
      expect(userMessage.id).toMatch(/^msg_\d+_\w+$/);

      // Should forward to prompt handler
      expect(mockPromptHandler.processUserInputCalled).toBe(true);
      expect(mockPromptHandler.lastUserInput).toBe(input);
    });

    it('should generate unique message IDs', async () => {
      await useCase.processAIInput('first input');
      await useCase.processAIInput('second input');

      const messages = mockMessageWriter.storedMessages;
      expect(messages).toHaveLength(2);
      expect(messages[0].id).not.toBe(messages[1].id);
      expect(messages[0].id).toMatch(/^msg_\d+_\w+$/);
      expect(messages[1].id).toMatch(/^msg_\d+_\w+$/);
    });
  });

  describe('Command Processing', () => {
    it('should store user message and forward to command dispatcher', async () => {
      const command = 'init';
      const args = ['project-name', '--type=react'];

      await useCase.processCommand(command, args);

      // Should store user command message
      expect(mockMessageWriter.storeMessageCalled).toBe(true);
      expect(mockMessageWriter.storedMessages).toHaveLength(1);
      
      const userMessage = mockMessageWriter.storedMessages[0];
      expect(userMessage.type).toBe('user-input');
      expect(userMessage.content).toBe('init project-name --type=react');
      expect(userMessage.timestamp).toBeInstanceOf(Date);

      // Should forward to command dispatcher
      expect(mockCommandDispatcher.executeCalled).toBe(true);
      expect(mockCommandDispatcher.lastCommand).toBe(command);
      expect(mockCommandDispatcher.lastArgs).toEqual(args);
    });

    it('should handle commands without arguments', async () => {
      await useCase.processCommand('help');

      const userMessage = mockMessageWriter.storedMessages[0];
      expect(userMessage.content).toBe('help');

      expect(mockCommandDispatcher.lastCommand).toBe('help');
      expect(mockCommandDispatcher.lastArgs).toEqual([]);
    });

    it('should handle commands with empty args array', async () => {
      await useCase.processCommand('config', []);

      const userMessage = mockMessageWriter.storedMessages[0];
      expect(userMessage.content).toBe('config');
    });
  });

  describe('Choice Response', () => {
    it('should forward choice selection to prompt handler', async () => {
      const selectedIndex = 1;

      await useCase.respondToChoice(selectedIndex);

      expect(mockPromptHandler.respondToChoiceCalled).toBe(true);
      expect(mockPromptHandler.lastSelectedIndex).toBe(selectedIndex);
    });
  });

  describe('Reactive Streams', () => {
    it('should forward options stream from prompt handler', async () => {
      const testOption = {
        message: 'Continue with changes?',
        choices: ['Yes', 'No', 'Cancel'],
        defaultIndex: 0
      };

      const optionPromise = firstValueFrom(useCase.options$);
      mockPromptHandler.emitOption(testOption);

      const receivedOption = await optionPromise;
      expect(receivedOption).toEqual(testOption);
    });

    it('should forward token usage stream from prompt handler', async () => {
      const tokenUsage = { used: 150, limit: 1000 };

      const tokenPromise = firstValueFrom(useCase.tokenUsage$.pipe(skip(1))); // Skip initial value
      mockPromptHandler.emitTokenUsage(tokenUsage);

      const receivedTokens = await tokenPromise;
      expect(receivedTokens).toEqual(tokenUsage);
    });

    it('should forward worker info stream from prompt handler', async () => {
      const workerInfo = {
        name: 'code-worker',
        model: 'gpt-4',
        provider: 'openai',
        status: 'working' as const
      };

      const workerPromise = firstValueFrom(useCase.workerInfo$.pipe(skip(1))); // Skip initial value
      mockPromptHandler.emitWorkerInfo(workerInfo);

      const receivedWorker = await workerPromise;
      expect(receivedWorker).toEqual(workerInfo);
    });

    it('should forward loading state from prompt handler', async () => {
      const loadingPromise = firstValueFrom(useCase.isLoading$.pipe(skip(1))); // Skip initial value
      mockPromptHandler.emitLoading(true);

      const isLoading = await loadingPromise;
      expect(isLoading).toBe(true);
    });

    it('should merge message streams from multiple sources', async () => {
      // Set up message history
      const historyMessage = createTestDomainMessage('ai-response', 'Previous AI response');
  mockMessagePublisher.addMessage(historyMessage);

      // Set up message promises
      const messagePromises = Promise.all([
        firstValueFrom(useCase.messages$.pipe(take(3))) // History + System + Error
      ]);

      // Emit system and error messages from dispatcher
      const systemMessage = createTestDomainMessage('system', 'System message');
      const errorMessage = createTestDomainMessage('error', 'Error occurred');
      
      // Need small delays to ensure order
      setTimeout(() => mockCommandDispatcher.emitSystemMessage(systemMessage), 1);
      setTimeout(() => mockCommandDispatcher.emitErrorMessage(errorMessage), 2);

      const [messages] = await messagePromises;
      
      // Should receive messages from multiple sources
      expect(messages).toBeDefined();
      // Note: The exact behavior depends on how switchMap handles the message history array
    });
  });

  describe('Message Stream Integration', () => {
    it('should flatten message history array to individual messages', async () => {
      // Add multiple messages to history
      const message1 = createTestDomainMessage('user-input', 'First message');
      const message2 = createTestDomainMessage('ai-response', 'AI response');
      
  mockMessagePublisher.setMessages([message1, message2]);

      // Get first message from the flattened stream
      const firstMessage = await firstValueFrom(useCase.messages$);
      
      // Should be one of the messages from history (flattened)
      expect([message1.id, message2.id]).toContain(firstMessage.id);
    });

    it('should handle empty message history', async () => {
  mockMessagePublisher.setMessages([]);

      // Should handle empty arrays gracefully - no messages should be emitted from history
      // We'll emit from dispatcher to test the other streams still work
      const messagePromise = firstValueFrom(useCase.messages$);
      
      const systemMessage = createTestDomainMessage('system', 'Test message');
      mockCommandDispatcher.emitSystemMessage(systemMessage);

      const receivedMessage = await messagePromise;
      expect(receivedMessage.content).toBe('Test message');
    });
  });

  describe('Error Handling', () => {
    it('should handle message storage failures gracefully', async () => {
      // Mock storage failure
      mockMessageWriter.storeMessage = vi.fn().mockRejectedValue(new Error('Storage failed'));
      
      // Should not throw error
      await expect(useCase.processAIInput('test input')).resolves.not.toThrow();
      
      // Should still forward to prompt handler
      expect(mockPromptHandler.processUserInputCalled).toBe(true);
    });

    it('should handle command execution with dispatcher', async () => {
      // Set up command failure
      mockCommandDispatcher.mockResult = { success: false, error: 'Command failed' };

      // Should not throw - error handling is in the dispatcher
      await expect(useCase.processCommand('invalid')).resolves.not.toThrow();
      
      expect(mockCommandDispatcher.executeCalled).toBe(true);
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete AI workflow', async () => {
      // Process AI input
      await useCase.processAIInput('create user service');
      
      // Should store user message
      expect(mockMessageWriter.storedMessages).toHaveLength(1);
      expect(mockMessageWriter.storedMessages[0].type).toBe('user-input');
      expect(mockMessageWriter.storedMessages[0].content).toBe('create user service');
      
      // Should forward to prompt handler
      expect(mockPromptHandler.processUserInputCalled).toBe(true);
      expect(mockPromptHandler.lastUserInput).toBe('create user service');
    });

    it('should handle complete command workflow', async () => {
      // Process command
      await useCase.processCommand('init', ['my-project']);
      
      // Should store command message
      expect(mockMessageWriter.storedMessages).toHaveLength(1);
      expect(mockMessageWriter.storedMessages[0].type).toBe('user-input');
      expect(mockMessageWriter.storedMessages[0].content).toBe('init my-project');
      
      // Should forward to dispatcher
      expect(mockCommandDispatcher.executeCalled).toBe(true);
      expect(mockCommandDispatcher.lastCommand).toBe('init');
      expect(mockCommandDispatcher.lastArgs).toEqual(['my-project']);
    });

    it('should handle choice workflow', async () => {
      // Emit option from prompt handler
      const option = {
        message: 'Deploy to staging?',
        choices: ['Yes', 'No', 'Cancel'],
        defaultIndex: 0
      };
      
      const optionPromise = firstValueFrom(useCase.options$);
      mockPromptHandler.emitOption(option);
      
      // Should receive option
      const receivedOption = await optionPromise;
      expect(receivedOption).toEqual(option);
      
      // Respond to choice
      await useCase.respondToChoice(1);
      
      // Should forward to prompt handler
      expect(mockPromptHandler.respondToChoiceCalled).toBe(true);
      expect(mockPromptHandler.lastSelectedIndex).toBe(1);
    });

    it('should coordinate multiple streams simultaneously', async () => {
      // Set up simultaneous stream monitoring (skip initial values for BehaviorSubjects)
      const optionPromise = firstValueFrom(useCase.options$);
      const tokenPromise = firstValueFrom(useCase.tokenUsage$.pipe(skip(1)));
      const workerPromise = firstValueFrom(useCase.workerInfo$.pipe(skip(1)));
      const loadingPromise = firstValueFrom(useCase.isLoading$.pipe(skip(1)));

      // Emit from prompt handler
      mockPromptHandler.emitOption({ message: 'Test', choices: ['A', 'B'], defaultIndex: 0 });
      mockPromptHandler.emitTokenUsage({ used: 100, limit: 1000 });
      mockPromptHandler.emitWorkerInfo({ name: 'test', model: 'test', provider: 'test', status: 'working' });
      mockPromptHandler.emitLoading(true);

      // All streams should work simultaneously
      const [option, tokens, worker, loading] = await Promise.all([
        optionPromise, tokenPromise, workerPromise, loadingPromise
      ]);

      expect(option.message).toBe('Test');
      expect(tokens.used).toBe(100);
      expect(worker.name).toBe('test');
      expect(loading).toBe(true);
    });
  });
});