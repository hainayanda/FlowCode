import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import { SearchFileTool } from '../../../../src/application/tools/file/tools/search-file-tool';
import { ToolCallParameter } from '../../../../src/application/tools/interfaces/toolbox';
import {
    ErrorMessage,
    ToolsMessage,
} from '../../../../src/application/stores/models/messages';
import { AsyncControlResponse } from '../../../../src/common/models/async-control';

// Mock fs module
vi.mock('fs/promises');

describe('SearchFileTool', () => {
    let searchFileTool: SearchFileTool;
    const mockFs = vi.mocked(fs);

    beforeEach(() => {
        searchFileTool = new SearchFileTool();
        vi.clearAllMocks();

        // Mock process.cwd to return a known directory
        vi.spyOn(process, 'cwd').mockReturnValue('/workspace');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('definition', () => {
        it('should have correct tool definition', () => {
            const definition = searchFileTool.definition;

            expect(definition.name).toBe('search_file');
            expect(definition.description).toBe(
                'Search for regex pattern in file and return matching lines with line numbers'
            );
            expect(definition.permission).toBe('none');
            expect(definition.parameters.required).toEqual([
                'filePath',
                'pattern',
            ]);
            expect(definition.parameters.properties.filePath.type).toBe(
                'string'
            );
            expect(definition.parameters.properties.pattern.type).toBe(
                'string'
            );
            expect(definition.parameters.properties.caseSensitive.type).toBe(
                'boolean'
            );
            expect(definition.parameters.properties.caseSensitive.default).toBe(
                true
            );
        });
    });

    describe('call', () => {
        it('should reject access outside workspace', async () => {
            const parameter: ToolCallParameter = {
                name: 'search_file',
                parameters: {
                    filePath: '../outside/file.txt',
                    pattern: 'search',
                },
            };

            const generator = searchFileTool.call(parameter);
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
                name: 'search_file',
                parameters: {
                    filePath: 'nonexistent.txt',
                    pattern: 'search',
                },
            };

            mockFs.access.mockRejectedValue(new Error('File not found'));

            const generator = searchFileTool.call(parameter);
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
                name: 'search_file',
                parameters: {
                    filePath: 'test.txt',
                    pattern: '[invalid',
                },
            };

            mockFs.access.mockResolvedValue(undefined);

            const generator = searchFileTool.call(parameter);
            const { value: message } = await generator.next();
            const { value: result } = await generator.next();

            const errorMessage = message as ErrorMessage;
            const response = result as AsyncControlResponse;

            expect(errorMessage.type).toBe('error');
            expect(errorMessage.content).toContain('Invalid regex pattern');
            expect(response.completedReason).toBe('completed');
        });

        it('should return no matches when pattern is not found', async () => {
            const parameter: ToolCallParameter = {
                name: 'search_file',
                parameters: {
                    filePath: 'test.txt',
                    pattern: 'notfound',
                },
            };

            const fileContent = 'Line 1\nLine 2\nLine 3';
            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue(fileContent);

            const generator = searchFileTool.call(parameter);
            const { value: message } = await generator.next();
            const { value: result } = await generator.next();

            const toolMessage = message as ToolsMessage;
            const response = result as AsyncControlResponse;

            expect(toolMessage.type).toBe('tool');
            expect(toolMessage.content).toContain(
                'No matches found for pattern: notfound'
            );
            expect(response.completedReason).toBe('completed');
        });

        it('should find and return single match with line number', async () => {
            const parameter: ToolCallParameter = {
                name: 'search_file',
                parameters: {
                    filePath: 'test.txt',
                    pattern: 'target',
                },
            };

            const fileContent = 'Line 1\nLine with target content\nLine 3';
            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue(fileContent);

            const generator = searchFileTool.call(parameter);
            const { value: message } = await generator.next();
            const { value: result } = await generator.next();

            const toolMessage = message as ToolsMessage;
            const response = result as AsyncControlResponse;

            expect(toolMessage.type).toBe('tool');
            expect(toolMessage.content).toContain(
                'Found 1 match for pattern: target'
            );
            expect(toolMessage.content).toContain('2→Line with target content');
            expect(response.completedReason).toBe('completed');
        });

        it('should find and return multiple matches with line numbers', async () => {
            const parameter: ToolCallParameter = {
                name: 'search_file',
                parameters: {
                    filePath: 'test.txt',
                    pattern: 'test',
                },
            };

            const fileContent =
                'This is a test line\nAnother line\ntest again here\nFinal test';
            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue(fileContent);

            const generator = searchFileTool.call(parameter);
            const { value: message } = await generator.next();
            const { value: result } = await generator.next();

            const toolMessage = message as ToolsMessage;
            const response = result as AsyncControlResponse;

            expect(toolMessage.type).toBe('tool');
            expect(toolMessage.content).toContain(
                'Found 3 matches for pattern: test'
            );
            expect(toolMessage.content).toContain('1→This is a test line');
            expect(toolMessage.content).toContain('3→test again here');
            expect(toolMessage.content).toContain('4→Final test');
            expect(response.completedReason).toBe('completed');
        });

        it('should handle case sensitive search by default', async () => {
            const parameter: ToolCallParameter = {
                name: 'search_file',
                parameters: {
                    filePath: 'test.txt',
                    pattern: 'Test',
                },
            };

            const fileContent = 'Test line\ntest line\nTEST line';
            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue(fileContent);

            const generator = searchFileTool.call(parameter);
            const { value: message } = await generator.next();
            await generator.next();

            const toolMessage = message as ToolsMessage;

            expect(toolMessage.content).toContain(
                'Found 1 match for pattern: Test'
            );
            expect(toolMessage.content).toContain('1→Test line');
            expect(toolMessage.content).not.toContain('test line');
            expect(toolMessage.content).not.toContain('TEST line');
        });

        it('should handle case insensitive search when specified', async () => {
            const parameter: ToolCallParameter = {
                name: 'search_file',
                parameters: {
                    filePath: 'test.txt',
                    pattern: 'Test',
                    caseSensitive: false,
                },
            };

            const fileContent = 'Test line\ntest line\nTEST line';
            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue(fileContent);

            const generator = searchFileTool.call(parameter);
            const { value: message } = await generator.next();
            await generator.next();

            const toolMessage = message as ToolsMessage;

            expect(toolMessage.content).toContain(
                'Found 3 matches for pattern: Test'
            );
            expect(toolMessage.content).toContain('1→Test line');
            expect(toolMessage.content).toContain('2→test line');
            expect(toolMessage.content).toContain('3→TEST line');
        });

        it('should handle regex patterns with special characters', async () => {
            const parameter: ToolCallParameter = {
                name: 'search_file',
                parameters: {
                    filePath: 'test.txt',
                    pattern: '\\d{4}-\\d{2}-\\d{2}',
                },
            };

            const fileContent =
                'Date: 2023-12-25\nText line\nAnother date: 2024-01-01';
            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue(fileContent);

            const generator = searchFileTool.call(parameter);
            const { value: message } = await generator.next();
            await generator.next();

            const toolMessage = message as ToolsMessage;

            expect(toolMessage.content).toContain(
                'Found 2 matches for pattern'
            );
            expect(toolMessage.content).toContain('1→Date: 2023-12-25');
            expect(toolMessage.content).toContain('3→Another date: 2024-01-01');
        });

        it('should handle empty file', async () => {
            const parameter: ToolCallParameter = {
                name: 'search_file',
                parameters: {
                    filePath: 'empty.txt',
                    pattern: 'anything',
                },
            };

            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue('');

            const generator = searchFileTool.call(parameter);
            const { value: message } = await generator.next();
            await generator.next();

            const toolMessage = message as ToolsMessage;

            expect(toolMessage.content).toContain(
                'No matches found for pattern: anything'
            );
        });

        it('should handle file with only empty lines', async () => {
            const parameter: ToolCallParameter = {
                name: 'search_file',
                parameters: {
                    filePath: 'empty-lines.txt',
                    pattern: '^$',
                },
            };

            const fileContent = '\n\n\n';
            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue(fileContent);

            const generator = searchFileTool.call(parameter);
            const { value: message } = await generator.next();
            await generator.next();

            const toolMessage = message as ToolsMessage;

            expect(toolMessage.content).toContain(
                'Found 4 matches for pattern'
            );
        });

        it('should handle file read errors', async () => {
            const parameter: ToolCallParameter = {
                name: 'search_file',
                parameters: {
                    filePath: 'test.txt',
                    pattern: 'search',
                },
            };

            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockRejectedValue(new Error('Permission denied'));

            const generator = searchFileTool.call(parameter);
            const { value: message } = await generator.next();
            const { value: result } = await generator.next();

            const errorMessage = message as ErrorMessage;
            const response = result as AsyncControlResponse;

            expect(errorMessage.type).toBe('error');
            expect(errorMessage.content).toContain('Failed to search file');
            expect(response.completedReason).toBe('completed');
        });

        it('should include correct metadata in tools message', async () => {
            const parameter: ToolCallParameter = {
                name: 'search_file',
                parameters: {
                    filePath: 'test.txt',
                    pattern: 'target',
                },
            };

            const fileContent = 'Line with target content';
            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue(fileContent);

            const generator = searchFileTool.call(parameter);
            const { value: message } = await generator.next();
            const { value: result } = await generator.next();

            const toolMessage = message as ToolsMessage;
            const response = result as AsyncControlResponse;

            expect(toolMessage.metadata.toolName).toBe('search_file');
            expect(toolMessage.metadata.parameters).toEqual(
                parameter.parameters
            );
            const resultData = JSON.parse(toolMessage.metadata.result || '[]');
            expect(resultData).toHaveLength(1);
            expect(resultData[0].lineNumber).toBe(1);
            expect(resultData[0].content).toBe('Line with target content');
            expect(resultData[0].match).toBe('target');
            expect(response.usage.inputTokens).toBe(fileContent.length);
            expect(response.usage.outputTokens).toBeGreaterThan(0);
        });

        it('should handle word boundary patterns', async () => {
            const parameter: ToolCallParameter = {
                name: 'search_file',
                parameters: {
                    filePath: 'test.txt',
                    pattern: '\\btest\\b',
                },
            };

            const fileContent = 'test word\ntesting word\ncontest word\ntest';
            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue(fileContent);

            const generator = searchFileTool.call(parameter);
            const { value: message } = await generator.next();
            await generator.next();

            const toolMessage = message as ToolsMessage;

            expect(toolMessage.content).toContain(
                'Found 2 matches for pattern'
            );
            expect(toolMessage.content).toContain('1→test word');
            expect(toolMessage.content).toContain('4→test');
            expect(toolMessage.content).not.toContain('testing');
            expect(toolMessage.content).not.toContain('contest');
        });

        it('should handle anchor patterns (start/end of line)', async () => {
            const parameter: ToolCallParameter = {
                name: 'search_file',
                parameters: {
                    filePath: 'test.txt',
                    pattern: '^Line',
                },
            };

            const fileContent = 'Line starts\nNot Line starts\nLine again';
            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue(fileContent);

            const generator = searchFileTool.call(parameter);
            const { value: message } = await generator.next();
            await generator.next();

            const toolMessage = message as ToolsMessage;

            expect(toolMessage.content).toContain(
                'Found 2 matches for pattern'
            );
            expect(toolMessage.content).toContain('1→Line starts');
            expect(toolMessage.content).toContain('3→Line again');
            expect(toolMessage.content).not.toContain('Not Line starts');
        });
    });
});
