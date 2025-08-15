import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { 
  TUIViewState, 
  TUIViewListener, 
  Suggestion, 
  TokenUsage, 
  WorkerInfo 
} from '../../views/tui/tui-view-contracts.js';
import { ConsoleMessage } from '../../model/message.js';
import { Option } from '../../model/option.js';
import { TUIRouter } from './tui-router.js';
import { TUIUseCase, DomainMessage, DomainOption, CommandDefinition, DomainTokenUsage, DomainWorkerInfo } from './tui-use-case.js';

/**
 * TUI ViewModel implementing MVVM pattern
 * Depends only on router and use case, following dependency injection
 */
export class TUIViewModel implements TUIViewState, TUIViewListener {
  private readonly messageSubject = new Subject<ConsoleMessage>();
  private readonly tokenUsageSubject = new BehaviorSubject<TokenUsage>({ used: 0, limit: 10000 });
  private readonly workerInfoSubject = new BehaviorSubject<WorkerInfo>({ 
    name: 'idle', 
    model: '', 
    provider: '', 
    status: 'idle' 
  });
  private readonly isLoadingSubject = new BehaviorSubject<boolean>(false);
  private readonly inputTextSubject = new BehaviorSubject<string>('');
  private readonly suggestionsSubject = new BehaviorSubject<Suggestion[]>([]);
  private readonly optionSubject = new BehaviorSubject<Option | null>(null);

  private readonly inputHistory: string[] = [];
  private historyIndex = -1;
  private allowInput = true;
  private readonly availableCommands: CommandDefinition[];
  private suggestionIndex = -1;

  constructor(
    private readonly router: TUIRouter,
    private readonly useCase: TUIUseCase
  ) {
    this.availableCommands = this.useCase.getAvailableCommands();
    this.setupSubscriptions();
  }

  // TUIViewState implementation
  get messages$(): Observable<ConsoleMessage> {
    return this.messageSubject.asObservable();
  }

  get tokenUsage$(): Observable<TokenUsage> {
    return this.tokenUsageSubject.asObservable();
  }

  get workerInfo$(): Observable<WorkerInfo> {
    return this.workerInfoSubject.asObservable();
  }

  get isLoading$(): Observable<boolean> {
    return this.isLoadingSubject.asObservable();
  }

  get inputText$(): Observable<string> {
    return this.inputTextSubject.asObservable();
  }

  get suggestions$(): Observable<Suggestion[]> {
    return this.suggestionsSubject.asObservable();
  }

  get options$(): Observable<Option | null> {
    return this.optionSubject.asObservable();
  }

  // TUIViewListener implementation
  onExit(): void {
    this.router.exit();
  }

  onSwitchToConsole(): void {
    this.router.navigateToConsole();
  }

  onUpArrow(): void {
    const currentSuggestions = this.suggestionsSubject.value;
    
    if (currentSuggestions.length > 0) {
      // Navigate suggestions with wrapping
      if (this.suggestionIndex > 0) {
        this.suggestionIndex--;
      } else {
        this.suggestionIndex = currentSuggestions.length - 1; // Wrap to bottom
      }
      this.updateSuggestionHighlight();
    } else if (this.inputHistory.length > 0) {
      // Navigate history
      this.historyIndex = Math.min(this.historyIndex + 1, this.inputHistory.length - 1);
      const historicInput = this.inputHistory[this.inputHistory.length - 1 - this.historyIndex];
      this.inputTextSubject.next(historicInput);
    }
  }

  onDownArrow(): void {
    const currentSuggestions = this.suggestionsSubject.value;
    
    if (currentSuggestions.length > 0) {
      // Navigate suggestions with wrapping
      if (this.suggestionIndex < currentSuggestions.length - 1) {
        this.suggestionIndex++;
      } else {
        this.suggestionIndex = 0; // Wrap to top
      }
      this.updateSuggestionHighlight();
    } else {
      // Navigate history
      if (this.historyIndex <= 0) {
        this.historyIndex = -1;
        this.inputTextSubject.next('');
        return;
      }
      
      this.historyIndex = Math.max(this.historyIndex - 1, 0);
      const historicInput = this.inputHistory[this.inputHistory.length - 1 - this.historyIndex];
      this.inputTextSubject.next(historicInput);
    }
  }

  onLeftArrow(): void {
    // Handle left arrow for option navigation
    const currentOptions = this.optionSubject.value;
    if (currentOptions) {
      // Navigate left in options (wrap to end if at beginning)
      let newIndex = currentOptions.selectedIndex - 1;
      if (newIndex < 0) {
        newIndex = currentOptions.options.length - 1;
      }
      
      // Update the option with new selectedIndex
      const updatedOption = {
        ...currentOptions,
        selectedIndex: newIndex
      };
      this.optionSubject.next(updatedOption);
    }
  }

  onRightArrow(): void {
    // Handle right arrow for option navigation
    const currentOptions = this.optionSubject.value;
    if (currentOptions) {
      // Navigate right in options (wrap to beginning if at end)
      let newIndex = currentOptions.selectedIndex + 1;
      if (newIndex >= currentOptions.options.length) {
        newIndex = 0;
      }
      
      // Update the option with new selectedIndex
      const updatedOption = {
        ...currentOptions,
        selectedIndex: newIndex
      };
      this.optionSubject.next(updatedOption);
    }
  }

  onTab(): void {
    const currentSuggestions = this.suggestionsSubject.value;
    if (currentSuggestions.length > 0) {
      const selected = currentSuggestions.find(s => s.highlight) || currentSuggestions[0];
      if (selected) {
        // Auto-complete with selected suggestion (add space like tui-test)
        this.inputTextSubject.next(selected.text + ' ');
        this.clearSuggestions();
      }
    }
  }

  async onEnter(currentInput: string): Promise<void> {
    try {
      // First check if suggestions are showing
      const currentSuggestions = this.suggestionsSubject.value;
      if (currentSuggestions.length > 0) {
        const selected = currentSuggestions.find(s => s.highlight) || currentSuggestions[0];
        if (selected) {
          // Auto-complete with selected suggestion (add space like tui-test)
          this.inputTextSubject.next(selected.text + ' ');
          this.clearSuggestions();
          return;
        }
      }
      
      // Then check if options are showing
      const currentOptions = this.optionSubject.value;
      if (currentOptions) {
        // Send selection to use case
        await this.useCase.respondToChoice(currentOptions.selectedIndex);
        
        // Clear options and re-enable input
        this.optionSubject.next(null);
        this.allowInput = true;
        return;
      }

      // Handle normal input submission only if input is allowed
      if (!this.allowInput || !currentInput.trim()) return;

      // Add to history
      this.addToHistory(currentInput);
      this.resetNavigation();

      const trimmedInput = currentInput.trim();

      // Handle special router command for console
      if (trimmedInput === '/console') {
        this.router.navigateToConsole();
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

  onInputChange(text: string): void {
    this.inputTextSubject.next(text);
    this.updateSuggestions(text);
    // Reset navigation indices but don't clear input (like tui-test)
    this.historyIndex = -1;
    this.suggestionIndex = -1;
  }

  // Private methods
  private setupSubscriptions(): void {
    this.setupMessageSubscription();
    this.setupOptionSubscription();
    this.setupTokenUsageSubscription();
    this.setupWorkerInfoSubscription();
    this.setupLoadingSubscription();
  }

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
        tap((option: Option | null) => {
          // Block input while options are displayed
          this.allowInput = option === null;
        }),
        catchError((error) => {
          this.handleError(error);
          return [null];
        })
      )
      .subscribe((option: Option | null) => {
        this.optionSubject.next(option);
      });
  }

  private setupTokenUsageSubscription(): void {
    this.useCase.tokenUsage$
      .pipe(
        map((domainTokenUsage: DomainTokenUsage) => this.transformToTokenUsage(domainTokenUsage)),
        catchError((error) => {
          this.handleError(error);
          return [{ used: 0, limit: 10000 }];
        })
      )
      .subscribe((tokenUsage: TokenUsage) => {
        this.tokenUsageSubject.next(tokenUsage);
      });
  }

  private setupWorkerInfoSubscription(): void {
    this.useCase.workerInfo$
      .pipe(
        map((domainWorkerInfo: DomainWorkerInfo) => this.transformToWorkerInfo(domainWorkerInfo)),
        catchError((error) => {
          this.handleError(error);
          return [{ name: 'error', model: '', provider: '', status: 'idle' as const }];
        })
      )
      .subscribe((workerInfo: WorkerInfo) => {
        this.workerInfoSubject.next(workerInfo);
      });
  }

  private setupLoadingSubscription(): void {
    this.useCase.isLoading$
      .pipe(
        catchError((error) => {
          this.handleError(error);
          return [false];
        })
      )
      .subscribe((isLoading: boolean) => {
        this.isLoadingSubject.next(isLoading);
      });
  }

  private transformToConsoleMessage(domainMessage: DomainMessage): ConsoleMessage {
    // Same transformation logic as ConsoleViewModel
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

  private transformToOption(domainOption: DomainOption): Option | null {
    if (!domainOption) return null;
    
    return {
      message: domainOption.message,
      options: domainOption.choices,
      selectedIndex: domainOption.defaultIndex
    };
  }

  private transformToTokenUsage(domainTokenUsage: DomainTokenUsage): TokenUsage {
    return {
      used: domainTokenUsage.used,
      limit: domainTokenUsage.limit,
      cost: domainTokenUsage.cost
    };
  }

  private transformToWorkerInfo(domainWorkerInfo: DomainWorkerInfo): WorkerInfo {
    return {
      name: domainWorkerInfo.name,
      model: domainWorkerInfo.model,
      provider: domainWorkerInfo.provider,
      status: domainWorkerInfo.status
    };
  }

  private isCommand(input: string): boolean {
    // In TUI, commands start with / prefix
    if (!input.startsWith('/')) return false;
    
    const commandWithoutSlash = input.substring(1);
    const [firstWord] = commandWithoutSlash.split(' ');
    
    return this.availableCommands.some(cmd => {
      return firstWord === cmd.name || 
             (cmd.aliases && cmd.aliases.includes(firstWord));
    });
  }

  private async processAsCommand(input: string): Promise<void> {
    // Remove the / prefix for TUI commands
    const commandWithoutSlash = input.substring(1);
    const [command, ...args] = commandWithoutSlash.split(' ');
    await this.useCase.processCommand(command, args);
  }

  private updateSuggestions(text: string): void {
    if (!text.startsWith('/')) {
      this.clearSuggestions();
      return;
    }

    const commandText = text.substring(1).toLowerCase();
    const matchingCommands = this.availableCommands
      .filter(cmd => {
        return cmd.name.toLowerCase().startsWith(commandText) || 
               (cmd.aliases && cmd.aliases.some(alias => alias.toLowerCase().startsWith(commandText)));
      })
      .map((cmd) => ({
        text: `/${cmd.name}`,
        description: cmd.description,
        highlight: false
      }));

    if (matchingCommands.length > 0) {
      // Always reset to first suggestion when filtering changes (like tui-test)
      this.suggestionIndex = 0;
      const suggestions = matchingCommands.map((cmd, index) => ({
        ...cmd,
        highlight: index === this.suggestionIndex
      }));
      this.suggestionsSubject.next(suggestions);
    } else {
      this.suggestionsSubject.next([]);
      this.suggestionIndex = -1;
    }
  }

  private updateSuggestionHighlight(): void {
    const suggestions = this.suggestionsSubject.value.map((suggestion, index) => ({
      ...suggestion,
      highlight: index === this.suggestionIndex
    }));
    this.suggestionsSubject.next(suggestions);
  }

  private clearSuggestions(): void {
    this.suggestionsSubject.next([]);
    this.suggestionIndex = -1;
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

  private resetNavigation(): void {
    this.historyIndex = -1;
    this.suggestionIndex = -1;
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