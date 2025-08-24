import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ReplaceAllFileTool } from '../../../../src/application/tools/file/tools/replace-all-file-tool';
import { ToolCallParameter } from '../../../../src/application/tools/interfaces/toolbox';
import {
    ErrorMessage,
    FileOperationMessage,
} from '../../../../src/application/stores/models/messages';
import { AsyncControlResponse } from '../../../../src/common/models/async-control';

// Mock fs module
vi.mock('fs/promises');

describe('ReplaceAllFileTool', () => {
    let replaceAllFileTool: ReplaceAllFileTool;
    const mockFs = vi.mocked(fs);

    beforeEach(() => {
        replaceAllFileTool = new ReplaceAllFileTool();
        vi.clearAllMocks();

        // Mock process.cwd to return a known directory
        vi.spyOn(process, 'cwd').mockReturnValue('/workspace');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('definition', () => {
        it('should have correct tool definition', () => {
            const definition = replaceAllFileTool.definition;

            expect(definition.name).toBe('replace_all');
            expect(definition.description).toBe(
                'Replace all occurrences matching regex in file with new content'
            );
            expect(definition.permission).toBe('strict');
            expect(definition.parameters.required).toEqual([
                'filePath',
                'pattern',
                'content',
            ]);
            expect(definition.parameters.properties.filePath.type).toBe(
                'string'
            );
            expect(definition.parameters.properties.pattern.type).toBe(
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
                name: 'replace_all',
                parameters: {
                    filePath: '../outside/file.txt',
                    pattern: 'old',
                    content: 'new',
                },
            };

            const generator = replaceAllFileTool.call(parameter);
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
                name: 'replace_all',
                parameters: {
                    filePath: 'nonexistent.txt',
                    pattern: 'old',
                    content: 'new',
                },
            };

            mockFs.access.mockRejectedValue(new Error('File not found'));

            const generator = replaceAllFileTool.call(parameter);
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

        it('should handle invalid regex patterns', async () => {
            const parameter: ToolCallParameter = {
                name: 'replace_all',
                parameters: {
                    filePath: 'test.txt',
                    pattern: '[invalid',
                    content: 'new',
                },
            };

            mockFs.access.mockResolvedValue(undefined);

            const generator = replaceAllFileTool.call(parameter);
            const { value: message } = await generator.next();
            const { value: result } = await generator.next();

            const errorMessage = message as ErrorMessage;
            const response = result as AsyncControlResponse;

            expect(errorMessage.type).toBe('error');
            expect(errorMessage.content).toContain('Invalid regex pattern');
            expect(response.completedReason).toBe('completed');
        });

        it('should handle case when no matches are found', async () => {
            const parameter: ToolCallParameter = {
                name: 'replace_all',
                parameters: {
                    filePath: 'test.txt',
                    pattern: 'notfound',
                    content: 'new',
                },
            };

            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue(
                'This is some content without the pattern'
            );

            const generator = replaceAllFileTool.call(parameter);
            const { value: message } = await generator.next();
            const { value: result } = await generator.next();

            const errorMessage = message as ErrorMessage;
            const response = result as AsyncControlResponse;

            expect(errorMessage.type).toBe('error');
            expect(errorMessage.content).toBe(
                'No matches found for pattern: notfound'
            );
            expect(response.completedReason).toBe('completed');
        });

        it('should successfully replace single occurrence', async () => {
            const parameter: ToolCallParameter = {
                name: 'replace_all',
                parameters: {
                    filePath: 'test.txt',
                    pattern: 'old',
                    content: 'new',
                },
            };

            const originalContent = 'This is old text with old content';
            const expectedContent = 'This is new text with new content';

            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue(originalContent);
            mockFs.writeFile.mockResolvedValue(undefined);

            const generator = replaceAllFileTool.call(parameter);
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
                'Successfully replaced 2 occurrences'
            );
            expect(fileOpMessage.content).toContain('Pattern: old');
            expect(fileOpMessage.content).toContain('Replacement: new');
            expect(response.completedReason).toBe('completed');
        });

        it('should handle complex regex patterns with capture groups', async () => {
            const parameter: ToolCallParameter = {
                name: 'replace_all',
                parameters: {
                    filePath: 'test.txt',
                    pattern: '(\\d{4})-(\\d{2})-(\\d{2})',
                    content: '$2/$3/$1',
                },
            };

            const originalContent =
                'Date: 2023-12-25 and another date 2024-01-01';
            const expectedContent =
                'Date: 12/25/2023 and another date 01/01/2024';

            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue(originalContent);
            mockFs.writeFile.mockResolvedValue(undefined);

            const generator = replaceAllFileTool.call(parameter);
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
                'Successfully replaced 2 occurrences'
            );
        });

        it('should handle multiline regex patterns', async () => {
            const parameter: ToolCallParameter = {
                name: 'replace_all',
                parameters: {
                    filePath: 'test.txt',
                    pattern: 'start.*?end',
                    content: 'REPLACED',
                },
            };

            const originalContent = 'Line start content end more text';

            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue(originalContent);
            mockFs.writeFile.mockResolvedValue(undefined);

            const generator = replaceAllFileTool.call(parameter);
            const { value: message } = await generator.next();
            await generator.next();

            const fileOpMessage = message as FileOperationMessage;

            expect(fileOpMessage.type).toBe('file_operation');
            expect(fileOpMessage.content).toContain(
                'Successfully replaced 1 occurrence'
            );
        });

        it('should handle file write errors', async () => {
            const parameter: ToolCallParameter = {
                name: 'replace_all',
                parameters: {
                    filePath: 'test.txt',
                    pattern: 'old',
                    content: 'new',
                },
            };

            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue('This is old content');
            mockFs.writeFile.mockRejectedValue(new Error('Disk full'));

            const generator = replaceAllFileTool.call(parameter);
            const { value: message } = await generator.next();
            const { value: result } = await generator.next();

            const errorMessage = message as ErrorMessage;
            const response = result as AsyncControlResponse;

            expect(errorMessage.type).toBe('error');
            expect(errorMessage.content).toContain(
                'Failed to replace content in file'
            );
            expect(response.completedReason).toBe('completed');
        });

        it('should include correct metadata in file operation message', async () => {
            const parameter: ToolCallParameter = {
                name: 'replace_all',
                parameters: {
                    filePath: 'test.txt',
                    pattern: 'foo',
                    content: 'bar',
                },
            };

            const originalContent = 'This foo is foo content';

            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue(originalContent);
            mockFs.writeFile.mockResolvedValue(undefined);

            const generator = replaceAllFileTool.call(parameter);
            const { value: message } = await generator.next();
            const { value: result } = await generator.next();

            const fileOpMessage = message as FileOperationMessage;
            const response = result as AsyncControlResponse;

            expect(fileOpMessage.metadata.filePath).toBe(
                path.resolve('test.txt')
            );
            expect(fileOpMessage.metadata.diffs).toBeDefined();
            expect(response.usage.inputTokens).toBe(originalContent.length);
            expect(response.usage.outputTokens).toBeGreaterThan(0);
        });

        it('should handle case-sensitive pattern matching', async () => {
            const parameter: ToolCallParameter = {
                name: 'replace_all',
                parameters: {
                    filePath: 'test.txt',
                    pattern: 'Test',
                    content: 'TEST',
                },
            };

            const originalContent = 'Test case and test case and Test again';
            const expectedContent = 'TEST case and test case and TEST again';

            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue(originalContent);
            mockFs.writeFile.mockResolvedValue(undefined);

            const generator = replaceAllFileTool.call(parameter);
            const { value: message } = await generator.next();
            await generator.next();

            const fileOpMessage = message as FileOperationMessage;

            expect(mockFs.writeFile).toHaveBeenCalledWith(
                path.resolve('test.txt'),
                expectedContent,
                'utf-8'
            );
            expect(fileOpMessage.content).toContain(
                'Successfully replaced 2 occurrences'
            );
        });

        it('should show before and after content in message', async () => {
            const parameter: ToolCallParameter = {
                name: 'replace_all',
                parameters: {
                    filePath: 'test.txt',
                    pattern: 'old',
                    content: 'new',
                },
            };

            const originalContent = 'This is old content';

            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue(originalContent);
            mockFs.writeFile.mockResolvedValue(undefined);

            const generator = replaceAllFileTool.call(parameter);
            const { value: message } = await generator.next();
            await generator.next();

            const fileOpMessage = message as FileOperationMessage;

            expect(fileOpMessage.content).toContain('before:');
            expect(fileOpMessage.content).toContain('after:');
            expect(fileOpMessage.content).toContain(originalContent);
            expect(fileOpMessage.content).toContain('This is new content');
        });
    });

    describe('getPermissionPrompt', () => {
        it('should generate appropriate permission prompt', () => {
            const parameter: ToolCallParameter = {
                name: 'replace_all',
                parameters: {
                    filePath: 'test.txt',
                    pattern: 'old_pattern',
                    content: 'new_content',
                },
            };

            const prompt = replaceAllFileTool.getPermissionPrompt(parameter);

            expect(prompt).toBe(
                'Allow agent to replace all "old_pattern" with "new_content" in file "test.txt"?'
            );
        });

        it('should truncate long patterns and content in permission prompt', () => {
            const parameter: ToolCallParameter = {
                name: 'replace_all',
                parameters: {
                    filePath: 'test.txt',
                    pattern:
                        'very_long_pattern_that_should_be_truncated_because_it_is_too_long',
                    content:
                        'very_long_replacement_content_that_should_also_be_truncated',
                },
            };

            const prompt = replaceAllFileTool.getPermissionPrompt(parameter);

            expect(prompt).toContain('very_long_pattern_that...');
            expect(prompt).toContain('very_long_replacement...');
            expect(prompt).toContain('test.txt');
        });

        it('should handle short patterns and content without truncation', () => {
            const parameter: ToolCallParameter = {
                name: 'replace_all',
                parameters: {
                    filePath: 'file.txt',
                    pattern: 'short',
                    content: 'brief',
                },
            };

            const prompt = replaceAllFileTool.getPermissionPrompt(parameter);

            expect(prompt).toBe(
                'Allow agent to replace all "short" with "brief" in file "file.txt"?'
            );
            expect(prompt).not.toContain('...');
        });
    });
});
