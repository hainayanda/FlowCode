import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FileTools } from '../../../src/application/tools/file-tools.js';
import { EmbeddingService } from '../../../src/application/interfaces/embedding-service.js';
import * as fs from 'fs/promises';

// Mock fs module
vi.mock('fs/promises');
const mockFs = vi.mocked(fs);

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

describe('FileTools', () => {
  let fileTools: FileTools;
  let mockEmbeddingService: MockEmbeddingService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEmbeddingService = new MockEmbeddingService();
    fileTools = new FileTools(mockEmbeddingService);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Initialization', () => {
    it('should have correct id and description', () => {
      expect(fileTools.id).toBe('file_tools');
      expect(fileTools.description).toBe('File operations toolbox for reading, writing, and modifying files');
    });

    it('should return all tool definitions', () => {
      const tools = fileTools.getTools();
      
      expect(tools).toHaveLength(6);
      expect(tools.map(t => t.name)).toContain('read_file');
      expect(tools.map(t => t.name)).toContain('append_to_file');
      expect(tools.map(t => t.name)).toContain('insert_at_line');
      expect(tools.map(t => t.name)).toContain('replace_at_line');
      expect(tools.map(t => t.name)).toContain('replace_with_regex');
      expect(tools.map(t => t.name)).toContain('replace_all_with_regex');
    });

    it('should have correct permission levels', () => {
      const tools = fileTools.getTools();
      
      const readTool = tools.find(t => t.name === 'read_file');
      expect(readTool?.permission).toBe('none');
      
      const appendTool = tools.find(t => t.name === 'append_to_file');
      expect(appendTool?.permission).toBe('loose');
    });
  });

  describe('Tool Support', () => {
    it('should support all defined tools', () => {
      expect(fileTools.supportsTool('read_file')).toBe(true);
      expect(fileTools.supportsTool('append_to_file')).toBe(true);
      expect(fileTools.supportsTool('unknown_tool')).toBe(false);
    });
  });

  describe('Read File Tool', () => {
    it('should read file content with pagination', async () => {
      const fileContent = 'line1\nline2\nline3\nline4\nline5';
      mockFs.readFile.mockResolvedValue(fileContent);

      const result = await fileTools.executeTool({
        name: 'read_file',
        parameters: { filePath: '/test/file.txt', startLine: 2, lineCount: 2 }
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        content: 'line2\nline3',
        totalLines: 5,
        startLine: 2,
        endLine: 3
      });
    });

    it('should handle read file errors', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      const result = await fileTools.executeTool({
        name: 'read_file',
        parameters: { filePath: '/nonexistent/file.txt' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Tool execution failed');
    });
  });

  describe('Append to File Tool', () => {
    it('should append content to file', async () => {
      mockFs.appendFile.mockResolvedValue(undefined);

      const result = await fileTools.executeTool({
        name: 'append_to_file',
        parameters: { filePath: '/test/file.txt', content: 'new content' }
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Content appended successfully');
      expect(mockFs.appendFile).toHaveBeenCalledWith('/test/file.txt', 'new content');
    });

    it('should handle append errors', async () => {
      mockFs.appendFile.mockRejectedValue(new Error('Permission denied'));

      const result = await fileTools.executeTool({
        name: 'append_to_file',
        parameters: { filePath: '/test/file.txt', content: 'new content' }
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Failed to append content');
    });
  });

  describe('Insert at Line Tool', () => {
    it('should insert content at specific line', async () => {
      const originalContent = 'line1\nline2\nline3';
      mockFs.readFile.mockResolvedValue(originalContent);
      mockFs.writeFile.mockResolvedValue(undefined);

      const result = await fileTools.executeTool({
        name: 'insert_at_line',
        parameters: { filePath: '/test/file.txt', lineNumber: 2, content: 'inserted line' }
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Content inserted successfully');
      expect(mockFs.writeFile).toHaveBeenCalledWith('/test/file.txt', 'line1\ninserted line\nline2\nline3');
    });
  });

  describe('Replace at Line Tool', () => {
    it('should replace content at specific line', async () => {
      const originalContent = 'line1\nline2\nline3';
      mockFs.readFile.mockResolvedValue(originalContent);
      mockFs.writeFile.mockResolvedValue(undefined);

      const result = await fileTools.executeTool({
        name: 'replace_at_line',
        parameters: { filePath: '/test/file.txt', lineNumber: 2, content: 'replaced line' }
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Line replaced successfully');
      expect(mockFs.writeFile).toHaveBeenCalledWith('/test/file.txt', 'line1\nreplaced line\nline3');
    });

    it('should handle invalid line numbers', async () => {
      const originalContent = 'line1\nline2\nline3';
      mockFs.readFile.mockResolvedValue(originalContent);

      const result = await fileTools.executeTool({
        name: 'replace_at_line',
        parameters: { filePath: '/test/file.txt', lineNumber: 10, content: 'replaced line' }
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Failed to replace line');
    });
  });

  describe('Replace with Regex Tool', () => {
    it('should replace content using regex on specific line', async () => {
      const originalContent = 'line1\nHello World\nline3';
      mockFs.readFile.mockResolvedValue(originalContent);
      mockFs.writeFile.mockResolvedValue(undefined);

      const result = await fileTools.executeTool({
        name: 'replace_with_regex',
        parameters: { 
          filePath: '/test/file.txt', 
          lineNumber: 2, 
          pattern: 'Hello', 
          replacement: 'Hi' 
        }
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Regex replacement successful');
      expect(mockFs.writeFile).toHaveBeenCalledWith('/test/file.txt', 'line1\nHi World\nline3');
    });
  });

  describe('Replace All with Regex Tool', () => {
    it('should replace all occurrences using regex', async () => {
      const originalContent = 'Hello World\nHello Universe\nGoodbye World';
      mockFs.readFile.mockResolvedValue(originalContent);
      mockFs.writeFile.mockResolvedValue(undefined);

      const result = await fileTools.executeTool({
        name: 'replace_all_with_regex',
        parameters: { 
          filePath: '/test/file.txt', 
          pattern: 'Hello', 
          replacement: 'Hi',
          flags: 'g'
        }
      });

      expect(result.success).toBe(true);
      expect(result.data?.replaced).toBe(2);
      expect(result.message).toBe('Replaced 2 occurrences');
      expect(mockFs.writeFile).toHaveBeenCalledWith('/test/file.txt', 'Hi World\nHi Universe\nGoodbye World');
    });
  });

  describe('Error Handling', () => {
    it('should return error for unknown tools', async () => {
      const result = await fileTools.executeTool({
        name: 'unknown_tool',
        parameters: {}
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown tool: unknown_tool');
    });

    it('should handle file system errors gracefully', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File system error'));

      const result = await fileTools.executeTool({
        name: 'read_file',
        parameters: { filePath: '/test/file.txt' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Tool execution failed: File system error');
    });
  });

  describe('Direct Method Calls', () => {
    it('should read file with default parameters', async () => {
      const fileContent = 'line1\nline2\nline3';
      mockFs.readFile.mockResolvedValue(fileContent);

      const result = await fileTools.readFile('/test/file.txt');

      expect(result.content).toBe(fileContent);
      expect(result.totalLines).toBe(3);
      expect(result.startLine).toBe(1);
      expect(result.endLine).toBe(3);
    });

    it('should append to file successfully', async () => {
      mockFs.appendFile.mockResolvedValue(undefined);

      const result = await fileTools.appendToFile('/test/file.txt', 'new content');

      expect(result).toBe(true);
      expect(mockFs.appendFile).toHaveBeenCalledWith('/test/file.txt', 'new content');
    });

    it('should return false on append failure', async () => {
      mockFs.appendFile.mockRejectedValue(new Error('Permission denied'));

      const result = await fileTools.appendToFile('/test/file.txt', 'new content');

      expect(result).toBe(false);
    });
  });
});