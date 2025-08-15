import { Observable } from 'rxjs';
import { CommandDefinition } from '../../presentation/view-models/console/console-use-case.js';
import { DomainMessage, DomainOption } from '../../presentation/view-models/console/console-use-case.js';
import { Result } from '../shared/result.js';

/**
 * Command execution result
 */
export interface CommandResult {
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
}

/**
 * Command handler interface - basic execution only
 */
export interface CommandHandler {
  /**
   * Execute a command with arguments
   */
  execute(command: string, args: string[]): Promise<CommandResult>;
}

/**
 * Interactive command capabilities for commands that require user input
 */
export interface InteractiveCommandCapabilities {
  /**
   * Observable stream of messages for presentation layer
   */
  messages$: Observable<DomainMessage>;

  /**
   * Observable stream of options for presentation layer
   */
  options$: Observable<DomainOption>;

  /**
   * Process user text response
   */
  processResponse(response: string): Result<void, string>;

  /**
   * Process user option selection
   */
  processOptionSelection(optionIndex: number): Result<void, string>;

  /**
   * Check if command is currently in interactive mode
   */
  isInteractive(): boolean;

  /**
   * Reset interactive state
   */
  resetInteractiveState(): void;
}

/**
 * Command provider interface for self-describing command handlers
 * Each command provider handles specific commands and provides metadata
 * Can optionally support interactive capabilities for multi-step commands
 */
export interface CommandProvider extends CommandHandler {
  
  /**
   * Get list of commands this provider supports
   */
  getCommands(): CommandDefinition[];
  
  /**
   * Check if this provider supports a specific command
   */
  supports(command: string): boolean;

  /**
   * Optional interactive capabilities for multi-step commands
   */
  interactive?: InteractiveCommandCapabilities;
}

/**
 * Command dispatcher interface - orchestrates multiple command providers
 * Supports both simple and interactive command execution
 */
export interface CommandDispatcher extends CommandProvider {
  /**
   * Process user response for currently active interactive command
   */
  processInteractiveResponse(response: string): Result<void, string>;

  /**
   * Process user option selection for currently active interactive command
   */
  processInteractiveOptionSelection(optionIndex: number): Result<void, string>;

  /**
   * Check if any command is currently in interactive mode
   */
  hasActiveInteractiveCommand(): boolean;

  /**
   * Get the currently active interactive command name
   */
  getActiveInteractiveCommand(): string | null;

  /**
   * Get aggregated reactive streams from all interactive command providers
   */
  getInteractiveStreams(): { messages$: Observable<DomainMessage>; options$: Observable<DomainOption> } | undefined;
}