import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { DeleteFileTool } from '../../../../src/application/tools/file/tools/delete-file-tool';
import { ToolCallParameter } from '../../../../src/application/tools/interfaces/toolbox';
import {
    ErrorMessage,
    FileOperationMessage,
} from '../../../../src/application/stores/models/messages';
import { AsyncControlResponse } from '../../../../src/common/models/async-control';

// Mock fs module
vi.mock('fs/promises');

describe('DeleteFileTool', () => {
    let deleteFileTool: DeleteFileTool;
    const mockFs = vi.mocked(fs);

    // Helper function to handle async generator properly
    async function callTool(parameter: ToolCallParameter): Promise<{
        message: ErrorMessage | FileOperationMessage;
        result: AsyncControlResponse;
    }> {
        const generator = deleteFileTool.call(parameter);
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
        deleteFileTool = new DeleteFileTool();
        vi.clearAllMocks();

        // Mock process.cwd to return a known directory
        vi.spyOn(process, 'cwd').mockReturnValue('/workspace');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('definition', () => {
        it('should have correct tool definition', () => {
            const definition = deleteFileTool.definition;

            expect(definition.name).toBe('delete_at_line');
            expect(definition.description).toBe(
                'Delete text at specific line number'
            );
            expect(definition.permission).toBe('loose');
            expect(definition.parameters.required).toEqual([
                'filePath',
                'lineNumber',
            ]);
            expect(definition.parameters.properties.filePath.type).toBe(
                'string'
            );
            expect(definition.parameters.properties.lineNumber.type).toBe(
                'number'
            );
        });
    });

    describe('call', () => {
        it('should reject invalid line numbers', async () => {
            const parameter: ToolCallParameter = {
                name: 'delete_at_line',
                parameters: {
                    filePath: 'test.txt',
                    lineNumber: 0,
                },
            };

            const { message, result } = await callTool(parameter);

            expect(message.type).toBe('error');
            expect(message.content).toBe('Line number must be 1 or greater');
            expect(result.completedReason).toBe('completed');
            expect(result.usage.toolsUsed).toBe(1);
        });

        it('should reject access outside workspace', async () => {
            const parameter: ToolCallParameter = {
                name: 'delete_at_line',
                parameters: {
                    filePath: '../outside/file.txt',
                    lineNumber: 1,
                },
            };

            const { message, result } = await callTool(parameter);

            expect(message.type).toBe('error');
            expect(message.content).toContain('Access denied');
            expect(result.completedReason).toBe('completed');
        });

        it('should handle file not found error', async () => {
            const parameter: ToolCallParameter = {
                name: 'delete_at_line',
                parameters: {
                    filePath: 'nonexistent.txt',
                    lineNumber: 1,
                },
            };

            mockFs.access.mockRejectedValue(new Error('File not found'));

            const { message, result } = await callTool(parameter);

            expect(message.type).toBe('error');
            expect(message.content).toBe('File not found: nonexistent.txt');
            expect(result.completedReason).toBe('completed');
        });

        it('should handle line number exceeding file length', async () => {
            const parameter: ToolCallParameter = {
                name: 'delete_at_line',
                parameters: {
                    filePath: 'test.txt',
                    lineNumber: 5,
                },
            };

            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue('Line 1\nLine 2\nLine 3');

            const { message, result } = await callTool(parameter);

            expect(message.type).toBe('error');
            expect(message.content).toBe(
                'Line number 5 exceeds file length (3 lines)'
            );
            expect(result.completedReason).toBe('completed');
        });

        it('should successfully delete a line from middle of file', async () => {
            const parameter: ToolCallParameter = {
                name: 'delete_at_line',
                parameters: {
                    filePath: 'test.txt',
                    lineNumber: 2,
                },
            };

            const originalContent = 'Line 1\nLine 2\nLine 3\nLine 4';
            const expectedContent = 'Line 1\nLine 3\nLine 4';

            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue(originalContent);
            mockFs.writeFile.mockResolvedValue(undefined);

            const { message, result } = await callTool(parameter);

            expect(mockFs.writeFile).toHaveBeenCalledWith(
                path.resolve('test.txt'),
                expectedContent,
                'utf-8'
            );
            expect(message.type).toBe('file_operation');
            expect(message.content).toContain('Successfully deleted line 2');
            expect(result.completedReason).toBe('completed');
        });

        it('should successfully delete first line', async () => {
            const parameter: ToolCallParameter = {
                name: 'delete_at_line',
                parameters: {
                    filePath: 'test.txt',
                    lineNumber: 1,
                },
            };

            const originalContent = 'Line 1\nLine 2\nLine 3';
            const expectedContent = 'Line 2\nLine 3';

            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue(originalContent);
            mockFs.writeFile.mockResolvedValue(undefined);

            const { message, result } = await callTool(parameter);

            expect(mockFs.writeFile).toHaveBeenCalledWith(
                path.resolve('test.txt'),
                expectedContent,
                'utf-8'
            );
            expect(message.type).toBe('file_operation');
            expect(message.content).toContain('Successfully deleted line 1');
        });

        it('should successfully delete last line', async () => {
            const parameter: ToolCallParameter = {
                name: 'delete_at_line',
                parameters: {
                    filePath: 'test.txt',
                    lineNumber: 3,
                },
            };

            const originalContent = 'Line 1\nLine 2\nLine 3';
            const expectedContent = 'Line 1\nLine 2';

            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue(originalContent);
            mockFs.writeFile.mockResolvedValue(undefined);

            const { message, result } = await callTool(parameter);

            expect(mockFs.writeFile).toHaveBeenCalledWith(
                path.resolve('test.txt'),
                expectedContent,
                'utf-8'
            );
            expect(message.type).toBe('file_operation');
            expect(message.content).toContain('Successfully deleted line 3');
        });

        it('should handle single line file deletion', async () => {
            const parameter: ToolCallParameter = {
                name: 'delete_at_line',
                parameters: {
                    filePath: 'test.txt',
                    lineNumber: 1,
                },
            };

            const originalContent = 'Only line';
            const expectedContent = '';

            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue(originalContent);
            mockFs.writeFile.mockResolvedValue(undefined);

            const { message, result } = await callTool(parameter);

            expect(mockFs.writeFile).toHaveBeenCalledWith(
                path.resolve('test.txt'),
                expectedContent,
                'utf-8'
            );
            expect(message.type).toBe('file_operation');
        });

        it('should handle file system errors during write', async () => {
            const parameter: ToolCallParameter = {
                name: 'delete_at_line',
                parameters: {
                    filePath: 'test.txt',
                    lineNumber: 1,
                },
            };

            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue('Line 1\nLine 2');
            mockFs.writeFile.mockRejectedValue(new Error('Disk full'));

            const { message, result } = await callTool(parameter);

            expect(message.type).toBe('error');
            expect(message.content).toContain(
                'Failed to delete line from file'
            );
            expect(result.completedReason).toBe('completed');
        });

        it('should include context in file operation message', async () => {
            const parameter: ToolCallParameter = {
                name: 'delete_at_line',
                parameters: {
                    filePath: 'test.txt',
                    lineNumber: 3,
                },
            };

            const originalContent = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';

            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue(originalContent);
            mockFs.writeFile.mockResolvedValue(undefined);

            const { message } = await callTool(parameter);

            expect(message.content).toContain('before:');
            expect(message.content).toContain('after:');
            expect(message.content).toContain('Line 1');
            expect(message.content).toContain('Line 2');
            expect(message.content).toContain('Line 4');
            expect((message as FileOperationMessage).metadata.filePath).toBe(
                path.resolve('test.txt')
            );
            expect(
                (message as FileOperationMessage).metadata.diffs
            ).toBeDefined();
        });
    });

    describe('getPermissionPrompt', () => {
        it('should generate appropriate permission prompt', () => {
            const parameter: ToolCallParameter = {
                name: 'delete_at_line',
                parameters: {
                    filePath: 'test.txt',
                    lineNumber: 5,
                },
            };

            const prompt = deleteFileTool.getPermissionPrompt(parameter);

            expect(prompt).toBe(
                'Allow agent to delete line 5 from file "test.txt"?'
            );
        });

        it('should handle different line numbers correctly', () => {
            const parameter: ToolCallParameter = {
                name: 'delete_at_line',
                parameters: {
                    filePath: 'another.txt',
                    lineNumber: 1,
                },
            };

            const prompt = deleteFileTool.getPermissionPrompt(parameter);

            expect(prompt).toBe(
                'Allow agent to delete line 1 from file "another.txt"?'
            );
        });
    });
});
