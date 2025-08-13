import { Observable, merge } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { ConsoleUseCase } from '../../presentation/view-models/console/console-use-case.js';
import { TUIUseCase } from '../../presentation/view-models/tui/tui-use-case.js';
import { 
  DomainMessage, 
  DomainOption, 
  CommandDefinition 
} from '../../presentation/view-models/console/console-use-case.js';
import { 
  DomainTokenUsage, 
  DomainWorkerInfo 
} from '../../presentation/view-models/shared-use-case.js';
import { MessageReader, MessageWriter } from '../interfaces/message-store.js';
import { CommandDispatcher } from '../interfaces/command-provider.js';
import { PromptHandler } from '../interfaces/prompt-handler.js';

/**
 * FlowCode Use Case - Core business logic implementation
 * Implements both ConsoleUseCase and TUIUseCase interfaces for shared usage
 * Coordinates between message storage, command handling, and AI processing
 */
export class FlowCodeUseCase implements TUIUseCase {
  
  constructor(
    private readonly messageReader: MessageReader,
    private readonly messageWriter: MessageWriter,
    private readonly commandDispatcher: CommandDispatcher,
    private readonly promptHandler: PromptHandler
  ) {}

  // Core use case methods (shared by both Console and TUI)
  async processAIInput(input: string): Promise<void> {
    try {
      // Create and store user input message
      const userMessage = this.createUserMessage(input);
      await this.messageWriter.storeMessage(userMessage);
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
      await this.messageWriter.storeMessage(userMessage);
    } catch (error) {
      // Log storage error but continue - storage failure shouldn't break the workflow
      console.warn('Failed to store command message:', error);
    }
    
    // Execute command through dispatcher
    await this.commandDispatcher.execute(command, args);
  }

  async respondToChoice(selectedIndex: number): Promise<void> {
    // Forward choice to PromptHandler - it will store the choice and continue processing
    await this.promptHandler.respondToChoice(selectedIndex);
  }

  getAvailableCommands(): CommandDefinition[] {
    return this.commandDispatcher.getCommands();
  }

  // Reactive streams (shared by both Console and TUI)
  get messages$(): Observable<DomainMessage> {
    // Merge all message sources and flatten messageHistory$ array to individual messages
    return merge(
      this.messageReader.messageHistory$.pipe(
        switchMap(messages => messages) // Flatten array to individual messages
      ),
      this.commandDispatcher.systemMessages$,
      this.commandDispatcher.errorMessages$
    );
  }

  get options$(): Observable<DomainOption> {
    // Forward options directly from PromptHandler
    return this.promptHandler.options$;
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