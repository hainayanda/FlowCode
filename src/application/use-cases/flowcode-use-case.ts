import { Observable, merge, EMPTY } from 'rxjs';
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

/**
 * FlowCode Use Case - Core business logic implementation
 * Implements both ConsoleUseCase and TUIUseCase interfaces for shared usage
 * Coordinates between message storage, command handling, and AI processing
 */
export class FlowCodeUseCase implements TUIUseCase {
  
  // Public getters - Reactive streams (shared by both Console and TUI)
  get messages$(): Observable<DomainMessage> {
    // Merge message store and interactive command sources
    const storeMessages$ = this.messageStore.messageHistory$.pipe(
      switchMap(messages => messages) // Flatten array to individual messages
    );
    
    const interactiveStreams = this.commandDispatcher.getInteractiveStreams();
    const interactiveMessages$ = interactiveStreams?.messages$ || EMPTY;
    
    return merge(storeMessages$, interactiveMessages$);
  }

  get options$(): Observable<DomainOption> {
    // Merge PromptHandler and interactive command options
    const interactiveStreams = this.commandDispatcher.getInteractiveStreams();
    const interactiveOptions$ = interactiveStreams?.options$ || EMPTY;
    
    return merge(this.promptHandler.options$, interactiveOptions$);
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

  constructor(
    private readonly messageStore: MessageStorePublisher,
    private readonly commandDispatcher: CommandDispatcher,
    private readonly promptHandler: PromptHandler
  ) {}

  // Public methods - Core use case methods (shared by both Console and TUI)
  async processAIInput(input: string): Promise<void> {
    // Check if we're in interactive command mode
    if (this.commandDispatcher.hasActiveInteractiveCommand()) {
      this.commandDispatcher.processInteractiveResponse(input);
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
    try {
      // Create and store user command message
      const commandInput = args.length > 0 ? `${command} ${args.join(' ')}` : command;
      const userMessage = this.createUserMessage(commandInput);
      await this.messageStore.storeMessage(userMessage);
    } catch (error) {
      // Log storage error but continue - storage failure shouldn't break the workflow
      console.warn('Failed to store command message:', error);
    }

    // Execute all commands through dispatcher (including init)
    await this.commandDispatcher.execute(command, args);
  }

  async respondToChoice(selectedIndex: number): Promise<void> {
    // Check if we're in interactive command mode
    if (this.commandDispatcher.hasActiveInteractiveCommand()) {
      this.commandDispatcher.processInteractiveOptionSelection(selectedIndex);
      return;
    }

    // Forward choice to PromptHandler - it will store the choice and continue processing
    await this.promptHandler.respondToChoice(selectedIndex);
  }

  getAvailableCommands(): CommandDefinition[] {
    return this.commandDispatcher.getCommands();
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