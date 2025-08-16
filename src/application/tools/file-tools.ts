import * as fs from 'fs/promises';
import { Observable, Subject } from 'rxjs';
import { ToolDefinition, ToolCall, ToolResult, Toolbox } from '../interfaces/toolbox.js';
import { EmbeddingService } from '../interfaces/embedding-service.js';
import { DomainMessage, FileOperationMessage, PlainMessage } from '../../presentation/view-models/console/console-use-case.js';

/**
 * File content result
 */
export interface FileContent {
  content: string;
  totalLines: number;
  startLine: number;
  endLine: number;
}

/**
 * Bulk edit operation
 */
export interface BulkEditOperation {
  type: 'replace_at_line' | 'insert_at_line' | 'append_to_file';
  content: string;
  lineNumber?: number; // Required for replace_at_line and insert_at_line, not used for append_to_file
}

/**
 * File tools implementation
 */
export class FileTools implements Toolbox {
  // Public getters
  readonly id = 'file_tools';
  readonly description = 'File operations toolbox for reading, writing, and modifying files';

  // Private properties
  private readonly domainMessagesSubject = new Subject<DomainMessage>();

  /**
   * Observable stream of domain messages for rich UI updates
   */
  get domainMessages$(): Observable<DomainMessage> {
    return this.domainMessagesSubject.asObservable();
  }

  constructor(public readonly embeddingService: EmbeddingService) {}

  getTools(): ToolDefinition[] {
    return [
      {
        name: 'read_file',
        description: 'Read file content with pagination (100 lines per page)',
        parameters: [
          { name: 'filePath', type: 'string', description: 'Path to the file', required: true },
          { name: 'startLine', type: 'number', description: 'Starting line number (1-based)', required: false, default: 1 },
          { name: 'lineCount', type: 'number', description: 'Number of lines to read', required: false, default: 100 }
        ],
        permission: 'none'
      },
      {
        name: 'append_to_file',
        description: 'Append text to end of file',
        parameters: [
          { name: 'filePath', type: 'string', description: 'Path to the file', required: true },
          { name: 'content', type: 'string', description: 'Content to append', required: true }
        ],
        permission: 'loose'
      },
      {
        name: 'insert_at_line',
        description: 'Insert text at specific line number',
        parameters: [
          { name: 'filePath', type: 'string', description: 'Path to the file', required: true },
          { name: 'lineNumber', type: 'number', description: 'Line number to insert at (1-based)', required: true },
          { name: 'content', type: 'string', description: 'Content to insert', required: true }
        ],
        permission: 'loose'
      },
      {
        name: 'replace_at_line',
        description: 'Replace text at specific line number',
        parameters: [
          { name: 'filePath', type: 'string', description: 'Path to the file', required: true },
          { name: 'lineNumber', type: 'number', description: 'Line number to replace (1-based)', required: true },
          { name: 'content', type: 'string', description: 'New content for the line', required: true }
        ],
        permission: 'loose'
      },
      {
        name: 'replace_with_regex',
        description: 'Replace text using regex (fails if multiple matches found)',
        parameters: [
          { name: 'filePath', type: 'string', description: 'Path to the file', required: true },
          { name: 'lineNumber', type: 'number', description: 'Line number to apply regex (1-based)', required: false },
          { name: 'pattern', type: 'string', description: 'Regex pattern', required: true },
          { name: 'replacement', type: 'string', description: 'Replacement text', required: true }
        ],
        permission: 'loose'
      },
      {
        name: 'replace_all_with_regex',
        description: 'Replace all text using regex across multiple lines',
        parameters: [
          { name: 'filePath', type: 'string', description: 'Path to the file', required: true },
          { name: 'pattern', type: 'string', description: 'Regex pattern', required: true },
          { name: 'replacement', type: 'string', description: 'Replacement text', required: true },
          { name: 'flags', type: 'string', description: 'Regex flags (g, i, m, s)', required: false, default: 'g' }
        ],
        permission: 'loose'
      },
      {
        name: 'bulk_edit',
        description: 'Perform multiple file operations in sequence (replace_at_line, insert_at_line, append_to_file)',
        parameters: [
          { name: 'filePath', type: 'string', description: 'Path to the file', required: true },
          { name: 'operations', type: 'array', description: 'Array of operations to perform', required: true }
        ],
        permission: 'loose'
      }
    ];
  }

  supportsTool(toolName: string): boolean {
    return this.getTools().some(tool => tool.name === toolName);
  }

  async executeTool(toolCall: ToolCall): Promise<ToolResult> {
    try {
      switch (toolCall.name) {
        case 'read_file':
          const fileContent = await this.readFile(
            toolCall.parameters.filePath,
            toolCall.parameters.startLine,
            toolCall.parameters.lineCount
          );
          
          this.publishReadMessage(
            toolCall.parameters.filePath,
            fileContent.startLine,
            fileContent.endLine,
            fileContent.totalLines
          );
          
          return { success: true, data: fileContent };

        case 'append_to_file':
          const beforeAppendContent = await this.getFileContent(toolCall.parameters.filePath);
          const appendResult = await this.appendToFile(
            toolCall.parameters.filePath,
            toolCall.parameters.content
          );
          
          if (appendResult) {
            const afterAppendContent = await this.getFileContent(toolCall.parameters.filePath);
            this.publishFileOperationMessage(
              toolCall.parameters.filePath,
              'add',
              beforeAppendContent,
              afterAppendContent
            );
          }
          
          return { success: appendResult, message: appendResult ? 'Content appended successfully' : 'Failed to append content' };

        case 'insert_at_line':
          const beforeInsertContent = await this.getFileContent(toolCall.parameters.filePath);
          const insertResult = await this.insertAtLine(
            toolCall.parameters.filePath,
            toolCall.parameters.lineNumber,
            toolCall.parameters.content
          );
          
          if (insertResult) {
            const afterInsertContent = await this.getFileContent(toolCall.parameters.filePath);
            this.publishFileOperationMessage(
              toolCall.parameters.filePath,
              'add',
              beforeInsertContent,
              afterInsertContent
            );
          }
          
          return { success: insertResult, message: insertResult ? 'Content inserted successfully' : 'Failed to insert content' };

        case 'replace_at_line':
          const beforeReplaceContent = await this.getFileContent(toolCall.parameters.filePath);
          const replaceResult = await this.replaceAtLine(
            toolCall.parameters.filePath,
            toolCall.parameters.lineNumber,
            toolCall.parameters.content
          );
          
          if (replaceResult) {
            const afterReplaceContent = await this.getFileContent(toolCall.parameters.filePath);
            this.publishFileOperationMessage(
              toolCall.parameters.filePath,
              'edit',
              beforeReplaceContent,
              afterReplaceContent
            );
          }
          
          return { success: replaceResult, message: replaceResult ? 'Line replaced successfully' : 'Failed to replace line' };

        case 'replace_with_regex':
          const beforeRegexContent = await this.getFileContent(toolCall.parameters.filePath);
          const regexResult = await this.replaceWithRegex(
            toolCall.parameters.filePath,
            toolCall.parameters.lineNumber,
            toolCall.parameters.pattern,
            toolCall.parameters.replacement
          );
          
          if (regexResult.success) {
            const afterRegexContent = await this.getFileContent(toolCall.parameters.filePath);
            this.publishFileOperationMessage(
              toolCall.parameters.filePath,
              'edit',
              beforeRegexContent,
              afterRegexContent
            );
          }
          
          return { 
            success: regexResult.success, 
            message: regexResult.success ? 'Regex replacement successful' : regexResult.error 
          };

        case 'replace_all_with_regex':
          const beforeReplaceAllContent = await this.getFileContent(toolCall.parameters.filePath);
          const replaceAllResult = await this.replaceAllWithRegex(
            toolCall.parameters.filePath,
            toolCall.parameters.pattern,
            toolCall.parameters.replacement,
            toolCall.parameters.flags
          );
          
          if (replaceAllResult.success && replaceAllResult.replaced > 0) {
            const afterReplaceAllContent = await this.getFileContent(toolCall.parameters.filePath);
            this.publishFileOperationMessage(
              toolCall.parameters.filePath,
              'edit',
              beforeReplaceAllContent,
              afterReplaceAllContent
            );
          }
          
          return { 
            success: replaceAllResult.success, 
            data: replaceAllResult,
            message: `Replaced ${replaceAllResult.replaced} occurrences`
          };

        case 'bulk_edit':
          const beforeBulkContent = await this.getFileContent(toolCall.parameters.filePath);
          const bulkResult = await this.bulkEdit(
            toolCall.parameters.filePath,
            toolCall.parameters.operations
          );
          
          if (bulkResult.success && bulkResult.operationsCompleted > 0) {
            const afterBulkContent = await this.getFileContent(toolCall.parameters.filePath);
            this.publishFileOperationMessage(
              toolCall.parameters.filePath,
              'edit',
              beforeBulkContent,
              afterBulkContent
            );
          }
          
          return { 
            success: bulkResult.success, 
            data: bulkResult,
            message: bulkResult.success 
              ? `Completed ${bulkResult.operationsCompleted} operations` 
              : bulkResult.error 
          };

        default:
          return { success: false, error: `Unknown tool: ${toolCall.name}` };
      }
    } catch (error) {
      return { 
        success: false, 
        error: `Tool execution failed: ${error instanceof Error ? error.message : String(error)}` 
      };
    }
  }

  async readFile(filePath: string, startLine: number = 1, lineCount: number = 100): Promise<FileContent> {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const totalLines = lines.length;
    
    const start = Math.max(0, startLine - 1);
    const end = Math.min(totalLines, start + lineCount);
    
    const selectedLines = lines.slice(start, end);
    
    return {
      content: selectedLines.join('\n'),
      totalLines,
      startLine: start + 1,
      endLine: end
    };
  }

  async appendToFile(filePath: string, content: string): Promise<boolean> {
    try {
      await fs.appendFile(filePath, content);
      return true;
    } catch {
      return false;
    }
  }

  async insertAtLine(filePath: string, lineNumber: number, content: string): Promise<boolean> {
    try {
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const lines = fileContent.split('\n');
      
      const insertIndex = Math.max(0, Math.min(lines.length, lineNumber - 1));
      lines.splice(insertIndex, 0, content);
      
      await fs.writeFile(filePath, lines.join('\n'));
      return true;
    } catch {
      return false;
    }
  }

  async replaceAtLine(filePath: string, lineNumber: number, content: string): Promise<boolean> {
    try {
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const lines = fileContent.split('\n');
      
      if (lineNumber < 1 || lineNumber > lines.length) {
        return false;
      }
      
      lines[lineNumber - 1] = content;
      await fs.writeFile(filePath, lines.join('\n'));
      return true;
    } catch {
      return false;
    }
  }

  async replaceWithRegex(filePath: string, lineNumber: number | undefined, pattern: string, replacement: string): Promise<{ success: boolean; error?: string }> {
    try {
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const regex = new RegExp(pattern, 'g');
      
      // Count total matches in the file
      const matches: RegExpExecArray[] = [];
      let match: RegExpExecArray | null;
      while ((match = regex.exec(fileContent)) !== null) {
        matches.push(match);
      }
      
      if (matches.length === 0) {
        return { success: false, error: 'No matches found for the pattern' };
      }
      
      if (matches.length > 1) {
        return { 
          success: false, 
          error: `Multiple matches found (${matches.length}). Use replace_all_with_regex to replace all occurrences` 
        };
      }
      
      // If lineNumber is specified, validate it matches the found line
      if (lineNumber !== undefined) {
        const lines = fileContent.split('\n');
        if (lineNumber < 1 || lineNumber > lines.length) {
          return { success: false, error: 'Invalid line number' };
        }
        
        const lineContent = lines[lineNumber - 1];
        if (!new RegExp(pattern).test(lineContent)) {
          return { success: false, error: 'Pattern not found on specified line' };
        }
      }
      
      // Replace the single match
      const newContent = fileContent.replace(new RegExp(pattern), replacement);
      await fs.writeFile(filePath, newContent);
      
      return { success: true };
    } catch (error) {
      return { success: false, error: `File operation failed: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  async replaceAllWithRegex(filePath: string, pattern: string, replacement: string, flags: string = 'g'): Promise<{ replaced: number; success: boolean }> {
    try {
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const regex = new RegExp(pattern, flags);
      
      let replaced = 0;
      const newContent = fileContent.replace(regex, () => {
        replaced++;
        return replacement;
      });
      
      await fs.writeFile(filePath, newContent);
      return { replaced, success: true };
    } catch {
      return { replaced: 0, success: false };
    }
  }

  async bulkEdit(filePath: string, operations: BulkEditOperation[]): Promise<{ success: boolean; operationsCompleted: number; error?: string }> {
    try {
      // Validate all operations first
      for (const operation of operations) {
        if (!this.isValidBulkOperation(operation)) {
          return { 
            success: false, 
            operationsCompleted: 0, 
            error: `Invalid operation: ${JSON.stringify(operation)}` 
          };
        }
      }

      // Sort operations by line number (descending) for insert/replace operations
      // This prevents line number shifts from affecting subsequent operations
      const sortedOperations = [...operations].sort((a, b) => {
        if (a.type === 'append_to_file' && b.type !== 'append_to_file') return 1;
        if (a.type !== 'append_to_file' && b.type === 'append_to_file') return -1;
        if (a.type === 'append_to_file' && b.type === 'append_to_file') return 0;
        
        const aLine = (a.type === 'replace_at_line' || a.type === 'insert_at_line') ? (a.lineNumber || 0) : 0;
        const bLine = (b.type === 'replace_at_line' || b.type === 'insert_at_line') ? (b.lineNumber || 0) : 0;
        
        return bLine - aLine; // Descending order
      });

      let operationsCompleted = 0;
      
      for (const operation of sortedOperations) {
        let success = false;
        
        switch (operation.type) {
          case 'replace_at_line':
            success = await this.replaceAtLine(filePath, operation.lineNumber!, operation.content);
            break;
          case 'insert_at_line':
            success = await this.insertAtLine(filePath, operation.lineNumber!, operation.content);
            break;
          case 'append_to_file':
            success = await this.appendToFile(filePath, operation.content);
            break;
        }
        
        if (!success) {
          return { 
            success: false, 
            operationsCompleted, 
            error: `Operation failed: ${operation.type} at line ${operation.type === 'append_to_file' ? 'end' : (operation.lineNumber || 'unknown')}` 
          };
        }
        
        operationsCompleted++;
      }
      
      return { success: true, operationsCompleted };
    } catch (error) {
      return { 
        success: false, 
        operationsCompleted: 0, 
        error: `Bulk edit failed: ${error instanceof Error ? error.message : String(error)}` 
      };
    }
  }

  private isValidBulkOperation(operation: BulkEditOperation): boolean {
    if (!operation.type || !operation.content) {
      return false;
    }
    
    switch (operation.type) {
      case 'replace_at_line':
      case 'insert_at_line':
        return typeof operation.lineNumber === 'number' && operation.lineNumber > 0;
      case 'append_to_file':
        return true;
      default:
        return false;
    }
  }

  private async getFileContent(filePath: string): Promise<string[]> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return content.split('\n');
    } catch {
      return [];
    }
  }

  private publishReadMessage(filePath: string, startLine: number, endLine: number, totalLines: number): void {
    const message: PlainMessage = {
      id: this.generateMessageId(),
      type: 'system',
      content: `Read ${filePath} lines ${startLine}-${endLine} (total: ${totalLines})`,
      timestamp: new Date()
    };
    
    this.domainMessagesSubject.next(message);
  }

  private publishFileOperationMessage(
    filePath: string,
    operation: 'edit' | 'add' | 'delete',
    beforeLines: string[],
    afterLines: string[]
  ): void {
    const diffs = this.generateDiffs(beforeLines, afterLines);
    const contextDiffs = this.addContext(diffs, beforeLines, afterLines);
    
    const message: FileOperationMessage = {
      id: this.generateMessageId(),
      type: 'file-operation',
      content: `${operation === 'edit' ? 'Modified' : operation === 'add' ? 'Added to' : 'Deleted from'} ${filePath}`,
      timestamp: new Date(),
      metadata: {
        filePath,
        fileOperation: operation,
        diffs: contextDiffs,
        totalLinesAdded: contextDiffs.filter(d => d.type === 'added').length,
        totalLinesRemoved: contextDiffs.filter(d => d.type === 'removed').length
      }
    };
    
    this.domainMessagesSubject.next(message);
  }

  private generateDiffs(beforeLines: string[], afterLines: string[]): Array<{
    lineNumber: number;
    type: 'unchanged' | 'added' | 'removed' | 'modified';
    oldContent?: string;
    newContent?: string;
  }> {
    const diffs: Array<{
      lineNumber: number;
      type: 'unchanged' | 'added' | 'removed' | 'modified';
      oldContent?: string;
      newContent?: string;
    }> = [];

    const maxLength = Math.max(beforeLines.length, afterLines.length);
    
    for (let i = 0; i < maxLength; i++) {
      const oldLine = beforeLines[i];
      const newLine = afterLines[i];
      
      if (oldLine === undefined && newLine !== undefined) {
        diffs.push({
          lineNumber: i + 1,
          type: 'added',
          newContent: newLine
        });
      } else if (oldLine !== undefined && newLine === undefined) {
        diffs.push({
          lineNumber: i + 1,
          type: 'removed',
          oldContent: oldLine
        });
      } else if (oldLine !== newLine) {
        diffs.push({
          lineNumber: i + 1,
          type: 'modified',
          oldContent: oldLine,
          newContent: newLine
        });
      } else {
        diffs.push({
          lineNumber: i + 1,
          type: 'unchanged',
          oldContent: oldLine,
          newContent: newLine
        });
      }
    }
    
    return diffs;
  }

  private addContext(diffs: Array<{
    lineNumber: number;
    type: 'unchanged' | 'added' | 'removed' | 'modified';
    oldContent?: string;
    newContent?: string;
  }>, _beforeLines: string[], _afterLines: string[]): Array<{
    lineNumber: number;
    type: 'unchanged' | 'added' | 'removed' | 'modified';
    oldContent?: string;
    newContent?: string;
  }> {
    const changedLines = diffs.filter(d => d.type !== 'unchanged');
    if (changedLines.length === 0) return diffs;
    
    const result: Array<{
      lineNumber: number;
      type: 'unchanged' | 'added' | 'removed' | 'modified';
      oldContent?: string;
      newContent?: string;
    }> = [];
    
    const firstChangedLine = Math.min(...changedLines.map(d => d.lineNumber));
    const lastChangedLine = Math.max(...changedLines.map(d => d.lineNumber));
    
    const startContext = Math.max(0, firstChangedLine - 3);
    const endContext = Math.min(diffs.length - 1, lastChangedLine + 3);
    
    for (let i = startContext; i <= endContext; i++) {
      if (diffs[i]) {
        result.push(diffs[i]);
      }
    }
    
    return result;
  }

  private generateMessageId(): string {
    return `file_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}