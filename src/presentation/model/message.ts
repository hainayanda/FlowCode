/**
 * Color scheme for message cell rendering
 */
export interface ColorScheme {
  fg: string;
  bg: string;
}

/**
 * Represents a single line diff in a file edit
 */
export interface DiffLine {
  lineNumber: number;      // Line number in the file
  type: 'unchanged' | 'added' | 'removed' | 'modified';
  oldContent?: string;      // Original content (absent if added)
  newContent?: string;      // New content (absent if removed)
}

/**
 * Base message interface for UI rendering
 */
export interface BaseMessage {
  id: string;
  content: string;
  timestamp: Date;
  
  // UI rendering methods
  getDisplayText(): string;
  getColorScheme(): ColorScheme;
  shouldAnimate(): boolean;
  toConsoleString(): string;
}

/**
 * Plain message interface for simple messages (user input, system notifications)
 */
export interface PlainMessage extends BaseMessage {
  type: 'user' | 'system';
}

/**
 * AI message interface for worker responses and thinking
 */
export interface AIMessage extends BaseMessage {
  type: 'worker' | 'thinking';
  metadata: {
    workerId: string;
    isStreaming?: boolean;
  };
}

/**
 * Error message interface for failures and exceptions
 */
export interface ErrorMessage extends BaseMessage {
  type: 'error';
  metadata: {
    errorCode?: string;
    stack?: string;
    recoverable?: boolean;
  };
}

/**
 * File message interface for code changes
 */
export interface FileMessage extends BaseMessage {
  type: 'file';
  metadata: {
    filePath: string;
    fileOperation: 'edit' | 'add' | 'delete';
    diffs?: DiffLine[];
    totalLinesAdded?: number;
    totalLinesRemoved?: number;
  };
}

/**
 * Union type for all presentation messages
 */
export type Message = PlainMessage | AIMessage | ErrorMessage | FileMessage;

/**
 * Message entity that implements BaseMessage for UI rendering
 */
export type WorkerMetadata = AIMessage['metadata'];
export type ErrorMetadata = ErrorMessage['metadata'];
export type FileMetadata = FileMessage['metadata'];
export type ConsoleMetadata = WorkerMetadata | ErrorMetadata | FileMetadata;

export class ConsoleMessage implements BaseMessage {
  constructor(
    public id: string,
    public type: 'user' | 'system' | 'worker' | 'error' | 'thinking' | 'file',
    public content: string,
    public timestamp: Date,
    public metadata?: ConsoleMetadata
  ) {}

  static create(
    content: string,
    type: 'user' | 'system' | 'worker' | 'error' | 'thinking' | 'file',
    metadata?: ConsoleMetadata
  ): ConsoleMessage {
    return new ConsoleMessage(
      `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      type,
      content,
      new Date(),
      metadata
    );
  }

  getDisplayText(): string {
    const workerMeta = this.getWorkerMetadata();
    const prefix = {
      user: '> ',
      system: '• ',
      worker: `[${workerMeta?.workerId || 'worker'}] `,
      error: '✗ ',
      thinking: `[thinking][${workerMeta?.workerId || 'worker'}] `,
      file: ''
    }[this.type];

    return `${prefix}${this.content}`;
  }

  getColorScheme(): ColorScheme {
    return {
      user: { fg: 'white', bg: 'black' },
      system: { fg: 'green', bg: 'black' },
      worker: { fg: 'cyan', bg: 'black' },
      error: { fg: 'red', bg: 'black' },
      thinking: { fg: 'blue', bg: 'black' },
      file: { fg: 'yellow', bg: 'black' }
    }[this.type] || { fg: 'white', bg: 'black' };
  }

  shouldAnimate(): boolean {
    const meta = this.getWorkerMetadata();
    return meta?.isStreaming === true;
  }

  /**
   * Get a console-friendly formatted string
   */
  toConsoleString(): string {
    const reset = '\x1b[0m';
    const timestamp = this.timestamp.toLocaleTimeString();
    
    // Special handling for file operations with diffs
    if (this.type === 'file') {
      return this.formatFileForConsole(timestamp, reset);
    }
    
    // Color logic based on message type and worker ID
    let color: string;
    
    switch (this.type) {
      case 'system':
        color = '\x1b[90m'; // grey
        break;
      case 'user':
        color = '\x1b[37m'; // white
        break;
      case 'worker': {
        const workerMeta = this.getWorkerMetadata();
        if (workerMeta?.workerId === 'taskmaster') {
          color = '\x1b[38;5;214m'; // orange (256 color)
        } else {
          color = '\x1b[34m'; // blue
        }
        break;
      }
      case 'thinking': {
        // Subtle bluish color based on worker type
        const workerMeta = this.getWorkerMetadata();
        if (workerMeta?.workerId === 'taskmaster') {
          color = '\x1b[38;5;173m'; // subtle orange bluish (256 color)
        } else {
          color = '\x1b[38;5;67m'; // subtle bluish (256 color)
        }
        break;
      }
      case 'error':
        color = '\x1b[31m'; // red
        break;
      default:
        color = '\x1b[37m'; // default white
    }
    
    return `${color}[${timestamp}] ${this.getDisplayText()}${reset}`;
  }

  private getWorkerMetadata(): WorkerMetadata | undefined {
    if (this.type === 'worker' || this.type === 'thinking') {
      const meta = this.metadata as WorkerMetadata | undefined;
      if (meta && typeof meta.workerId === 'string') {
        return meta;
      }
    }
    return undefined;
  }

  private getFileMetadata(): FileMetadata | undefined {
    if (this.type === 'file') {
      const meta = this.metadata as FileMetadata | undefined;
      if (meta && typeof meta.filePath === 'string') {
        return meta;
      }
    }
    return undefined;
  }

  /**
   * Format file operations with diffs for console display
   */
  private formatFileForConsole(timestamp: string, reset: string): string {
    const fileMeta = this.getFileMetadata();
    const filePath = fileMeta?.filePath || 'unknown file';
    const operation = fileMeta?.fileOperation || 'edit';
    const diffs: DiffLine[] = Array.isArray(fileMeta?.diffs) ? (fileMeta?.diffs as DiffLine[]) : [];
    
    let result = '';
    
    // Color codes
    const gray = '\x1b[90m';
    const green = '\x1b[32m';
    const red = '\x1b[31m';
    const yellow = '\x1b[33m';
    
    // Header based on operation with timestamp
    switch (operation) {
      case 'add':
        result = `${green}[${timestamp}] File added ${gray}at ${filePath}${reset}\n`;
        if (fileMeta?.totalLinesAdded) {
          result += `${gray}+${fileMeta.totalLinesAdded} lines${reset}\n`;
        }
        break;
        
      case 'delete':
        result = `${red}[${timestamp}] File deleted ${gray}at ${filePath}${reset}\n`;
        if (fileMeta?.totalLinesRemoved) {
          result += `${gray}-${fileMeta.totalLinesRemoved} lines${reset}\n`;
        }
        break;
        
      case 'edit':
        result = `${yellow}[${timestamp}] File edited ${gray}at ${filePath}${reset}\n\n`;
        
        // Render the diff lines (only for edit operation)
        for (const diff of diffs) {
          const lineNum = `${gray}${String(diff.lineNumber).padStart(4, ' ')}  ${reset}`;
          
          switch (diff.type) {
            case 'added':
              result += `${lineNum}${green}+ ${diff.newContent || ''}${reset}\n`;
              break;
              
            case 'removed':
              result += `${lineNum}${red}- ${diff.oldContent || ''}${reset}\n`;
              break;
              
            case 'modified':
              if (diff.oldContent) {
                result += `${lineNum}${red}- ${diff.oldContent}${reset}\n`;
              }
              if (diff.newContent) {
                result += `${lineNum}${green}+ ${diff.newContent}${reset}\n`;
              }
              break;
              
            case 'unchanged':
              // Show context lines in gray
              result += `${lineNum}${gray}  ${diff.oldContent || ''}${reset}\n`;
              break;
          }
        }
        
        // Show line count summary
        const linesAdded = fileMeta?.totalLinesAdded || 
          diffs.filter((d: DiffLine) => d.type === 'added' || d.type === 'modified').length;
        const linesRemoved = fileMeta?.totalLinesRemoved || 
          diffs.filter((d: DiffLine) => d.type === 'removed' || d.type === 'modified').length;
        
        if (linesAdded > 0 || linesRemoved > 0) {
          result += `\n${gray}`;
          if (linesAdded > 0 && linesRemoved > 0) {
            result += `+${linesAdded} / -${linesRemoved} lines`;
          } else if (linesAdded > 0) {
            result += `+${linesAdded} lines`;
          } else if (linesRemoved > 0) {
            result += `-${linesRemoved} lines`;
          }
          result += `${reset}`;
        }
        break;
    }
    
    return result;
  }
}