import { Observable } from 'rxjs';
import { DomainMessage, CommandDefinition } from '../../presentation/view-models/console/console-use-case.js';

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
 * Command provider interface for self-describing command handlers
 * Each command provider handles specific commands and provides metadata
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
}

/**
 * Command dispatcher interface - orchestrates multiple command providers
 */
export interface CommandDispatcher extends CommandProvider {
  /**
   * Stream of system messages (success, info, etc.)
   */
  systemMessages$: Observable<DomainMessage>;
  
  /**
   * Stream of error messages
   */
  errorMessages$: Observable<DomainMessage>;
}