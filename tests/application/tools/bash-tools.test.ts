import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BashTools } from '../../../src/application/tools/bash-tools.js';
import { EmbeddingService } from '../../../src/application/interfaces/embedding-service.js';

describe('BashTools (Simple Tests)', () => {
  let bashTools: BashTools;

  beforeEach(() => {
    const mockEmbeddingService: EmbeddingService = {
      generateEmbedding: async () => [0.1, 0.2, 0.3],
      isAvailable: async () => true,
      getEmbeddingDimension: () => 3
    };
    bashTools = new BashTools(mockEmbeddingService);
  });

  describe('Initialization', () => {
    it('should have correct id and description', () => {
      expect(bashTools.id).toBe('bash_tools');
      expect(bashTools.description).toBe('Bash command execution toolbox for running shell commands');
    });

    it('should return all tool definitions', () => {
      const tools = bashTools.getTools();
      
      expect(tools).toHaveLength(3);
      expect(tools.map(t => t.name)).toContain('execute_command');
      expect(tools.map(t => t.name)).toContain('execute_command_with_streaming');
      expect(tools.map(t => t.name)).toContain('is_command_available');
    });

    it('should have correct permission levels', () => {
      const tools = bashTools.getTools();
      
      const executeTool = tools.find(t => t.name === 'execute_command');
      expect(executeTool?.permission).toBe('strict');
      
      const streamingTool = tools.find(t => t.name === 'execute_command_with_streaming');
      expect(streamingTool?.permission).toBe('strict');
      
      const availableTool = tools.find(t => t.name === 'is_command_available');
      expect(availableTool?.permission).toBe('none');
    });
  });

  describe('Tool Support', () => {
    it('should support all defined tools', () => {
      expect(bashTools.supportsTool('execute_command')).toBe(true);
      expect(bashTools.supportsTool('execute_command_with_streaming')).toBe(true);
      expect(bashTools.supportsTool('is_command_available')).toBe(true);
      expect(bashTools.supportsTool('unknown_tool')).toBe(false);
    });
  });

  describe('Basic Tool Execution', () => {
    it('should return error for unknown tools', async () => {
      const result = await bashTools.executeTool({
        name: 'unknown_tool',
        parameters: {}
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown tool: unknown_tool');
    });

    it('should handle basic command execution structure', async () => {
      // Test with a simple command that should work on most systems
      const result = await bashTools.executeTool({
        name: 'execute_command',
        parameters: { command: 'echo test' }
      });

      // We just check the structure, not the specific result since it depends on system
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('data');
      
      if (result.success) {
        expect(result.data).toHaveProperty('stdout');
        expect(result.data).toHaveProperty('stderr');
        expect(result.data).toHaveProperty('exitCode');
        expect(result.data).toHaveProperty('success');
        expect(result.data).toHaveProperty('duration');
      }
    });

    it('should handle command availability check structure', async () => {
      // Test with a command that should exist on most systems
      const result = await bashTools.executeTool({
        name: 'is_command_available',
        parameters: { command: 'echo' }
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('available');
      expect(typeof result.data?.available).toBe('boolean');
    });
  });

  describe('Direct Method Structure', () => {
    it('should have executeCommand method', () => {
      expect(typeof bashTools.executeCommand).toBe('function');
    });

    it('should have executeCommandWithStreaming method', () => {
      expect(typeof bashTools.executeCommandWithStreaming).toBe('function');
    });

    it('should have isCommandAvailable method', () => {
      expect(typeof bashTools.isCommandAvailable).toBe('function');
    });

    it('should return proper structure from executeCommand', async () => {
      const result = await bashTools.executeCommand('echo test');
      
      expect(result).toHaveProperty('stdout');
      expect(result).toHaveProperty('stderr');
      expect(result).toHaveProperty('exitCode');
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('duration');
      expect(typeof result.duration).toBe('number');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should return boolean from isCommandAvailable', async () => {
      const result = await bashTools.isCommandAvailable('echo');
      expect(typeof result).toBe('boolean');
    });
  });
});