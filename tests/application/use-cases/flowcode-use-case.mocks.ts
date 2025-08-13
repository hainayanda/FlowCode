import { BehaviorSubject, Subject } from 'rxjs';
import { DomainMessage, DomainOption, CommandDefinition } from '../../../src/presentation/view-models/console/console-use-case.js';
import { DomainTokenUsage, DomainWorkerInfo } from '../../../src/presentation/view-models/shared-use-case.js';
import { MessagePublisher, MessageWriter } from '../../../src/application/interfaces/message-store.js';
import { CommandDispatcher, CommandResult } from '../../../src/application/interfaces/command-provider.js';
import { PromptHandler } from '../../../src/application/interfaces/prompt-handler.js';

/**
 * Mock MessagePublisher for testing (exposes messageHistory$ stream only + read helpers used by tests)
 * Implements the newly separated MessagePublisher responsibilities.
 */
export class MockMessagePublisher implements MessagePublisher {
  private messages: DomainMessage[] = [];
  private readonly messageHistorySubject = new BehaviorSubject<DomainMessage[]>([]);

  get messageHistory$() {
    return this.messageHistorySubject.asObservable();
  }

  async getMessageHistory(limit?: number): Promise<DomainMessage[]> {
    return limit ? this.messages.slice(-limit) : this.messages;
  }

  async getMessagesByType(type: DomainMessage['type']): Promise<DomainMessage[]> {
    return this.messages.filter(msg => msg.type === type);
  }

  async searchByRegex(pattern: string, limit?: number, type?: DomainMessage['type']): Promise<DomainMessage[]> {
    const regex = new RegExp(pattern, 'i');
    let results = this.messages.filter(msg => regex.test(msg.content));
    if (type) {
      results = results.filter(msg => msg.type === type);
    }
    return limit ? results.slice(0, limit) : results;
  }

  async getMessageById(messageId: string): Promise<DomainMessage | null> {
    return this.messages.find(msg => msg.id === messageId) || null;
  }

  // Test helpers
  setMessages(messages: DomainMessage[]): void {
    this.messages = messages;
    this.messageHistorySubject.next([...messages]);
  }

  addMessage(message: DomainMessage): void {
    this.messages.push(message);
    this.messageHistorySubject.next([...this.messages]);
  }

  clear(): void {
    this.messages = [];
    this.messageHistorySubject.next([]);
  }
}

/**
 * Mock MessageWriter for testing
 */
export class MockMessageWriter implements MessageWriter {
  public storedMessages: DomainMessage[] = [];
  public storeMessageCalled = false;
  public updateMessageCalled = false;
  public clearHistoryCalled = false;

  async storeMessage(message: DomainMessage): Promise<void> {
    this.storeMessageCalled = true;
    
    // Replace if same ID exists (for streaming)
    const existingIndex = this.storedMessages.findIndex(msg => msg.id === message.id);
    if (existingIndex >= 0) {
      this.storedMessages[existingIndex] = message;
    } else {
      this.storedMessages.push(message);
    }
  }

  async storeMessages(messages: DomainMessage[]): Promise<void> {
    for (const message of messages) {
      await this.storeMessage(message);
    }
  }

  async updateMessage(messageId: string, updates: Partial<DomainMessage>): Promise<void> {
    this.updateMessageCalled = true;
    const index = this.storedMessages.findIndex(msg => msg.id === messageId);
    if (index >= 0) {
  const existing = this.storedMessages[index];
  const updated = { ...existing, ...updates, type: existing.type } as DomainMessage; // preserve discriminant
  this.storedMessages[index] = updated;
    }
  }

  async clearHistory(): Promise<void> {
    this.clearHistoryCalled = true;
    this.storedMessages = [];
  }

  // Test helpers
  reset(): void {
    this.storedMessages = [];
    this.storeMessageCalled = false;
    this.updateMessageCalled = false;
    this.clearHistoryCalled = false;
  }
}

/**
 * Mock CommandDispatcher for testing
 */
export class MockCommandDispatcher implements CommandDispatcher {
  private readonly systemMessagesSubject = new Subject<DomainMessage>();
  private readonly errorMessagesSubject = new Subject<DomainMessage>();

  public executeCalled = false;
  public lastCommand = '';
  public lastArgs: string[] = [];
  public mockResult: CommandResult = { success: true, message: 'Mock command executed' };

  private readonly mockCommands: CommandDefinition[] = [
    { name: 'init', description: 'Initialize project', aliases: ['i'] },
    { name: 'config', description: 'Configure settings' },
    { name: 'help', description: 'Show help' }
  ];

  async execute(command: string, args: string[] = []): Promise<CommandResult> {
    this.executeCalled = true;
    this.lastCommand = command;
    this.lastArgs = args;
    return this.mockResult;
  }

  getCommands(): CommandDefinition[] {
    return this.mockCommands;
  }

  supports(command: string): boolean {
    return this.mockCommands.some(cmd => 
      cmd.name === command || (cmd.aliases && cmd.aliases.includes(command))
    );
  }

  get systemMessages$() {
    return this.systemMessagesSubject.asObservable();
  }

  get errorMessages$() {
    return this.errorMessagesSubject.asObservable();
  }

  // Test helpers
  emitSystemMessage(message: DomainMessage): void {
    this.systemMessagesSubject.next(message);
  }

  emitErrorMessage(message: DomainMessage): void {
    this.errorMessagesSubject.next(message);
  }

  reset(): void {
    this.executeCalled = false;
    this.lastCommand = '';
    this.lastArgs = [];
    this.mockResult = { success: true, message: 'Mock command executed' };
  }
}

/**
 * Mock PromptHandler for testing
 */
export class MockPromptHandler implements PromptHandler {
  private readonly optionsSubject = new Subject<DomainOption>();
  private readonly tokenUsageSubject = new BehaviorSubject<DomainTokenUsage>({ used: 0, limit: 10000 });
  private readonly currentWorkerSubject = new BehaviorSubject<DomainWorkerInfo>({
    name: 'test-worker',
    model: 'test-model',
    provider: 'test-provider',
    status: 'idle'
  });
  private readonly isProcessingSubject = new BehaviorSubject<boolean>(false);
  private readonly pendingMessagesSubject = new BehaviorSubject<any[]>([]);

  public processUserInputCalled = false;
  public lastUserInput = '';
  public respondToChoiceCalled = false;
  public lastSelectedIndex = -1;
  public cancelAllRequestsCalled = false;

  async processUserInput(input: string): Promise<void> {
    this.processUserInputCalled = true;
    this.lastUserInput = input;
  }

  async cancelAllRequests(): Promise<void> {
    this.cancelAllRequestsCalled = true;
  }

  async respondToChoice(selectedIndex: number): Promise<void> {
    this.respondToChoiceCalled = true;
    this.lastSelectedIndex = selectedIndex;
  }

  get pendingUserMessages$() {
    return this.pendingMessagesSubject.asObservable();
  }

  get isProcessing() {
    return this.isProcessingSubject.asObservable();
  }

  get currentWorker$() {
    return this.currentWorkerSubject.asObservable();
  }

  get tokenUsage$() {
    return this.tokenUsageSubject.asObservable();
  }

  get options$() {
    return this.optionsSubject.asObservable();
  }

  getQueueStatus() {
    return {
      pendingCount: 0,
      isProcessing: false
    };
  }

  // Test helpers
  emitOption(option: DomainOption): void {
    this.optionsSubject.next(option);
  }

  emitTokenUsage(tokenUsage: DomainTokenUsage): void {
    this.tokenUsageSubject.next(tokenUsage);
  }

  emitWorkerInfo(workerInfo: DomainWorkerInfo): void {
    this.currentWorkerSubject.next(workerInfo);
  }

  emitLoading(isLoading: boolean): void {
    this.isProcessingSubject.next(isLoading);
  }

  reset(): void {
    this.processUserInputCalled = false;
    this.lastUserInput = '';
    this.respondToChoiceCalled = false;
    this.lastSelectedIndex = -1;
    this.cancelAllRequestsCalled = false;
  }
}

/**
 * Helper function to create test domain messages
 */
export function createTestDomainMessage(
  type: DomainMessage['type'],
  content: string,
  metadata?: any
): DomainMessage {
  const base = {
    id: `test-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
    content,
    timestamp: new Date()
  };

  switch (type) {
    case 'user-input':
    case 'system':
      return { ...base, type } as any;
    
    case 'ai-response':
    case 'ai-thinking':
      return {
        ...base,
        type,
        metadata: {
          workerId: 'test-worker',
          isStreaming: false,
          ...metadata
        }
      } as any;
    
    case 'error':
      return {
        ...base,
        type,
        metadata: {
          errorCode: 'TEST_ERROR',
          recoverable: true,
          ...metadata
        }
      } as any;
    
    case 'file-operation':
      return {
        ...base,
        type,
        metadata: {
          filePath: '/test/file.ts',
          fileOperation: 'edit',
          diffs: [],
          totalLinesAdded: 0,
          totalLinesRemoved: 0,
          ...metadata
        }
      } as any;
    
    case 'user-choice':
      return {
        ...base,
        type,
        metadata: {
          choices: ['Yes', 'No'],
          selectedIndex: -1,
          prompt: 'Test choice',
          ...metadata
        }
      } as any;
    
    default:
      throw new Error(`Unknown message type: ${type}`);
  }
}