import * as fs from 'fs/promises';
import * as path from 'path';
import { Observable, EMPTY } from 'rxjs';
import { ToolDefinition, ToolCall, ToolResult, Toolbox, ToolboxMessage } from '../interfaces/toolbox.js';
import { EmbeddingService } from '../interfaces/embedding-service.js';

/**
 * File system entry information
 */
export interface FileSystemEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  lastModified?: Date;
}

/**
 * Directory listing result
 */
export interface DirectoryListing {
  path: string;
  entries: FileSystemEntry[];
  totalCount: number;
}

/**
 * Workspace tools implementation
 */
export class WorkspaceTools implements Toolbox {

  readonly id = 'workspace_tools';
  readonly description = 'Workspace operations toolbox for file system navigation and management';

  /**
   * Individual toolboxes don't emit messages - this is handled by ToolboxService
   */
  readonly messages$: Observable<ToolboxMessage> = EMPTY;

  constructor(public readonly embeddingService: EmbeddingService) {}

  getTools(): ToolDefinition[] {
    return [
      {
        name: 'list_directory',
        description: 'Get list of files and folders in given path',
        parameters: [
          { name: 'path', type: 'string', description: 'Directory path to list', required: true },
          { name: 'includeHidden', type: 'boolean', description: 'Include hidden files and folders', required: false, default: false }
        ],
        permission: 'none'
      },
      {
        name: 'get_current_path',
        description: 'Get current working directory',
        parameters: [],
        permission: 'none'
      },
      {
        name: 'delete_file_or_directory',
        description: 'Delete file or directory',
        parameters: [
          { name: 'path', type: 'string', description: 'Path to delete', required: true },
          { name: 'recursive', type: 'boolean', description: 'Delete recursively for directories', required: false, default: false }
        ],
        permission: 'always'
      },
      {
        name: 'create_file',
        description: 'Create new file with optional content',
        parameters: [
          { name: 'filePath', type: 'string', description: 'File path to create', required: true },
          { name: 'content', type: 'string', description: 'Initial file content', required: false, default: '' }
        ],
        permission: 'loose'
      },
      {
        name: 'create_directory',
        description: 'Create new directory',
        parameters: [
          { name: 'directoryPath', type: 'string', description: 'Directory path to create', required: true },
          { name: 'recursive', type: 'boolean', description: 'Create parent directories if needed', required: false, default: false }
        ],
        permission: 'loose'
      },
      {
        name: 'exists',
        description: 'Check if file or directory exists',
        parameters: [
          { name: 'path', type: 'string', description: 'Path to check', required: true }
        ],
        permission: 'none'
      },
      {
        name: 'get_info',
        description: 'Get file or directory information',
        parameters: [
          { name: 'path', type: 'string', description: 'Path to get info for', required: true }
        ],
        permission: 'none'
      }
    ];
  }

  supportsTool(toolName: string): boolean {
    return this.getTools().some(tool => tool.name === toolName);
  }

  async executeTool(toolCall: ToolCall): Promise<ToolResult> {
    try {
      switch (toolCall.name) {
        case 'list_directory':
          const listing = await this.listDirectory(
            toolCall.parameters.path,
            toolCall.parameters.includeHidden
          );
          return { success: true, data: listing };

        case 'get_current_path':
          const currentPath = await this.getCurrentPath();
          return { success: true, data: { currentPath } };

        case 'delete_file_or_directory':
          const deleteResult = await this.deleteFileOrDirectory(
            toolCall.parameters.path,
            toolCall.parameters.recursive
          );
          return { 
            success: deleteResult, 
            message: deleteResult ? 'Deleted successfully' : 'Failed to delete' 
          };

        case 'create_file':
          const createFileResult = await this.createFile(
            toolCall.parameters.filePath,
            toolCall.parameters.content
          );
          return { 
            success: createFileResult, 
            message: createFileResult ? 'File created successfully' : 'Failed to create file' 
          };

        case 'create_directory':
          const createDirResult = await this.createDirectory(
            toolCall.parameters.directoryPath,
            toolCall.parameters.recursive
          );
          return { 
            success: createDirResult, 
            message: createDirResult ? 'Directory created successfully' : 'Failed to create directory' 
          };

        case 'exists':
          const existsResult = await this.exists(toolCall.parameters.path);
          return { success: true, data: { exists: existsResult } };

        case 'get_info':
          const info = await this.getInfo(toolCall.parameters.path);
          return { success: true, data: { info } };

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

  async listDirectory(directoryPath: string, includeHidden: boolean = false): Promise<DirectoryListing> {
    const entries: FileSystemEntry[] = [];
    
    const dirents = await fs.readdir(directoryPath, { withFileTypes: true });
    
    for (const dirent of dirents) {
      if (!includeHidden && dirent.name.startsWith('.')) {
        continue;
      }

      const fullPath = path.join(directoryPath, dirent.name);
      
      try {
        const stats = await fs.stat(fullPath);
        
        entries.push({
          name: dirent.name,
          path: fullPath,
          type: dirent.isDirectory() ? 'directory' : 'file',
          size: dirent.isFile() ? stats.size : undefined,
          lastModified: stats.mtime
        });
      } catch {
        // If we can't get stats, still include the entry with basic info
        entries.push({
          name: dirent.name,
          path: fullPath,
          type: dirent.isDirectory() ? 'directory' : 'file'
        });
      }
    }

    return {
      path: directoryPath,
      entries: entries.sort((a, b) => {
        // Directories first, then files, both alphabetically
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      }),
      totalCount: entries.length
    };
  }

  async getCurrentPath(): Promise<string> {
    return process.cwd();
  }

  async deleteFileOrDirectory(targetPath: string, recursive: boolean = false): Promise<boolean> {
    try {
      const stats = await fs.stat(targetPath);
      
      if (stats.isDirectory()) {
        await fs.rmdir(targetPath, { recursive });
      } else {
        await fs.unlink(targetPath);
      }
      
      return true;
    } catch {
      return false;
    }
  }

  async createFile(filePath: string, content: string = ''): Promise<boolean> {
    try {
      // Ensure parent directory exists
      const parentDir = path.dirname(filePath);
      await fs.mkdir(parentDir, { recursive: true });
      
      await fs.writeFile(filePath, content, { flag: 'wx' }); // 'wx' fails if file exists
      return true;
    } catch {
      return false;
    }
  }

  async createDirectory(directoryPath: string, recursive: boolean = false): Promise<boolean> {
    try {
      await fs.mkdir(directoryPath, { recursive });
      return true;
    } catch {
      return false;
    }
  }

  async exists(targetPath: string): Promise<boolean> {
    try {
      await fs.access(targetPath);
      return true;
    } catch {
      return false;
    }
  }

  async getInfo(targetPath: string): Promise<FileSystemEntry | null> {
    try {
      const stats = await fs.stat(targetPath);
      const name = path.basename(targetPath);
      
      return {
        name,
        path: targetPath,
        type: stats.isDirectory() ? 'directory' : 'file',
        size: stats.isFile() ? stats.size : undefined,
        lastModified: stats.mtime
      };
    } catch {
      return null;
    }
  }
}