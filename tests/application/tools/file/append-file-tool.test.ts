import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { AppendFileTool } from '../../../../src/application/tools/file/tools/append-file-tool';
import { ToolCallParameter } from '../../../../src/application/tools/interfaces/toolbox';
import {
    ErrorMessage,
    FileOperationMessage,
} from '../../../../src/application/stores/models/messages';
import { AsyncControlResponse } from '../../../../src/common/models/async-control';

// Mock fs module
vi.mock('fs/promises');

describe('AppendFileTool', () => {
    let appendFileTool: AppendFileTool;
    const mockFs = vi.mocked(fs);

    // Helper function to handle async generator properly
    async function callTool(parameter: ToolCallParameter): Promise<{
        message: ErrorMessage | FileOperationMessage;
        result: AsyncControlResponse;
    }> {
        const generator = appendFileTool.call(parameter);
        const { value: message, done: firstDone } = await generator.next();
        const { value: result, done: secondDone } = await generator.next();

        expect(firstDone).toBe(false);
        expect(secondDone).toBe(true);

        return {
            message: message as ErrorMessage | FileOperationMessage,
            result: result as AsyncControlResponse,
        };
    }

    beforeEach(() => {
        appendFileTool = new AppendFileTool();
        vi.clearAllMocks();

        // Mock process.cwd to return a known directory
        vi.spyOn(process, 'cwd').mockReturnValue('/workspace');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('definition', () => {
        it('should have correct tool definition', () => {
            const definition = appendFileTool.definition;

            expect(definition.name).toBe('append_file');
            expect(definition.description).toBe('Append text to end of file');
            expect(definition.permission).toBe('loose');
            expect(definition.parameters.required).toEqual([
                'filePath',
                'content',
            ]);
            expect(definition.parameters.properties.filePath.type).toBe(
                'string'
            );
            expect(definition.parameters.properties.content.type).toBe(
                'string'
            );
        });
    });

    describe('call', () => {
        it('should reject access outside workspace', async () => {
            const parameter: ToolCallParameter = {
                name: 'append_file',
                parameters: {
                    filePath: '../outside/file.txt',
                    content: 'test content',
                },
            };

            const { message, result } = await callTool(parameter);

            expect(message.type).toBe('error');
            expect(message.content).toContain('Access denied');
            expect(result.completedReason).toBe('completed');
            expect(result.usage.toolsUsed).toBe(1);
        });

        it('should create new file when file does not exist', async () => {
            const parameter: ToolCallParameter = {
                name: 'append_file',
                parameters: {
                    filePath: 'new-file.txt',
                    content: 'Hello World',
                },
            };

            // Mock file does not exist
            mockFs.access.mockRejectedValue(new Error('File not found'));
            mockFs.appendFile.mockResolvedValue(undefined);

            const { message, result } = await callTool(parameter);

            expect(mockFs.appendFile).toHaveBeenCalledWith(
                path.resolve('new-file.txt'),
                'Hello World',
                'utf-8'
            );
            expect(message.type).toBe('file_operation');
            expect(message.content).toContain('created and appended to');
            expect(result.completedReason).toBe('completed');
        });

        it('should append to existing file', async () => {
            const parameter: ToolCallParameter = {
                name: 'append_file',
                parameters: {
                    filePath: 'existing-file.txt',
                    content: '\nNew line',
                },
            };

            // Mock file exists
            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue('Line 1\nLine 2');
            mockFs.appendFile.mockResolvedValue(undefined);

            const { message, result } = await callTool(parameter);

            expect(mockFs.readFile).toHaveBeenCalledWith(
                path.resolve('existing-file.txt'),
                'utf-8'
            );
            expect(mockFs.appendFile).toHaveBeenCalledWith(
                path.resolve('existing-file.txt'),
                '\nNew line',
                'utf-8'
            );
            expect(message.type).toBe('file_operation');
            expect(message.content).toContain('appended to');
            expect(result.completedReason).toBe('completed');
        });

        it('should handle file read errors gracefully', async () => {
            const parameter: ToolCallParameter = {
                name: 'append_file',
                parameters: {
                    filePath: 'test-file.txt',
                    content: 'content',
                },
            };

            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockRejectedValue(new Error('Permission denied'));

            const { message, result } = await callTool(parameter);

            expect(message.type).toBe('error');
            expect(message.content).toContain('Failed to append to file');
            expect(result.completedReason).toBe('completed');
        });

        it('should handle append file errors', async () => {
            const parameter: ToolCallParameter = {
                name: 'append_file',
                parameters: {
                    filePath: 'test-file.txt',
                    content: 'content',
                },
            };

            mockFs.access.mockRejectedValue(new Error('File not found'));
            mockFs.appendFile.mockRejectedValue(new Error('Disk full'));

            const { message, result } = await callTool(parameter);

            expect(message.type).toBe('error');
            expect(message.content).toContain('Failed to append to file');
            expect(result.completedReason).toBe('completed');
        });

        it('should calculate correct line numbers for content with multiple lines', async () => {
            const parameter: ToolCallParameter = {
                name: 'append_file',
                parameters: {
                    filePath: 'test-file.txt',
                    content: 'Line A\nLine B\nLine C',
                },
            };

            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue(
                'Existing line 1\nExisting line 2'
            );
            mockFs.appendFile.mockResolvedValue(undefined);

            const { message, result } = await callTool(parameter);

            expect(message.type).toBe('file_operation');
            expect(message.content).toContain('lines 3-5');
            expect((message as FileOperationMessage).metadata.filePath).toBe(
                path.resolve('test-file.txt')
            );
            expect(result.usage.inputTokens).toBe(
                'Line A\nLine B\nLine C'.length
            );
        });

        it('should handle files ending with newline correctly', async () => {
            const parameter: ToolCallParameter = {
                name: 'append_file',
                parameters: {
                    filePath: 'test-file.txt',
                    content: 'New content',
                },
            };

            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue('Line 1\nLine 2\n');
            mockFs.appendFile.mockResolvedValue(undefined);

            const { message } = await callTool(parameter);

            expect(message.content).toContain('line 3');
        });
    });

    describe('getPermissionPrompt', () => {
        it('should generate appropriate permission prompt', () => {
            const parameter: ToolCallParameter = {
                name: 'append_file',
                parameters: {
                    filePath: 'test.txt',
                    content: 'Short content',
                },
            };

            const prompt = appendFileTool.getPermissionPrompt(parameter);

            expect(prompt).toBe(
                'Allow agent to append 1 line to file "test.txt"? (Content: "Short content")'
            );
        });

        it('should truncate long content in permission prompt', () => {
            const parameter: ToolCallParameter = {
                name: 'append_file',
                parameters: {
                    filePath: 'test.txt',
                    content:
                        'This is a very long content that should be truncated because it exceeds the limit',
                },
            };

            const prompt = appendFileTool.getPermissionPrompt(parameter);

            expect(prompt).toContain('...');
            expect(prompt).toContain(
                'This is a very long content that should be truncat...'
            );
        });

        it('should handle multiple lines in permission prompt', () => {
            const parameter: ToolCallParameter = {
                name: 'append_file',
                parameters: {
                    filePath: 'test.txt',
                    content: 'Line 1\nLine 2\nLine 3',
                },
            };

            const prompt = appendFileTool.getPermissionPrompt(parameter);

            expect(prompt).toContain('3 lines');
            expect(prompt).toContain('test.txt');
        });

        it('should handle single line content correctly', () => {
            const parameter: ToolCallParameter = {
                name: 'append_file',
                parameters: {
                    filePath: 'test.txt',
                    content: 'Single line',
                },
            };

            const prompt = appendFileTool.getPermissionPrompt(parameter);

            expect(prompt).toContain('1 line');
            expect(prompt).not.toContain('lines');
        });
    });
});
