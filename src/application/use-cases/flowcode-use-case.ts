import { Observable, merge } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { TUIUseCase } from '../../presentation/view-models/tui/tui-use-case.js';
import { 
  DomainMessage, 
  DomainOption, 
  CommandDefinition 
} from '../../presentation/view-models/console/console-use-case.js';
import { 
  DomainTokenUsage, 
  DomainWorkerInfo 
} from '../../presentation/model/use-case-models.js';
import { MessageStorePublisher } from '../interfaces/message-store.js';
import { CommandDispatcher } from '../interfaces/command-provider.js';
import { PromptHandler } from '../interfaces/prompt-handler.js';
import { Initializer, InitializationState } from '../interfaces/initializer.js';

/**
 * FlowCode Use Case - Core business logic implementation
 * Implements both ConsoleUseCase and TUIUseCase interfaces for shared usage
 * Coordinates between message storage, command handling, and AI processing
 */
export class FlowCodeUseCase implements TUIUseCase {
  
  constructor(
    private readonly messageStore: MessageStorePublisher,
    private readonly commandDispatcher: CommandDispatcher,
    private readonly promptHandler: PromptHandler,
    private readonly initializer: Initializer
  ) {}

  // Core use case methods (shared by both Console and TUI)
  async processAIInput(input: string): Promise<void> {
    // Check if we're in initialization mode
    if (this.initializer.getState() === InitializationState.InProgress) {
      this.initializer.processResponse(input);
      return;
    }

    try {
      // Create and store user input message
      const userMessage = this.createUserMessage(input);
      await this.messageStore.storeMessage(userMessage);
    } catch (error) {
      // Log storage error but continue - storage failure shouldn't break the workflow
      console.warn('Failed to store user message:', error);
    }
    
    // Forward to prompt handler (it manages context and publishes results)
    await this.promptHandler.processUserInput(input);
  }

  async processCommand(command: string, args: string[] = []): Promise<void> {
    // Handle init command specially - it goes through initializer, not dispatcher
    if (command === 'init') {
      try {
        // Store init command for history
        const commandInput = args.length > 0 ? `${command} ${args.join(' ')}` : command;
        const userMessage = this.createUserMessage(commandInput);
        await this.messageStore.storeMessage(userMessage);
      } catch (error) {
        console.warn('Failed to store init command message:', error);
      }
      await this.handleInitCommand();
      return;
    }

    try {
      // Create and store user command message for non-init commands
      const commandInput = args.length > 0 ? `${command} ${args.join(' ')}` : command;
      const userMessage = this.createUserMessage(commandInput);
      await this.messageStore.storeMessage(userMessage);
    } catch (error) {
      // Log storage error but continue - storage failure shouldn't break the workflow
      console.warn('Failed to store command message:', error);
    }

    // Execute non-init commands through dispatcher
    await this.commandDispatcher.execute(command, args);
  }

  private async handleInitCommand(): Promise<void> {
    // Check if already initialized
    if (this.initializer.isCurrentDirectoryInitialized()) {
      // Create error message for already initialized
      const errorMessage: DomainMessage = {
        id: this.generateMessageId(),
        type: 'error',
        content: 'FlowCode project is already initialized in this directory.',
        timestamp: new Date(),
        metadata: {
          errorCode: 'ALREADY_INITIALIZED',
          recoverable: false
        }
      };
      await this.messageStore.storeMessage(errorMessage);
      return;
    }

    // Start initialization process - initializer will publish messages and options
    const result = this.initializer.start();
    if (!result.isSuccess) {
      // Create error message
      const errorMessage: DomainMessage = {
        id: this.generateMessageId(),
        type: 'error',
        content: `Failed to start initialization: ${result.error}`,
        timestamp: new Date(),
        metadata: {
          errorCode: 'INIT_FAILED',
          recoverable: true
        }
      };
      await this.messageStore.storeMessage(errorMessage);
    }
    // If successful, initializer will handle publishing messages/options through its streams
  }

  async respondToChoice(selectedIndex: number): Promise<void> {
    // Check if we're in initialization mode
    if (this.initializer.getState() === InitializationState.InProgress) {
      this.initializer.processOptionSelection(selectedIndex);
      return;
    }

    // Forward choice to PromptHandler - it will store the choice and continue processing
    await this.promptHandler.respondToChoice(selectedIndex);
  }

  getAvailableCommands(): CommandDefinition[] {
    return this.commandDispatcher.getCommands();
  }

  // Reactive streams (shared by both Console and TUI)
  get messages$(): Observable<DomainMessage> {
    // Merge message store and initializer message sources
    const storeMessages$ = this.messageStore.messageHistory$.pipe(
      switchMap(messages => messages) // Flatten array to individual messages
    );
    
    return merge(storeMessages$, this.initializer.messages$);
  }

  get options$(): Observable<DomainOption> {
    // Merge PromptHandler and Initializer options
    return merge(this.promptHandler.options$, this.initializer.options$);
  }

  // TUI-specific streams (ignored by Console)
  get tokenUsage$(): Observable<DomainTokenUsage> {
    return this.promptHandler.tokenUsage$;
  }

  get workerInfo$(): Observable<DomainWorkerInfo> {
    return this.promptHandler.currentWorker$;
  }

  get isLoading$(): Observable<boolean> {
    return this.promptHandler.isProcessing;
  }

  // Private helper methods
  private createUserMessage(content: string): DomainMessage {
    return {
      id: this.generateMessageId(),
      type: 'user-input',
      content,
      timestamp: new Date()
    };
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}