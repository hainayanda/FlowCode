import { BehaviorSubject, Subject } from 'rxjs';
import { DomainMessage, DomainOption, CommandDefinition } from '../../../src/presentation/view-models/console/console-use-case.js';
import { DomainTokenUsage, DomainWorkerInfo } from '../../../src/presentation/model/use-case-models.js';
import { MessageStorePublisher, MessageWriter } from '../../../src/application/interfaces/message-store.js';
import { CommandDispatcher, CommandResult } from '../../../src/application/interfaces/command-provider.js';
import { PromptHandler } from '../../../src/application/interfaces/prompt-handler.js';
import { Initializer, InitializationState, InitializationStep, InitializationOptions } from '../../../src/application/interfaces/initializer.js';
import { Result } from '../../../src/application/shared/result.js';

/**
 * Mock MessageStorePublisher for testing (full implementation of the complete interface)
 * Implements MessageStorePublisher which includes MessageStore + MessagePublisher responsibilities.
 */
export class MockMessagePublisher implements MessageStorePublisher {
  private messages: DomainMessage[] = [];
  private readonly messageHistorySubject = new BehaviorSubject<DomainMessage[]>([]);
  
  // Track method calls for testing
  public initializeCalled = false;
  public storeMessageCalled = false;
  public storeMessagesCalled = false;
  public updateMessageCalled = false;
  public clearHistoryCalled = false;

  // MessagePublisher interface
  get messageHistory$() {
    return this.messageHistorySubject.asObservable();
  }

  // MessageReader interface  
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

  // MessageWriter interface
  async storeMessage(message: DomainMessage): Promise<void> {
    this.storeMessageCalled = true;
    
    // Replace if same ID exists (for streaming)
    const existingIndex = this.messages.findIndex(msg => msg.id === message.id);
    if (existingIndex >= 0) {
      this.messages[existingIndex] = message;
    } else {
      this.messages.push(message);
    }
    this.messageHistorySubject.next([...this.messages]);
  }

  async storeMessages(messages: DomainMessage[]): Promise<void> {
    this.storeMessagesCalled = true;
    for (const message of messages) {
      await this.storeMessage(message);
    }
  }

  async updateMessage(messageId: string, updates: Partial<DomainMessage>): Promise<void> {
    this.updateMessageCalled = true;
    const index = this.messages.findIndex(msg => msg.id === messageId);
    if (index >= 0) {
      const existing = this.messages[index];
      const updated = { ...existing, ...updates, type: existing.type } as DomainMessage;
      this.messages[index] = updated;
      this.messageHistorySubject.next([...this.messages]);
    }
  }

  async clearHistory(): Promise<void> {
    this.clearHistoryCalled = true;
    this.messages = [];
    this.messageHistorySubject.next([]);
  }

  // MessageStore interface
  async initialize(): Promise<void> {
    this.initializeCalled = true;
  }

  async getAllMessages(): Promise<DomainMessage[]> {
    return [...this.messages];
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
    // Reset call tracking
    this.initializeCalled = false;
    this.storeMessageCalled = false;
    this.storeMessagesCalled = false;
    this.updateMessageCalled = false;
    this.clearHistoryCalled = false;
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

  // Test helpers
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
 * Mock Initializer for testing
 */
export class MockInitializer implements Initializer {
  private readonly messagesSubject = new Subject<DomainMessage>();
  private readonly optionsSubject = new Subject<DomainOption>();
  private readonly completionSubject = new Subject<{ state: InitializationState; error?: string }>();
  private currentState = InitializationState.NotStarted;
  
  public startCalled = false;
  public processResponseCalled = false;
  public processOptionSelectionCalled = false;
  public createProjectStructureCalled = false;
  public generateMarkdownFilesCalled = false;
  public validateCurrentDirectoryCalled = false;
  public isCurrentDirectoryInitializedCalled = false;
  public resetCalled = false;
  public lastResponse = '';
  public lastOptionIndex = -1;
  public mockIsInitialized = false;

  get messages$() {
    return this.messagesSubject.asObservable();
  }

  get options$() {
    return this.optionsSubject.asObservable();
  }

  get completion$() {
    return this.completionSubject.asObservable();
  }

  getState(): InitializationState {
    return this.currentState;
  }

  start(): Result<void, string> {
    this.startCalled = true;
    this.currentState = InitializationState.InProgress;
    return Result.success(undefined);
  }

  processResponse(response: string): Result<void, string> {
    this.processResponseCalled = true;
    this.lastResponse = response;
    return Result.success(undefined);
  }

  processOptionSelection(optionIndex: number): Result<void, string> {
    this.processOptionSelectionCalled = true;
    this.lastOptionIndex = optionIndex;
    return Result.success(undefined);
  }

  async createProjectStructure(): Promise<Result<void, string>> {
    this.createProjectStructureCalled = true;
    return Result.success(undefined);
  }

  async generateMarkdownFiles(_options: InitializationOptions): Promise<Result<void, string>> {
    this.generateMarkdownFilesCalled = true;
    return Result.success(undefined);
  }

  getInitializationSteps(): InitializationStep[] {
    return [
      { name: 'setup', description: 'Setup project', completed: false },
      { name: 'config', description: 'Configure settings', completed: false }
    ];
  }

  validateCurrentDirectory(): Result<void, string> {
    this.validateCurrentDirectoryCalled = true;
    return Result.success(undefined);
  }

  isCurrentDirectoryInitialized(): boolean {
    this.isCurrentDirectoryInitializedCalled = true;
    return this.mockIsInitialized;
  }

  reset(): void {
    this.resetCalled = true;
    this.currentState = InitializationState.NotStarted;
  }

  // Test helpers
  setState(state: InitializationState): void {
    this.currentState = state;
  }

  emitMessage(message: DomainMessage): void {
    this.messagesSubject.next(message);
  }

  emitOption(option: DomainOption): void {
    this.optionsSubject.next(option);
  }

  emitCompletion(state: InitializationState, error?: string): void {
    this.completionSubject.next({ state, error });
  }

  resetTracking(): void {
    this.startCalled = false;
    this.processResponseCalled = false;
    this.processOptionSelectionCalled = false;
    this.createProjectStructureCalled = false;
    this.generateMarkdownFilesCalled = false;
    this.validateCurrentDirectoryCalled = false;
    this.isCurrentDirectoryInitializedCalled = false;
    this.resetCalled = false;
    this.lastResponse = '';
    this.lastOptionIndex = -1;
    this.mockIsInitialized = false;
  }
}

/**
 * Helper function to create test domain messages
 */
export function createTestDomainMessage(
  type: DomainMessage['type'],
  content: string,
  metadata?: Record<string, unknown>
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