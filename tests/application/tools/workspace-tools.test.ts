import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WorkspaceTools } from '../../../src/application/tools/workspace-tools.js';
import { EmbeddingService } from '../../../src/application/interfaces/embedding-service.js';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock fs and path modules
vi.mock('fs/promises');
vi.mock('path');

const mockFs = vi.mocked(fs);
const mockPath = vi.mocked(path);

/**
 * Mock EmbeddingService for testing
 */
class MockEmbeddingService implements EmbeddingService {
  async generateEmbedding(_text: string): Promise<number[]> {
    return new Array(1536).fill(0);
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  getEmbeddingDimension(): number {
    return 1536;
  }

  async validateConfig(): Promise<boolean> {
    return true;
  }
}

describe('WorkspaceTools', () => {
  let workspaceTools: WorkspaceTools;
  let mockEmbeddingService: MockEmbeddingService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEmbeddingService = new MockEmbeddingService();
    workspaceTools = new WorkspaceTools(mockEmbeddingService);
    
    // Setup path mocks
    mockPath.join.mockImplementation((...paths) => paths.join('/'));
    mockPath.basename.mockImplementation((p) => p.split('/').pop() || '');
    mockPath.dirname.mockImplementation((p) => p.split('/').slice(0, -1).join('/') || '/');
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Initialization', () => {
    it('should have correct id and description', () => {
      expect(workspaceTools.id).toBe('workspace_tools');
      expect(workspaceTools.description).toBe('Workspace operations toolbox for file system navigation and management');
    });

    it('should return all tool definitions', () => {
      const tools = workspaceTools.getTools();
      
      expect(tools).toHaveLength(7);
      expect(tools.map(t => t.name)).toContain('list_directory');
      expect(tools.map(t => t.name)).toContain('get_current_path');
      expect(tools.map(t => t.name)).toContain('delete_file_or_directory');
      expect(tools.map(t => t.name)).toContain('create_file');
      expect(tools.map(t => t.name)).toContain('create_directory');
      expect(tools.map(t => t.name)).toContain('exists');
      expect(tools.map(t => t.name)).toContain('get_info');
    });

    it('should have correct permission levels', () => {
      const tools = workspaceTools.getTools();
      
      const listTool = tools.find(t => t.name === 'list_directory');
      expect(listTool?.permission).toBe('none');
      
      const deleteTool = tools.find(t => t.name === 'delete_file_or_directory');
      expect(deleteTool?.permission).toBe('always');
      
      const createFileTool = tools.find(t => t.name === 'create_file');
      expect(createFileTool?.permission).toBe('loose');
    });
  });

  describe('List Directory Tool', () => {
    it('should list directory contents', async () => {
      const mockDirents = [
        { name: 'file1.txt', isDirectory: () => false, isFile: () => true },
        { name: 'folder1', isDirectory: () => true, isFile: () => false },
        { name: '.hidden', isDirectory: () => false, isFile: () => true }
      ];

      const mockStats = {
        size: 1024,
        mtime: new Date('2023-01-01')
      };

      mockFs.readdir.mockResolvedValue(mockDirents as any);
      mockFs.stat.mockResolvedValue(mockStats as any);

      const result = await workspaceTools.executeTool({
        name: 'list_directory',
        parameters: { path: '/test/dir', includeHidden: false }
      });

      expect(result.success).toBe(true);
      expect(result.data?.entries).toHaveLength(2); // Should exclude .hidden
      expect(result.data?.entries[0].type).toBe('directory'); // Directories first
      expect(result.data?.entries[1].type).toBe('file');
      expect(result.data?.totalCount).toBe(2);
    });

    it('should include hidden files when requested', async () => {
      const mockDirents = [
        { name: 'file1.txt', isDirectory: () => false, isFile: () => true },
        { name: '.hidden', isDirectory: () => false, isFile: () => true }
      ];

      mockFs.readdir.mockResolvedValue(mockDirents as any);
      mockFs.stat.mockResolvedValue({ size: 1024, mtime: new Date() } as any);

      const result = await workspaceTools.executeTool({
        name: 'list_directory',
        parameters: { path: '/test/dir', includeHidden: true }
      });

      expect(result.success).toBe(true);
      expect(result.data?.entries).toHaveLength(2); // Should include .hidden
    });
  });

  describe('Get Current Path Tool', () => {
    it('should return current working directory', async () => {
      const originalCwd = process.cwd;
      process.cwd = vi.fn().mockReturnValue('/current/directory');

      const result = await workspaceTools.executeTool({
        name: 'get_current_path',
        parameters: {}
      });

      expect(result.success).toBe(true);
      expect(result.data?.currentPath).toBe('/current/directory');

      process.cwd = originalCwd;
    });
  });

  describe('Delete File or Directory Tool', () => {
    it('should delete a file', async () => {
      mockFs.stat.mockResolvedValue({ isDirectory: () => false } as any);
      mockFs.unlink.mockResolvedValue(undefined);

      const result = await workspaceTools.executeTool({
        name: 'delete_file_or_directory',
        parameters: { path: '/test/file.txt' }
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Deleted successfully');
      expect(mockFs.unlink).toHaveBeenCalledWith('/test/file.txt');
    });

    it('should delete a directory', async () => {
      mockFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockFs.rmdir.mockResolvedValue(undefined);

      const result = await workspaceTools.executeTool({
        name: 'delete_file_or_directory',
        parameters: { path: '/test/dir', recursive: true }
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Deleted successfully');
      expect(mockFs.rmdir).toHaveBeenCalledWith('/test/dir', { recursive: true });
    });

    it('should handle delete errors', async () => {
      mockFs.stat.mockRejectedValue(new Error('File not found'));

      const result = await workspaceTools.executeTool({
        name: 'delete_file_or_directory',
        parameters: { path: '/nonexistent/file.txt' }
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Failed to delete');
    });
  });

  describe('Create File Tool', () => {
    it('should create a new file with content', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      const result = await workspaceTools.executeTool({
        name: 'create_file',
        parameters: { filePath: '/test/new-file.txt', content: 'file content' }
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('File created successfully');
      expect(mockFs.mkdir).toHaveBeenCalledWith('/test', { recursive: true });
      expect(mockFs.writeFile).toHaveBeenCalledWith('/test/new-file.txt', 'file content', { flag: 'wx' });
    });

    it('should create a new file without content', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      const result = await workspaceTools.executeTool({
        name: 'create_file',
        parameters: { filePath: '/test/empty-file.txt' }
      });

      expect(result.success).toBe(true);
      expect(mockFs.writeFile).toHaveBeenCalledWith('/test/empty-file.txt', '', { flag: 'wx' });
    });

    it('should handle file creation errors', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockRejectedValue(new Error('File already exists'));

      const result = await workspaceTools.executeTool({
        name: 'create_file',
        parameters: { filePath: '/test/existing-file.txt' }
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Failed to create file');
    });
  });

  describe('Create Directory Tool', () => {
    it('should create a new directory', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);

      const result = await workspaceTools.executeTool({
        name: 'create_directory',
        parameters: { directoryPath: '/test/new-dir', recursive: false }
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Directory created successfully');
      expect(mockFs.mkdir).toHaveBeenCalledWith('/test/new-dir', { recursive: false });
    });

    it('should create directory recursively', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);

      const result = await workspaceTools.executeTool({
        name: 'create_directory',
        parameters: { directoryPath: '/test/deep/nested/dir', recursive: true }
      });

      expect(result.success).toBe(true);
      expect(mockFs.mkdir).toHaveBeenCalledWith('/test/deep/nested/dir', { recursive: true });
    });
  });

  describe('Exists Tool', () => {
    it('should return true when path exists', async () => {
      mockFs.access.mockResolvedValue(undefined);

      const result = await workspaceTools.executeTool({
        name: 'exists',
        parameters: { path: '/test/existing-file.txt' }
      });

      expect(result.success).toBe(true);
      expect(result.data?.exists).toBe(true);
    });

    it('should return false when path does not exist', async () => {
      mockFs.access.mockRejectedValue(new Error('File not found'));

      const result = await workspaceTools.executeTool({
        name: 'exists',
        parameters: { path: '/test/nonexistent-file.txt' }
      });

      expect(result.success).toBe(true);
      expect(result.data?.exists).toBe(false);
    });
  });

  describe('Get Info Tool', () => {
    it('should return file information', async () => {
      const mockStats = {
        isDirectory: () => false,
        isFile: () => true,
        size: 2048,
        mtime: new Date('2023-01-01')
      };

      mockFs.stat.mockResolvedValue(mockStats as any);

      const result = await workspaceTools.executeTool({
        name: 'get_info',
        parameters: { path: '/test/file.txt' }
      });

      expect(result.success).toBe(true);
      expect(result.data?.info?.name).toBe('file.txt');
      expect(result.data?.info?.type).toBe('file');
      expect(result.data?.info?.size).toBe(2048);
    });

    it('should return directory information', async () => {
      const mockStats = {
        isDirectory: () => true,
        isFile: () => false,
        mtime: new Date('2023-01-01')
      };

      mockFs.stat.mockResolvedValue(mockStats as any);

      const result = await workspaceTools.executeTool({
        name: 'get_info',
        parameters: { path: '/test/directory' }
      });

      expect(result.success).toBe(true);
      expect(result.data?.info?.type).toBe('directory');
      expect(result.data?.info?.size).toBeUndefined();
    });

    it('should return null for nonexistent paths', async () => {
      mockFs.stat.mockRejectedValue(new Error('File not found'));

      const result = await workspaceTools.executeTool({
        name: 'get_info',
        parameters: { path: '/test/nonexistent' }
      });

      expect(result.success).toBe(true);
      expect(result.data?.info).toBeNull();
    });
  });

  describe('Tool Support', () => {
    it('should support all defined tools', () => {
      expect(workspaceTools.supportsTool('list_directory')).toBe(true);
      expect(workspaceTools.supportsTool('create_file')).toBe(true);
      expect(workspaceTools.supportsTool('unknown_tool')).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should return error for unknown tools', async () => {
      const result = await workspaceTools.executeTool({
        name: 'unknown_tool',
        parameters: {}
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown tool: unknown_tool');
    });
  });

  describe('Direct Method Calls', () => {
    it('should list directory with sorted results', async () => {
      const mockDirents = [
        { name: 'file.txt', isDirectory: () => false, isFile: () => true },
        { name: 'directory', isDirectory: () => true, isFile: () => false }
      ];

      mockFs.readdir.mockResolvedValue(mockDirents as any);
      mockFs.stat.mockResolvedValue({ size: 1024, mtime: new Date() } as any);

      const result = await workspaceTools.listDirectory('/test');

      expect(result.entries[0].type).toBe('directory'); // Directories first
      expect(result.entries[1].type).toBe('file');
    });

    it('should return current path', async () => {
      const originalCwd = process.cwd;
      process.cwd = vi.fn().mockReturnValue('/current/dir');

      const path = await workspaceTools.getCurrentPath();

      expect(path).toBe('/current/dir');

      process.cwd = originalCwd;
    });
  });
});