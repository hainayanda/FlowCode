import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ReplaceFileTool } from '../../../../src/application/tools/file/tools/replace-file-tool';
import { ToolCallParameter } from '../../../../src/application/tools/interfaces/toolbox';
import {
    ErrorMessage,
    FileOperationMessage,
} from '../../../../src/application/stores/models/messages';
import { AsyncControlResponse } from '../../../../src/common/models/async-control';

// Mock fs module
vi.mock('fs/promises');

describe('ReplaceFileTool', () => {
    let replaceFileTool: ReplaceFileTool;
    const mockFs = vi.mocked(fs);

    beforeEach(() => {
        replaceFileTool = new ReplaceFileTool();
        vi.clearAllMocks();

        // Mock process.cwd to return a known directory
        vi.spyOn(process, 'cwd').mockReturnValue('/workspace');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('definition', () => {
        it('should have correct tool definition', () => {
            const definition = replaceFileTool.definition;

            expect(definition.name).toBe('replace_at_line');
            expect(definition.description).toBe(
                'Replace text at specific line number'
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
                name: 'replace_at_line',
                parameters: {
                    filePath: 'test.txt',
                    lineNumber: 0,
                    content: 'new content',
                },
            };

            const generator = replaceFileTool.call(parameter);
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
                name: 'replace_at_line',
                parameters: {
                    filePath: '../outside/file.txt',
                    lineNumber: 1,
                    content: 'content',
                },
            };

            const generator = replaceFileTool.call(parameter);
            const { value: message } = await generator.next();
            const { value: result } = await generator.next();

            const errorMessage = message as ErrorMessage;
            const response = result as AsyncControlResponse;

            expect(errorMessage.type).toBe('error');
            expect(errorMessage.content).toContain('Access denied');
            expect(response.completedReason).toBe('completed');
        });

        it('should handle file not found error', async () => {
            const parameter: ToolCallParameter = {
                name: 'replace_at_line',
                parameters: {
                    filePath: 'nonexistent.txt',
                    lineNumber: 1,
                    content: 'content',
                },
            };

            mockFs.access.mockRejectedValue(new Error('File not found'));

            const generator = replaceFileTool.call(parameter);
            const { value: message } = await generator.next();
            const { value: result } = await generator.next();

            const errorMessage = message as ErrorMessage;
            const response = result as AsyncControlResponse;

            expect(errorMessage.type).toBe('error');
            expect(errorMessage.content).toBe(
                'File not found: nonexistent.txt'
            );
            expect(response.completedReason).toBe('completed');
        });

        it('should handle line number exceeding file length', async () => {
            const parameter: ToolCallParameter = {
                name: 'replace_at_line',
                parameters: {
                    filePath: 'test.txt',
                    lineNumber: 5,
                    content: 'new content',
                },
            };

            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue('Line 1\nLine 2\nLine 3');

            const generator = replaceFileTool.call(parameter);
            const { value: message } = await generator.next();
            const { value: result } = await generator.next();

            const errorMessage = message as ErrorMessage;
            const response = result as AsyncControlResponse;

            expect(errorMessage.type).toBe('error');
            expect(errorMessage.content).toBe(
                'Line number 5 exceeds file length (3 lines)'
            );
            expect(response.completedReason).toBe('completed');
        });

        it('should successfully replace first line', async () => {
            const parameter: ToolCallParameter = {
                name: 'replace_at_line',
                parameters: {
                    filePath: 'test.txt',
                    lineNumber: 1,
                    content: 'New first line',
                },
            };

            const originalContent = 'Old first line\nLine 2\nLine 3';
            const expectedContent = 'New first line\nLine 2\nLine 3';

            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue(originalContent);
            mockFs.writeFile.mockResolvedValue(undefined);

            const generator = replaceFileTool.call(parameter);
            const { value: message } = await generator.next();
            const { value: result } = await generator.next();

            const fileOpMessage = message as FileOperationMessage;
            const response = result as AsyncControlResponse;

            expect(mockFs.writeFile).toHaveBeenCalledWith(
                path.resolve('test.txt'),
                expectedContent,
                'utf-8'
            );
            expect(fileOpMessage.type).toBe('file_operation');
            expect(fileOpMessage.content).toContain(
                'Successfully replaced content at line 1'
            );
            expect(response.completedReason).toBe('completed');
        });

        it('should successfully replace middle line', async () => {
            const parameter: ToolCallParameter = {
                name: 'replace_at_line',
                parameters: {
                    filePath: 'test.txt',
                    lineNumber: 2,
                    content: 'Replaced middle line',
                },
            };

            const originalContent = 'Line 1\nLine 2\nLine 3\nLine 4';
            const expectedContent =
                'Line 1\nReplaced middle line\nLine 3\nLine 4';

            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue(originalContent);
            mockFs.writeFile.mockResolvedValue(undefined);

            const generator = replaceFileTool.call(parameter);
            const { value: message } = await generator.next();
            await generator.next();

            const fileOpMessage = message as FileOperationMessage;

            expect(mockFs.writeFile).toHaveBeenCalledWith(
                path.resolve('test.txt'),
                expectedContent,
                'utf-8'
            );
            expect(fileOpMessage.type).toBe('file_operation');
            expect(fileOpMessage.content).toContain(
                'Successfully replaced content at line 2'
            );
        });

        it('should successfully replace last line', async () => {
            const parameter: ToolCallParameter = {
                name: 'replace_at_line',
                parameters: {
                    filePath: 'test.txt',
                    lineNumber: 3,
                    content: 'New last line',
                },
            };

            const originalContent = 'Line 1\nLine 2\nLine 3';
            const expectedContent = 'Line 1\nLine 2\nNew last line';

            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue(originalContent);
            mockFs.writeFile.mockResolvedValue(undefined);

            const generator = replaceFileTool.call(parameter);
            const { value: message } = await generator.next();
            await generator.next();

            const fileOpMessage = message as FileOperationMessage;

            expect(mockFs.writeFile).toHaveBeenCalledWith(
                path.resolve('test.txt'),
                expectedContent,
                'utf-8'
            );
            expect(fileOpMessage.type).toBe('file_operation');
            expect(fileOpMessage.content).toContain(
                'Successfully replaced content at line 3'
            );
        });

        it('should handle single line file replacement', async () => {
            const parameter: ToolCallParameter = {
                name: 'replace_at_line',
                parameters: {
                    filePath: 'test.txt',
                    lineNumber: 1,
                    content: 'Replaced single line',
                },
            };

            const originalContent = 'Only line';
            const expectedContent = 'Replaced single line';

            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue(originalContent);
            mockFs.writeFile.mockResolvedValue(undefined);

            const generator = replaceFileTool.call(parameter);
            const { value: message } = await generator.next();
            await generator.next();

            const fileOpMessage = message as FileOperationMessage;

            expect(mockFs.writeFile).toHaveBeenCalledWith(
                path.resolve('test.txt'),
                expectedContent,
                'utf-8'
            );
            expect(fileOpMessage.type).toBe('file_operation');
        });

        it('should handle empty line replacement', async () => {
            const parameter: ToolCallParameter = {
                name: 'replace_at_line',
                parameters: {
                    filePath: 'test.txt',
                    lineNumber: 2,
                    content: 'Now has content',
                },
            };

            const originalContent = 'Line 1\n\nLine 3';
            const expectedContent = 'Line 1\nNow has content\nLine 3';

            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue(originalContent);
            mockFs.writeFile.mockResolvedValue(undefined);

            const generator = replaceFileTool.call(parameter);
            await generator.next();
            const { value: result } = await generator.next();

            const response = result as AsyncControlResponse;

            expect(mockFs.writeFile).toHaveBeenCalledWith(
                path.resolve('test.txt'),
                expectedContent,
                'utf-8'
            );
            expect(response.usage.inputTokens).toBe(0); // Empty line length
            expect(response.usage.outputTokens).toBe('Now has content'.length);
        });

        it('should handle file write errors', async () => {
            const parameter: ToolCallParameter = {
                name: 'replace_at_line',
                parameters: {
                    filePath: 'test.txt',
                    lineNumber: 1,
                    content: 'new content',
                },
            };

            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue('old content');
            mockFs.writeFile.mockRejectedValue(new Error('Disk full'));

            const generator = replaceFileTool.call(parameter);
            const { value: message } = await generator.next();
            const { value: result } = await generator.next();

            const errorMessage = message as ErrorMessage;
            const response = result as AsyncControlResponse;

            expect(errorMessage.type).toBe('error');
            expect(errorMessage.content).toContain(
                'Failed to replace line in file'
            );
            expect(response.completedReason).toBe('completed');
        });

        it('should include context in file operation message', async () => {
            const parameter: ToolCallParameter = {
                name: 'replace_at_line',
                parameters: {
                    filePath: 'test.txt',
                    lineNumber: 3,
                    content: 'Replaced line 3',
                },
            };

            const originalContent = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';

            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue(originalContent);
            mockFs.writeFile.mockResolvedValue(undefined);

            const generator = replaceFileTool.call(parameter);
            const { value: message } = await generator.next();
            await generator.next();

            const fileOpMessage = message as FileOperationMessage;

            expect(fileOpMessage.content).toContain('before:');
            expect(fileOpMessage.content).toContain('after:');
            expect(fileOpMessage.content).toContain('Line 1');
            expect(fileOpMessage.content).toContain('Line 2');
            expect(fileOpMessage.content).toContain('Line 4');
            expect(fileOpMessage.content).toContain('Replaced line 3');
            expect(fileOpMessage.metadata.filePath).toBe(
                path.resolve('test.txt')
            );
            expect(fileOpMessage.metadata.diffs).toBeDefined();
        });

        it('should calculate correct usage tokens', async () => {
            const parameter: ToolCallParameter = {
                name: 'replace_at_line',
                parameters: {
                    filePath: 'test.txt',
                    lineNumber: 1,
                    content: 'New content',
                },
            };

            const originalContent = 'Old content line';

            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue(originalContent);
            mockFs.writeFile.mockResolvedValue(undefined);

            const generator = replaceFileTool.call(parameter);
            await generator.next();
            const { value: result } = await generator.next();

            const response = result as AsyncControlResponse;

            expect(response.usage.inputTokens).toBe('Old content line'.length);
            expect(response.usage.outputTokens).toBe('New content'.length);
            expect(response.usage.toolsUsed).toBe(1);
        });
    });

    describe('getPermissionPrompt', () => {
        it('should generate appropriate permission prompt', () => {
            const parameter: ToolCallParameter = {
                name: 'replace_at_line',
                parameters: {
                    filePath: 'test.txt',
                    lineNumber: 5,
                    content: 'New content for line',
                },
            };

            const prompt = replaceFileTool.getPermissionPrompt(parameter);

            expect(prompt).toBe(
                'Allow agent to replace line 5 in file "test.txt" with: "New content for line"?'
            );
        });

        it('should truncate long content in permission prompt', () => {
            const parameter: ToolCallParameter = {
                name: 'replace_at_line',
                parameters: {
                    filePath: 'test.txt',
                    lineNumber: 2,
                    content:
                        'This is a very long content that should be truncated because it exceeds the limit',
                },
            };

            const prompt = replaceFileTool.getPermissionPrompt(parameter);

            expect(prompt).toContain('...');
            expect(prompt).toContain(
                'This is a very long content that should...'
            );
            expect(prompt).toContain('line 2');
            expect(prompt).toContain('test.txt');
        });

        it('should handle different line numbers correctly', () => {
            const parameter: ToolCallParameter = {
                name: 'replace_at_line',
                parameters: {
                    filePath: 'another.txt',
                    lineNumber: 1,
                    content: 'Short',
                },
            };

            const prompt = replaceFileTool.getPermissionPrompt(parameter);

            expect(prompt).toBe(
                'Allow agent to replace line 1 in file "another.txt" with: "Short"?'
            );
        });
    });
});
