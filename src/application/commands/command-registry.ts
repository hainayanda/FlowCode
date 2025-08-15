import { Observable, merge } from 'rxjs';
import { CommandDispatcher, CommandProvider, CommandResult } from '../interfaces/command-provider.js';
import { CommandDefinition, DomainMessage, DomainOption } from '../../presentation/view-models/console/console-use-case.js';
import { MessageWriter } from '../interfaces/message-store.js';
import { Result } from '../shared/result.js';

/**
 * Main command dispatcher that routes commands to appropriate handlers
 * and provides help functionality by aggregating commands from all providers
 * Supports both simple and interactive command execution
 */
export class CommandRegistry implements CommandDispatcher {
  private activeInteractiveProvider: CommandProvider | null = null;
  private activeInteractiveCommand: string | null = null;

  constructor(
    private readonly commandProviders: CommandProvider[],
    private readonly messageWriter: MessageWriter
  ) {}

  async execute(command: string, args: string[]): Promise<CommandResult> {
    // Handle built-in help command
    if (command === 'help') {
      return this.handleHelpCommand(args);
    }

    // Find appropriate command provider
    const provider = this.findProvider(command);
    if (!provider) {
      const error = `Unknown command: ${command}. Use 'help' to see available commands.`;
      await this.messageWriter.storeMessage({
        id: Date.now().toString(),
        type: 'system',
        content: error,
        timestamp: new Date()
      });
      return {
        success: false,
        error
      };
    }

    try {
      const result = await provider.execute(command, args);
      
      // Check if command became interactive after execution
      if (provider.interactive?.isInteractive()) {
        this.activeInteractiveProvider = provider;
        this.activeInteractiveCommand = command;
      }
      
      // Store system message for successful commands
      if (result.success && result.message) {
        await this.messageWriter.storeMessage({
          id: Date.now().toString(),
          type: 'system',
          content: result.message,
          timestamp: new Date()
        });
      }

      return result;
    } catch (error) {
      const errorMessage = `Error executing command '${command}': ${error instanceof Error ? error.message : String(error)}`;
      await this.messageWriter.storeMessage({
        id: Date.now().toString(),
        type: 'system',
        content: errorMessage,
        timestamp: new Date()
      });
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  getCommands(): CommandDefinition[] {
    // Aggregate all commands from providers, plus built-in help
    const allCommands: CommandDefinition[] = [
      {
        name: 'help',
        description: 'Show available commands or help for specific command'
      }
    ];

    // Add commands from all providers
    for (const provider of this.commandProviders) {
      allCommands.push(...provider.getCommands());
    }

    return allCommands;
  }

  supports(command: string): boolean {
    return command === 'help' || this.commandProviders.some(provider => provider.supports(command));
  }

  // Interactive command dispatcher methods
  processInteractiveResponse(response: string): Result<void, string> {
    if (!this.activeInteractiveProvider?.interactive) {
      return Result.failure('No active interactive command');
    }

    const result = this.activeInteractiveProvider.interactive.processResponse(response);
    
    // Check if interaction completed
    if (!this.activeInteractiveProvider.interactive.isInteractive()) {
      this.clearActiveInteractiveCommand();
    }

    return result;
  }

  processInteractiveOptionSelection(optionIndex: number): Result<void, string> {
    if (!this.activeInteractiveProvider?.interactive) {
      return Result.failure('No active interactive command');
    }

    const result = this.activeInteractiveProvider.interactive.processOptionSelection(optionIndex);
    
    // Check if interaction completed
    if (!this.activeInteractiveProvider.interactive.isInteractive()) {
      this.clearActiveInteractiveCommand();
    }

    return result;
  }

  hasActiveInteractiveCommand(): boolean {
    return this.activeInteractiveProvider?.interactive?.isInteractive() ?? false;
  }

  getActiveInteractiveCommand(): string | null {
    return this.activeInteractiveCommand;
  }

  // Interactive reactive streams access - simplified getter for FlowCodeUseCase
  getInteractiveStreams(): { messages$: Observable<DomainMessage>; options$: Observable<DomainOption> } | undefined {
    const interactiveProviders = this.commandProviders
      .filter(provider => provider.interactive)
      .map(provider => provider.interactive!);

    if (interactiveProviders.length === 0) {
      return undefined;
    }

    return {
      messages$: merge(...interactiveProviders.map(interactive => interactive.messages$)),
      options$: merge(...interactiveProviders.map(interactive => interactive.options$))
    };
  }

  private clearActiveInteractiveCommand(): void {
    this.activeInteractiveProvider = null;
    this.activeInteractiveCommand = null;
  }

  private findProvider(command: string): CommandProvider | undefined {
    return this.commandProviders.find(provider => provider.supports(command));
  }

  private async handleHelpCommand(args: string[]): Promise<CommandResult> {
    if (args.length === 0) {
      // Show all available commands
      const commands = this.getCommands();
      const helpText = this.formatAllCommandsHelp(commands);
      
      await this.messageWriter.storeMessage({
        id: Date.now().toString(),
        type: 'system',
        content: helpText,
        timestamp: new Date()
      });

      return {
        success: true,
        message: helpText
      };
    }

    // Show help for specific command
    const commandName = args[0];
    const commands = this.getCommands();
    const command = commands.find(cmd => cmd.name === commandName);

    if (!command) {
      const error = `No help available for command: ${commandName}`;
      return {
        success: false,
        error
      };
    }

    const helpText = this.formatCommandHelp(command);
    await this.messageWriter.storeMessage({
      id: Date.now().toString(),
      type: 'system',
      content: helpText,
      timestamp: new Date()
    });

    return {
      success: true,
      message: helpText
    };
  }

  private formatAllCommandsHelp(commands: CommandDefinition[]): string {
    const lines = ['Available commands:', ''];
    
    for (const command of commands) {
      lines.push(`  ${command.name} - ${command.description}`);
    }
    
    lines.push('', 'Use "help <command>" for detailed usage information.');
    return lines.join('\n');
  }

  private formatCommandHelp(command: CommandDefinition): string {
    const lines = [
      `Command: ${command.name}`,
      `Description: ${command.description}`
    ];

    if (command.aliases && command.aliases.length > 0) {
      lines.push(`Aliases: ${command.aliases.join(', ')}`);
    }

    return lines.join('\n');
  }
}