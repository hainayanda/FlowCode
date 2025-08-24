import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ReplaceFirstFileTool } from '../../../../src/application/tools/file/tools/replace-first-file-tool';
import { ToolCallParameter } from '../../../../src/application/tools/interfaces/toolbox';
import {
    ErrorMessage,
    FileOperationMessage,
} from '../../../../src/application/stores/models/messages';
import { AsyncControlResponse } from '../../../../src/common/models/async-control';

// Mock fs module
vi.mock('fs/promises');

describe('ReplaceFirstFileTool', () => {
    let replaceFirstFileTool: ReplaceFirstFileTool;
    const mockFs = vi.mocked(fs);

    beforeEach(() => {
        replaceFirstFileTool = new ReplaceFirstFileTool();
        vi.clearAllMocks();

        // Mock process.cwd to return a known directory
        vi.spyOn(process, 'cwd').mockReturnValue('/workspace');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('definition', () => {
        it('should have correct tool definition', () => {
            const definition = replaceFirstFileTool.definition;

            expect(definition.name).toBe('replace_first');
            expect(definition.description).toBe(
                'Replace first occurrence matching regex in file with new content'
            );
            expect(definition.permission).toBe('loose');
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
                name: 'replace_first',
                parameters: {
                    filePath: '../outside/file.txt',
                    pattern: 'old',
                    content: 'new',
                },
            };

            const generator = replaceFirstFileTool.call(parameter);
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
                name: 'replace_first',
                parameters: {
                    filePath: 'nonexistent.txt',
                    pattern: 'old',
                    content: 'new',
                },
            };

            mockFs.access.mockRejectedValue(new Error('File not found'));

            const generator = replaceFirstFileTool.call(parameter);
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
                name: 'replace_first',
                parameters: {
                    filePath: 'test.txt',
                    pattern: '[invalid',
                    content: 'new',
                },
            };

            mockFs.access.mockResolvedValue(undefined);

            const generator = replaceFirstFileTool.call(parameter);
            const { value: message } = await generator.next();
            const { value: result } = await generator.next();

            const errorMessage = message as ErrorMessage;
            const response = result as AsyncControlResponse;

            expect(errorMessage.type).toBe('error');
            expect(errorMessage.content).toContain('Invalid regex pattern');
            expect(response.completedReason).toBe('completed');
        });

        it('should handle case when no match is found', async () => {
            const parameter: ToolCallParameter = {
                name: 'replace_first',
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

            const generator = replaceFirstFileTool.call(parameter);
            const { value: message } = await generator.next();
            const { value: result } = await generator.next();

            const errorMessage = message as ErrorMessage;
            const response = result as AsyncControlResponse;

            expect(errorMessage.type).toBe('error');
            expect(errorMessage.content).toBe(
                'No match found for pattern: notfound'
            );
            expect(response.completedReason).toBe('completed');
        });

        it('should successfully replace first occurrence only', async () => {
            const parameter: ToolCallParameter = {
                name: 'replace_first',
                parameters: {
                    filePath: 'test.txt',
                    pattern: 'old',
                    content: 'new',
                },
            };

            const originalContent =
                'This is old text with old content and old again';
            const expectedContent =
                'This is new text with old content and old again';

            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue(originalContent);
            mockFs.writeFile.mockResolvedValue(undefined);

            const generator = replaceFirstFileTool.call(parameter);
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
                'Successfully replaced first occurrence'
            );
            expect(fileOpMessage.content).toContain('Pattern: old');
            expect(fileOpMessage.content).toContain('Replacement: new');
            expect(response.completedReason).toBe('completed');
        });

        it('should handle regex patterns with capture groups', async () => {
            const parameter: ToolCallParameter = {
                name: 'replace_first',
                parameters: {
                    filePath: 'test.txt',
                    pattern: '(\\d{4})-(\\d{2})-(\\d{2})',
                    content: '$2/$3/$1',
                },
            };

            const originalContent =
                'Date: 2023-12-25 and another date 2024-01-01';
            const expectedContent =
                'Date: 12/25/2023 and another date 2024-01-01';

            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue(originalContent);
            mockFs.writeFile.mockResolvedValue(undefined);

            const generator = replaceFirstFileTool.call(parameter);
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
                'Successfully replaced first occurrence'
            );
        });

        it('should replace first occurrence even when multiple matches exist on same line', async () => {
            const parameter: ToolCallParameter = {
                name: 'replace_first',
                parameters: {
                    filePath: 'test.txt',
                    pattern: 'test',
                    content: 'REPLACED',
                },
            };

            const originalContent = 'This test line has test and test again';
            const expectedContent =
                'This REPLACED line has test and test again';

            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue(originalContent);
            mockFs.writeFile.mockResolvedValue(undefined);

            const generator = replaceFirstFileTool.call(parameter);
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

        it('should show correct line number in operation message', async () => {
            const parameter: ToolCallParameter = {
                name: 'replace_first',
                parameters: {
                    filePath: 'test.txt',
                    pattern: 'target',
                    content: 'replacement',
                },
            };

            const originalContent =
                'Line 1\nLine 2 with target\nLine 3\nLine 4 with target';

            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue(originalContent);
            mockFs.writeFile.mockResolvedValue(undefined);

            const generator = replaceFirstFileTool.call(parameter);
            const { value: message } = await generator.next();
            await generator.next();

            const fileOpMessage = message as FileOperationMessage;

            expect(fileOpMessage.content).toContain('at line 2');
        });

        it('should handle file write errors', async () => {
            const parameter: ToolCallParameter = {
                name: 'replace_first',
                parameters: {
                    filePath: 'test.txt',
                    pattern: 'old',
                    content: 'new',
                },
            };

            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue('This is old content');
            mockFs.writeFile.mockRejectedValue(new Error('Disk full'));

            const generator = replaceFirstFileTool.call(parameter);
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

        it('should include context in file operation message', async () => {
            const parameter: ToolCallParameter = {
                name: 'replace_first',
                parameters: {
                    filePath: 'test.txt',
                    pattern: 'middle',
                    content: 'CENTER',
                },
            };

            const originalContent =
                'Line 1\nLine 2\nLine middle content\nLine 4\nLine 5';

            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue(originalContent);
            mockFs.writeFile.mockResolvedValue(undefined);

            const generator = replaceFirstFileTool.call(parameter);
            const { value: message } = await generator.next();
            await generator.next();

            const fileOpMessage = message as FileOperationMessage;

            expect(fileOpMessage.content).toContain('before:');
            expect(fileOpMessage.content).toContain('after:');
            expect(fileOpMessage.content).toContain('Line 1');
            expect(fileOpMessage.content).toContain('Line 2');
            expect(fileOpMessage.content).toContain('Line 4');
            expect(fileOpMessage.content).toContain('CENTER');
            expect(fileOpMessage.metadata.filePath).toBe(
                path.resolve('test.txt')
            );
            expect(fileOpMessage.metadata.diffs).toBeDefined();
        });

        it('should calculate correct usage tokens', async () => {
            const parameter: ToolCallParameter = {
                name: 'replace_first',
                parameters: {
                    filePath: 'test.txt',
                    pattern: 'old',
                    content: 'new',
                },
            };

            const originalContent = 'This is old content';
            const expectedNewContent = 'This is new content';

            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue(originalContent);
            mockFs.writeFile.mockResolvedValue(undefined);

            const generator = replaceFirstFileTool.call(parameter);
            await generator.next();
            const { value: result } = await generator.next();

            const response = result as AsyncControlResponse;

            expect(response.usage.inputTokens).toBe(originalContent.length);
            expect(response.usage.outputTokens).toBe(
                expectedNewContent.length - originalContent.length
            );
            expect(response.usage.toolsUsed).toBe(1);
        });

        it('should handle multiline content and match across lines', async () => {
            const parameter: ToolCallParameter = {
                name: 'replace_first',
                parameters: {
                    filePath: 'test.txt',
                    pattern: 'Line.*content',
                    content: 'Replaced content',
                },
            };

            const originalContent = 'Line 1\nLine 2 with some content\nLine 3';

            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue(originalContent);
            mockFs.writeFile.mockResolvedValue(undefined);

            const generator = replaceFirstFileTool.call(parameter);
            const { value: message } = await generator.next();
            await generator.next();

            const fileOpMessage = message as FileOperationMessage;

            expect(fileOpMessage.type).toBe('file_operation');
            expect(fileOpMessage.content).toContain(
                'Successfully replaced first occurrence'
            );
        });
    });

    describe('getPermissionPrompt', () => {
        it('should generate appropriate permission prompt', () => {
            const parameter: ToolCallParameter = {
                name: 'replace_first',
                parameters: {
                    filePath: 'test.txt',
                    pattern: 'old_pattern',
                    content: 'new_content',
                },
            };

            const prompt = replaceFirstFileTool.getPermissionPrompt(parameter);

            expect(prompt).toBe(
                'Allow agent to replace first "old_pattern" with "new_content" in file "test.txt"?'
            );
        });

        it('should truncate long patterns and content in permission prompt', () => {
            const parameter: ToolCallParameter = {
                name: 'replace_first',
                parameters: {
                    filePath: 'test.txt',
                    pattern:
                        'very_long_pattern_that_should_be_truncated_because_it_is_too_long',
                    content:
                        'very_long_replacement_content_that_should_also_be_truncated',
                },
            };

            const prompt = replaceFirstFileTool.getPermissionPrompt(parameter);

            expect(prompt).toContain('very_long_pattern_that...');
            expect(prompt).toContain('very_long_replacement...');
            expect(prompt).toContain('test.txt');
        });

        it('should handle short patterns and content without truncation', () => {
            const parameter: ToolCallParameter = {
                name: 'replace_first',
                parameters: {
                    filePath: 'file.txt',
                    pattern: 'short',
                    content: 'brief',
                },
            };

            const prompt = replaceFirstFileTool.getPermissionPrompt(parameter);

            expect(prompt).toBe(
                'Allow agent to replace first "short" with "brief" in file "file.txt"?'
            );
            expect(prompt).not.toContain('...');
        });
    });
});
