import { BehaviorSubject, Subject } from 'rxjs';
import { TUIRouter } from '../../../../src/presentation/view-models/tui/tui-router.js';
import { 
  TUIUseCase, 
  DomainMessage, 
  DomainOption, 
  CommandDefinition,
  DomainTokenUsage, 
  DomainWorkerInfo 
} from '../../../../src/presentation/view-models/tui/tui-use-case.js';

/**
 * Mock TUIRouter for testing
 */
export class MockTUIRouter implements TUIRouter {
  public navigateToConsoleCalled = false;
  public exitCalled = false;

  navigateToConsole(): void {
    this.navigateToConsoleCalled = true;
  }

  exit(): void {
    this.exitCalled = true;
  }

  reset(): void {
    this.navigateToConsoleCalled = false;
    this.exitCalled = false;
  }
}

/**
 * Mock TUIUseCase for testing (extends ConsoleUseCase with TUI-specific streams)
 */
export class MockTUIUseCase implements TUIUseCase {
  private readonly messagesSubject = new Subject<DomainMessage>();
  private readonly optionsSubject = new Subject<DomainOption>();
  private readonly tokenUsageSubject = new BehaviorSubject<DomainTokenUsage>({ used: 0, limit: 10000 });
  private readonly workerInfoSubject = new BehaviorSubject<DomainWorkerInfo>({ 
    name: 'test-worker', 
    model: 'test-model', 
    provider: 'test-provider', 
    status: 'idle' 
  });
  private readonly isLoadingSubject = new BehaviorSubject<boolean>(false);

  public processAIInputCalled = false;
  public processCommandCalled = false;
  public lastAIInput = '';
  public lastCommand = '';
  public lastCommandArgs: string[] = [];
  public currentOptions: string[] = [];
  public lastSelectedIndex = -1;

  private readonly mockCommands: CommandDefinition[] = [
    { name: 'init', description: 'Initialize project', aliases: ['i'] },
    { name: 'config', description: 'Configure settings', aliases: ['cfg'] },
    { name: 'validate', description: 'Validate configuration', aliases: ['v'] },
    { name: 'help', description: 'Show help' }
  ];

  get messages$() {
    return this.messagesSubject.asObservable();
  }

  get options$() {
    return this.optionsSubject.asObservable();
  }

  get tokenUsage$() {
    return this.tokenUsageSubject.asObservable();
  }

  get workerInfo$() {
    return this.workerInfoSubject.asObservable();
  }

  get isLoading$() {
    return this.isLoadingSubject.asObservable();
  }

  async processAIInput(input: string): Promise<void> {
    this.processAIInputCalled = true;
    this.lastAIInput = input;
  }

  async processCommand(command: string, args: string[] = []): Promise<void> {
    this.processCommandCalled = true;
    this.lastCommand = command;
    this.lastCommandArgs = args;
  }

  async respondToChoice(selectedIndex: number): Promise<void> {
    this.lastSelectedIndex = selectedIndex;
    
    // Mock implementation - emit a message about the choice using actual option text
    const selectedOption = this.currentOptions[selectedIndex] || `option ${selectedIndex}`;
    const mockChoiceMessage: DomainMessage = {
      id: `choice-${Date.now()}`,
      type: 'system',
      content: `You selected: ${selectedOption}`,
      timestamp: new Date()
    };
    this.messagesSubject.next(mockChoiceMessage);
  }

  getAvailableCommands(): CommandDefinition[] {
    return this.mockCommands;
  }

  // Test helper methods
  emitMessage(message: DomainMessage): void {
    this.messagesSubject.next(message);
  }

  emitOption(option: DomainOption): void {
    this.currentOptions = option.choices; // Track the options for respondToChoice
    this.optionsSubject.next(option);
  }

  emitTokenUsage(tokenUsage: DomainTokenUsage): void {
    this.tokenUsageSubject.next(tokenUsage);
  }

  emitWorkerInfo(workerInfo: DomainWorkerInfo): void {
    this.workerInfoSubject.next(workerInfo);
  }

  emitLoading(isLoading: boolean): void {
    this.isLoadingSubject.next(isLoading);
  }

  emitError(error: Error): void {
    this.messagesSubject.error(error);
  }

  reset(): void {
    this.processAIInputCalled = false;
    this.processCommandCalled = false;
    this.lastAIInput = '';
    this.lastCommand = '';
    this.lastCommandArgs = [];
  }
}

/**
 * Helper functions from console mocks (reuse)
 */
export function createDomainMessage(
  type: DomainMessage['type'],
  content: string,
  metadata?: any
): DomainMessage {
  const base = {
    id: `test-${Date.now()}`,
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
          ...metadata
        }
      } as any;
    
    case 'error':
      return {
        ...base,
        type,
        metadata: {
          errorCode: 'TEST_ERROR',
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
          ...metadata
        }
      } as any;
    
    default:
      throw new Error(`Unknown message type: ${type}`);
  }
}

export function createDomainOption(
  message: string,
  choices: string[] = ['Yes', 'No'],
  defaultIndex: number = 0
): DomainOption {
  return {
    message,
    choices,
    defaultIndex
  };
}