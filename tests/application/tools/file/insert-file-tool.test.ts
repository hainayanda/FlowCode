import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { InsertFileTool } from '../../../../src/application/tools/file/tools/insert-file-tool';
import { ToolCallParameter } from '../../../../src/application/tools/interfaces/toolbox';
import {
    ErrorMessage,
    FileOperationMessage,
} from '../../../../src/application/stores/models/messages';
import { AsyncControlResponse } from '../../../../src/common/models/async-control';

// Mock fs module
vi.mock('fs/promises');

describe('InsertFileTool', () => {
    let insertFileTool: InsertFileTool;
    const mockFs = vi.mocked(fs);

    beforeEach(() => {
        insertFileTool = new InsertFileTool();
        vi.clearAllMocks();

        // Mock process.cwd to return a known directory
        vi.spyOn(process, 'cwd').mockReturnValue('/workspace');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('definition', () => {
        it('should have correct tool definition', () => {
            const definition = insertFileTool.definition;

            expect(definition.name).toBe('insert_at_line');
            expect(definition.description).toBe(
                'Insert text at specific line number'
            );
            expect(definition.permission).toBe('loose');
            expect(definition.parameters.required).toEqual([
                'filePath',
                'lineNumber',
                'content',
            ]);
            expect(definition.parameters.properties.filePath.type).toBe(
                'string'
            );
            expect(definition.parameters.properties.lineNumber.type).toBe(
                'number'
            );
            expect(definition.parameters.properties.content.type).toBe(
                'string'
            );
        });
    });

    describe('call', () => {
        it('should reject invalid line numbers', async () => {
            const parameter: ToolCallParameter = {
                name: 'insert_at_line',
                parameters: {
                    filePath: 'test.txt',
                    lineNumber: 0,
                    content: 'new content',
                },
            };

            const generator = insertFileTool.call(parameter);
            const { value: message } = await generator.next();
            const { value: result } = await generator.next();

            const errorMessage = message as ErrorMessage;
            const response = result as AsyncControlResponse;

            expect(errorMessage.type).toBe('error');
            expect(errorMessage.content).toBe(
                'Line number must be 1 or greater'
            );
            expect(response.completedReason).toBe('completed');
            expect(response.usage.toolsUsed).toBe(1);
        });

        it('should reject access outside workspace', async () => {
            const parameter: ToolCallParameter = {
                name: 'insert_at_line',
                parameters: {
                    filePath: '../outside/file.txt',
                    lineNumber: 1,
                    content: 'content',
                },
            };

            const generator = insertFileTool.call(parameter);
            const { value: message } = await generator.next();
            const { value: result } = await generator.next();

            const errorMessage = message as ErrorMessage;
            const response = result as AsyncControlResponse;

            expect(errorMessage.type).toBe('error');
            expect(errorMessage.content).toContain('Access denied');
            expect(response.completedReason).toBe('completed');
        });

        it('should create new file when inserting at line 1', async () => {
            const parameter: ToolCallParameter = {
                name: 'insert_at_line',
                parameters: {
                    filePath: 'new-file.txt',
                    lineNumber: 1,
                    content: 'First line',
                },
            };

            mockFs.readFile.mockRejectedValue(new Error('File not found'));
            mockFs.writeFile.mockResolvedValue(undefined);

            const generator = insertFileTool.call(parameter);
            const { value: message } = await generator.next();
            const { value: result } = await generator.next();

            const fileOpMessage = message as FileOperationMessage;
            const response = result as AsyncControlResponse;

            expect(mockFs.writeFile).toHaveBeenCalledWith(
                path.resolve('new-file.txt'),
                'First line',
                'utf-8'
            );
            expect(fileOpMessage.type).toBe('file_operation');
            expect(fileOpMessage.content).toContain('created');
            expect(response.completedReason).toBe('completed');
        });

        it('should insert at beginning of existing file', async () => {
            const parameter: ToolCallParameter = {
                name: 'insert_at_line',
                parameters: {
                    filePath: 'test.txt',
                    lineNumber: 1,
                    content: 'New first line',
                },
            };

            mockFs.readFile.mockResolvedValue(
                'Original line 1\nOriginal line 2'
            );
            mockFs.writeFile.mockResolvedValue(undefined);

            const generator = insertFileTool.call(parameter);
            const { value: message } = await generator.next();
            await generator.next();

            const fileOpMessage = message as FileOperationMessage;

            expect(mockFs.writeFile).toHaveBeenCalledWith(
                path.resolve('test.txt'),
                'New first line\nOriginal line 1\nOriginal line 2',
                'utf-8'
            );
            expect(fileOpMessage.type).toBe('file_operation');
            expect(fileOpMessage.content).toContain('edited');
        });

        it('should insert in middle of existing file', async () => {
            const parameter: ToolCallParameter = {
                name: 'insert_at_line',
                parameters: {
                    filePath: 'test.txt',
                    lineNumber: 2,
                    content: 'Inserted line',
                },
            };

            mockFs.readFile.mockResolvedValue('Line 1\nLine 2\nLine 3');
            mockFs.writeFile.mockResolvedValue(undefined);

            const generator = insertFileTool.call(parameter);
            const { value: message } = await generator.next();
            await generator.next();

            const fileOpMessage = message as FileOperationMessage;

            expect(mockFs.writeFile).toHaveBeenCalledWith(
                path.resolve('test.txt'),
                'Line 1\nInserted line\nLine 2\nLine 3',
                'utf-8'
            );
            expect(fileOpMessage.type).toBe('file_operation');
        });

        it('should insert at end of file', async () => {
            const parameter: ToolCallParameter = {
                name: 'insert_at_line',
                parameters: {
                    filePath: 'test.txt',
                    lineNumber: 4,
                    content: 'Last line',
                },
            };

            mockFs.readFile.mockResolvedValue('Line 1\nLine 2\nLine 3');
            mockFs.writeFile.mockResolvedValue(undefined);

            const generator = insertFileTool.call(parameter);
            const { value: message } = await generator.next();
            await generator.next();

            const fileOpMessage = message as FileOperationMessage;

            expect(mockFs.writeFile).toHaveBeenCalledWith(
                path.resolve('test.txt'),
                'Line 1\nLine 2\nLine 3\nLast line',
                'utf-8'
            );
            expect(fileOpMessage.type).toBe('file_operation');
        });

        it('should handle inserting beyond file length with padding', async () => {
            const parameter: ToolCallParameter = {
                name: 'insert_at_line',
                parameters: {
                    filePath: 'test.txt',
                    lineNumber: 5,
                    content: 'Far line',
                },
            };

            mockFs.readFile.mockResolvedValue('Line 1\nLine 2');
            mockFs.writeFile.mockResolvedValue(undefined);

            const generator = insertFileTool.call(parameter);
            const { value: message } = await generator.next();
            await generator.next();

            const fileOpMessage = message as FileOperationMessage;

            expect(mockFs.writeFile).toHaveBeenCalledWith(
                path.resolve('test.txt'),
                'Line 1\nLine 2\n\n\nFar line',
                'utf-8'
            );
            expect(fileOpMessage.type).toBe('file_operation');
        });

        it('should reject line number far beyond file end', async () => {
            const parameter: ToolCallParameter = {
                name: 'insert_at_line',
                parameters: {
                    filePath: 'test.txt',
                    lineNumber: 10,
                    content: 'content',
                },
            };

            mockFs.readFile.mockResolvedValue('Line 1\nLine 2');

            const generator = insertFileTool.call(parameter);
            const { value: message } = await generator.next();
            const { value: result } = await generator.next();

            const errorMessage = message as ErrorMessage;
            const response = result as AsyncControlResponse;

            expect(errorMessage.type).toBe('error');
            expect(errorMessage.content).toContain(
                'Line number 10 is beyond file end + 1'
            );
            expect(response.completedReason).toBe('completed');
        });

        it('should handle multiline content insertion', async () => {
            const parameter: ToolCallParameter = {
                name: 'insert_at_line',
                parameters: {
                    filePath: 'test.txt',
                    lineNumber: 2,
                    content: 'Line A\nLine B\nLine C',
                },
            };

            mockFs.readFile.mockResolvedValue('Existing 1\nExisting 2');
            mockFs.writeFile.mockResolvedValue(undefined);

            const generator = insertFileTool.call(parameter);
            const { value: message } = await generator.next();
            const { value: result } = await generator.next();

            const fileOpMessage = message as FileOperationMessage;
            const response = result as AsyncControlResponse;

            expect(mockFs.writeFile).toHaveBeenCalledWith(
                path.resolve('test.txt'),
                'Existing 1\nLine A\nLine B\nLine C\nExisting 2',
                'utf-8'
            );
            expect(fileOpMessage.content).toContain('lines 2-4');
            expect(response.usage.inputTokens).toBe(
                'Line A\nLine B\nLine C'.length
            );
        });

        it('should handle file system errors', async () => {
            const parameter: ToolCallParameter = {
                name: 'insert_at_line',
                parameters: {
                    filePath: 'test.txt',
                    lineNumber: 1,
                    content: 'content',
                },
            };

            mockFs.readFile.mockResolvedValue('existing content');
            mockFs.writeFile.mockRejectedValue(new Error('Disk full'));

            const generator = insertFileTool.call(parameter);
            const { value: message } = await generator.next();
            const { value: result } = await generator.next();

            const errorMessage = message as ErrorMessage;
            const response = result as AsyncControlResponse;

            expect(errorMessage.type).toBe('error');
            expect(errorMessage.content).toContain(
                'Failed to insert content in file'
            );
            expect(response.completedReason).toBe('completed');
        });

        it('should include context in file operation message', async () => {
            const parameter: ToolCallParameter = {
                name: 'insert_at_line',
                parameters: {
                    filePath: 'test.txt',
                    lineNumber: 3,
                    content: 'Inserted content',
                },
            };

            mockFs.readFile.mockResolvedValue('Line 1\nLine 2\nLine 3\nLine 4');
            mockFs.writeFile.mockResolvedValue(undefined);

            const generator = insertFileTool.call(parameter);
            const { value: message } = await generator.next();
            await generator.next();

            const fileOpMessage = message as FileOperationMessage;

            expect(fileOpMessage.content).toContain('before:');
            expect(fileOpMessage.content).toContain('after:');
            expect(fileOpMessage.metadata.filePath).toBe(
                path.resolve('test.txt')
            );
            expect(fileOpMessage.metadata.diffs).toBeDefined();
        });
    });

    describe('getPermissionPrompt', () => {
        it('should generate appropriate permission prompt for single line', () => {
            const parameter: ToolCallParameter = {
                name: 'insert_at_line',
                parameters: {
                    filePath: 'test.txt',
                    lineNumber: 5,
                    content: 'Single line content',
                },
            };

            const prompt = insertFileTool.getPermissionPrompt(parameter);

            expect(prompt).toBe(
                'Allow agent to insert 1 line at line 5 in file "test.txt"? (Content: "Single line content")'
            );
        });

        it('should handle multiple lines in permission prompt', () => {
            const parameter: ToolCallParameter = {
                name: 'insert_at_line',
                parameters: {
                    filePath: 'test.txt',
                    lineNumber: 2,
                    content: 'Line 1\nLine 2\nLine 3',
                },
            };

            const prompt = insertFileTool.getPermissionPrompt(parameter);

            expect(prompt).toContain('3 lines');
            expect(prompt).toContain('at line 2');
        });

        it('should truncate long content in permission prompt', () => {
            const parameter: ToolCallParameter = {
                name: 'insert_at_line',
                parameters: {
                    filePath: 'test.txt',
                    lineNumber: 1,
                    content:
                        'This is a very long content that should be truncated',
                },
            };

            const prompt = insertFileTool.getPermissionPrompt(parameter);

            expect(prompt).toContain('...');
            expect(prompt).toContain(
                'This is a very long content that should...'
            );
        });
    });
});
