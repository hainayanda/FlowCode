import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { ConsoleViewState, ConsoleViewListener } from '../../views/console/console-contracts.js';
import { ConsoleMessage } from '../../model/message.js';
import { Option } from '../../model/option.js';
import { ConsoleRouter } from './console-router.js';
import { ConsoleUseCase, DomainMessage, DomainOption, CommandDefinition } from './console-use-case.js';

/**
 * Console ViewModel implementing MVVM pattern
 * Depends only on router and use case, following dependency injection
 */
export class ConsoleViewModel implements ConsoleViewState, ConsoleViewListener {
  // Private properties
  private readonly messageSubject = new Subject<ConsoleMessage>();
  private readonly inputTextSubject = new BehaviorSubject<string>('');
  private readonly optionSubject = new Subject<Option>();
  private readonly inputHistory: string[] = [];
  private historyIndex = -1;
  private allowInput = true;
  private readonly availableCommands: CommandDefinition[];

  // Public getters - ConsoleViewState implementation
  get messages$(): Observable<ConsoleMessage> {
    return this.messageSubject.asObservable();
  }

  get inputText$(): Observable<string> {
    return this.inputTextSubject.asObservable();
  }

  get options$(): Observable<Option> {
    return this.optionSubject.asObservable();
  }

  constructor(
    private readonly router: ConsoleRouter,
    private readonly useCase: ConsoleUseCase
  ) {
    this.availableCommands = this.useCase.getAvailableCommands();
    this.setupMessageSubscription();
    this.setupOptionSubscription();
  }

  // Public methods - ConsoleViewListener implementation
  async onUserInput(input: string): Promise<void> {
    if (!this.allowInput || !input.trim()) return;

    try {
      // Add to history
      this.addToHistory(input);
      this.resetHistoryNavigation();

      const trimmedInput = input.trim();

      // Handle special router command for TUI
      if (trimmedInput === 'tui') {
        this.router.navigateToTUI();
        return;
      }

      // Determine if input is a command or AI input
      if (this.isCommand(trimmedInput)) {
        await this.processAsCommand(trimmedInput);
      } else {
        await this.useCase.processAIInput(trimmedInput);
      }
    } catch (error) {
      this.handleError(error);
    }
  }

  onUpArrow(): void {
    if (this.inputHistory.length === 0) return;
    
    this.historyIndex = Math.min(this.historyIndex + 1, this.inputHistory.length - 1);
    const historicInput = this.inputHistory[this.inputHistory.length - 1 - this.historyIndex];
    this.inputTextSubject.next(historicInput);
  }

  onDownArrow(): void {
    if (this.historyIndex <= 0) {
      this.historyIndex = -1;
      this.inputTextSubject.next('');
      return;
    }
    
    this.historyIndex = Math.max(this.historyIndex - 1, 0);
    const historicInput = this.inputHistory[this.inputHistory.length - 1 - this.historyIndex];
    this.inputTextSubject.next(historicInput);
  }

  onExit(): void {
    this.router.exit();
  }

  /**
   * Handle option selection - called when user selects an option
   */
  async selectOption(selectedIndex: number): Promise<void> {
    try {
      await this.useCase.respondToChoice(selectedIndex);
      
      // Re-enable input after option selection
      this.allowInput = true;
    } catch (error) {
      this.handleError(error);
    }
  }

  // Private methods
  private setupMessageSubscription(): void {
    this.useCase.messages$
      .pipe(
        map((domainMessage: DomainMessage) => this.transformToConsoleMessage(domainMessage)),
        catchError((error) => {
          this.handleError(error);
          return [];
        })
      )
      .subscribe((consoleMessage: ConsoleMessage) => {
        this.messageSubject.next(consoleMessage);
      });
  }

  private setupOptionSubscription(): void {
    this.useCase.options$
      .pipe(
        map((domainOption: DomainOption) => this.transformToOption(domainOption)),
        tap(() => {
          // Block input while options are displayed
          this.allowInput = false;
        }),
        catchError((error) => {
          this.handleError(error);
          return [];
        })
      )
      .subscribe((option: Option) => {
        this.optionSubject.next(option);
      });
  }

  private transformToConsoleMessage(domainMessage: DomainMessage): ConsoleMessage {
    switch (domainMessage.type) {
      case 'user-input':
      case 'system':
        return new ConsoleMessage(
          domainMessage.id,
          domainMessage.type === 'user-input' ? 'user' : 'system',
          domainMessage.content,
          domainMessage.timestamp
        );

      case 'ai-response':
      case 'ai-thinking':
        return new ConsoleMessage(
          domainMessage.id,
          domainMessage.type === 'ai-response' ? 'worker' : 'thinking',
          domainMessage.content,
          domainMessage.timestamp,
          {
            workerId: domainMessage.metadata.workerId,
            isStreaming: domainMessage.metadata.isStreaming
          }
        );

      case 'error':
        return new ConsoleMessage(
          domainMessage.id,
          'error',
          domainMessage.content,
          domainMessage.timestamp,
          {
            errorCode: domainMessage.metadata.errorCode,
            stack: domainMessage.metadata.stack,
            recoverable: domainMessage.metadata.recoverable
          }
        );

      case 'file-operation':
        return new ConsoleMessage(
          domainMessage.id,
          'file',
          domainMessage.content,
          domainMessage.timestamp,
          {
            filePath: domainMessage.metadata.filePath,
            fileOperation: domainMessage.metadata.fileOperation,
            diffs: domainMessage.metadata.diffs,
            totalLinesAdded: domainMessage.metadata.totalLinesAdded,
            totalLinesRemoved: domainMessage.metadata.totalLinesRemoved
          }
        );

      case 'user-choice':
        // Convert choice message to system message showing the choice made
        const choiceText = domainMessage.metadata.selectedIndex >= 0 
          ? `Selected: ${domainMessage.metadata.choices[domainMessage.metadata.selectedIndex]}`
          : `Awaiting choice: ${domainMessage.metadata.prompt}`;
        
        return new ConsoleMessage(
          domainMessage.id,
          'system',
          choiceText,
          domainMessage.timestamp
        );

      default:
        // TypeScript exhaustiveness check - this should never happen
        return new ConsoleMessage(
          'unknown',
          'system',
          'Unknown message type',
          new Date()
        );
    }
  }

  private isCommand(input: string): boolean {
    // In console, commands are just the command name (no / prefix)
    // Check if input matches any available command name or alias
    return this.availableCommands.some(cmd => {
      const [firstWord] = input.split(' ');
      return firstWord === cmd.name || 
             (cmd.aliases && cmd.aliases.includes(firstWord));
    });
  }

  private async processAsCommand(input: string): Promise<void> {
    const [command, ...args] = input.split(' ');
    await this.useCase.processCommand(command, args);
  }

  private transformToOption(domainOption: DomainOption): Option {
    return {
      message: domainOption.message,
      options: domainOption.choices,
      selectedIndex: domainOption.defaultIndex
    };
  }

  private addToHistory(input: string): void {
    const trimmedInput = input.trim();
    if (trimmedInput && this.inputHistory[this.inputHistory.length - 1] !== trimmedInput) {
      this.inputHistory.push(trimmedInput);
      
      // Keep history size manageable
      if (this.inputHistory.length > 100) {
        this.inputHistory.shift();
      }
    }
  }

  private resetHistoryNavigation(): void {
    this.historyIndex = -1;
    this.inputTextSubject.next('');
  }

  private handleError(error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    // Create an error message for display
    const errorConsoleMessage = ConsoleMessage.create(
      `Error: ${errorMessage}`,
      'error'
    );
    
    this.messageSubject.next(errorConsoleMessage);
  }
}