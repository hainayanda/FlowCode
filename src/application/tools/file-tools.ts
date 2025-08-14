import * as fs from 'fs/promises';
import { Observable, EMPTY } from 'rxjs';
import { ToolDefinition, ToolCall, ToolResult, Toolbox, ToolboxMessage } from '../interfaces/toolbox.js';
import { EmbeddingService } from '../interfaces/embedding-service.js';

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
 * File tools implementation
 */
export class FileTools implements Toolbox {
  
  readonly id = 'file_tools';
  readonly description = 'File operations toolbox for reading, writing, and modifying files';

  /**
   * Individual toolboxes don't emit messages - this is handled by ToolboxService
   */
  readonly messages$: Observable<ToolboxMessage> = EMPTY;

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
        description: 'Replace text using regex on single line',
        parameters: [
          { name: 'filePath', type: 'string', description: 'Path to the file', required: true },
          { name: 'lineNumber', type: 'number', description: 'Line number to apply regex (1-based)', required: true },
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
          return { success: true, data: fileContent };

        case 'append_to_file':
          const appendResult = await this.appendToFile(
            toolCall.parameters.filePath,
            toolCall.parameters.content
          );
          return { success: appendResult, message: appendResult ? 'Content appended successfully' : 'Failed to append content' };

        case 'insert_at_line':
          const insertResult = await this.insertAtLine(
            toolCall.parameters.filePath,
            toolCall.parameters.lineNumber,
            toolCall.parameters.content
          );
          return { success: insertResult, message: insertResult ? 'Content inserted successfully' : 'Failed to insert content' };

        case 'replace_at_line':
          const replaceResult = await this.replaceAtLine(
            toolCall.parameters.filePath,
            toolCall.parameters.lineNumber,
            toolCall.parameters.content
          );
          return { success: replaceResult, message: replaceResult ? 'Line replaced successfully' : 'Failed to replace line' };

        case 'replace_with_regex':
          const regexResult = await this.replaceWithRegex(
            toolCall.parameters.filePath,
            toolCall.parameters.lineNumber,
            toolCall.parameters.pattern,
            toolCall.parameters.replacement
          );
          return { success: regexResult, message: regexResult ? 'Regex replacement successful' : 'Regex replacement failed' };

        case 'replace_all_with_regex':
          const replaceAllResult = await this.replaceAllWithRegex(
            toolCall.parameters.filePath,
            toolCall.parameters.pattern,
            toolCall.parameters.replacement,
            toolCall.parameters.flags
          );
          return { 
            success: replaceAllResult.success, 
            data: replaceAllResult,
            message: `Replaced ${replaceAllResult.replaced} occurrences`
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

  async replaceWithRegex(filePath: string, lineNumber: number, pattern: string, replacement: string): Promise<boolean> {
    try {
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const lines = fileContent.split('\n');
      
      if (lineNumber < 1 || lineNumber > lines.length) {
        return false;
      }
      
      const regex = new RegExp(pattern);
      lines[lineNumber - 1] = lines[lineNumber - 1].replace(regex, replacement);
      
      await fs.writeFile(filePath, lines.join('\n'));
      return true;
    } catch {
      return false;
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
}