import { Observable } from 'rxjs';

/**
 * Base domain message interface
 */
export interface BaseDomainMessage {
  id: string;
  content: string;
  timestamp: Date;
}

/**
 * User input message from console
 */
export interface PlainMessage extends BaseDomainMessage {
  type: 'user-input' | 'system';
}

/**
 * AI response message from workers
 */
export interface AIResponseMessage extends BaseDomainMessage {
  type: 'ai-response' | 'ai-thinking';
  metadata: {
    workerId: string;
    isStreaming?: boolean;
  };
}

/**
 * Error message for failures and exceptions
 */
export interface ErrorMessage extends BaseDomainMessage {
  type: 'error';
  metadata: {
    errorCode?: string;
    stack?: string;
    recoverable?: boolean;
  };
}

/**
 * File operation message for code changes
 */
export interface FileOperationMessage extends BaseDomainMessage {
  type: 'file-operation';
  metadata: {
    filePath: string;
    fileOperation: 'edit' | 'add' | 'delete';
    diffs?: Array<{
      lineNumber: number;
      type: 'unchanged' | 'added' | 'removed' | 'modified';
      oldContent?: string;
      newContent?: string;
    }>;
    totalLinesAdded?: number;
    totalLinesRemoved?: number;
  };
}

/**
 * User choice message for interactive prompts
 */
export interface UserChoiceMessage extends BaseDomainMessage {
  type: 'user-choice';
  metadata: {
    choices: string[];
    selectedIndex: number; // -1 = pending, >= 0 = selected
    prompt: string;
  };
}

/**
 * Union type for all domain messages
 */
export type DomainMessage =
  | PlainMessage
  | AIResponseMessage
  | ErrorMessage
  | FileOperationMessage
  | UserChoiceMessage;

/**
 * Domain option model for user choices
 */
export interface DomainOption {
  message: string;
  choices: string[];
  defaultIndex: number;
}

/**
 * Available command definition
 */
export interface CommandDefinition {
  name: string;
  description: string;
  aliases?: string[];
}

/**
 * Use case interface for Console ViewModel
 * Contains only the methods needed by Console (no TUI-specific streams)
 * Will be implemented by FlowCodeUseCase class
 */
export interface ConsoleUseCase {
  /**
   * Process AI input (natural language tasks)
   */
  processAIInput(input: string): Promise<void>;
  
  /**
   * Process command input (specific commands like init, config, etc.)
   */
  processCommand(command: string, args?: string[]): Promise<void>;
  
  /**
   * Respond to user choice prompt
   */
  respondToChoice(selectedIndex: number): Promise<void>;
  
  /**
   * Get list of available commands for ViewModels to use
   */
  getAvailableCommands(): CommandDefinition[];
  
  /**
   * Stream of domain messages from business logic
   */
  messages$: Observable<DomainMessage>;
  
  /**
   * Stream of domain options for user choices
   */
  options$: Observable<DomainOption>;
}