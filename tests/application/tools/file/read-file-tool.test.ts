import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ReadFileTool } from '../../../../src/application/tools/file/tools/read-file-tool';
import { ToolCallParameter } from '../../../../src/application/tools/interfaces/toolbox';
import {
    ErrorMessage,
    ToolsMessage,
} from '../../../../src/application/stores/models/messages';
import { AsyncControlResponse } from '../../../../src/common/models/async-control';

// Mock fs module
vi.mock('fs/promises');

describe('ReadFileTool', () => {
    let readFileTool: ReadFileTool;
    const mockFs = vi.mocked(fs);

    beforeEach(() => {
        readFileTool = new ReadFileTool();
        vi.clearAllMocks();

        // Mock process.cwd to return a known directory
        vi.spyOn(process, 'cwd').mockReturnValue('/workspace');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('definition', () => {
        it('should have correct tool definition', () => {
            const definition = readFileTool.definition;

            expect(definition.name).toBe('read_file');
            expect(definition.description).toBe(
                'Read file content with pagination (100 lines per page)'
            );
            expect(definition.permission).toBe('none');
            expect(definition.parameters.required).toEqual(['filePath']);
            expect(definition.parameters.properties.filePath.type).toBe(
                'string'
            );
            expect(definition.parameters.properties.startLine.type).toBe(
                'number'
            );
            expect(definition.parameters.properties.lineCount.type).toBe(
                'number'
            );
            expect(definition.parameters.properties.startLine.default).toBe(1);
            expect(definition.parameters.properties.lineCount.default).toBe(
                100
            );
        });
    });

    describe('call', () => {
        it('should reject invalid start line numbers', async () => {
            const parameter: ToolCallParameter = {
                name: 'read_file',
                parameters: {
                    filePath: 'test.txt',
                    startLine: 0,
                },
            };

            const generator = readFileTool.call(parameter);
            const { value: message } = await generator.next();
            const { value: result } = await generator.next();

            const errorMessage = message as ErrorMessage;
            const response = result as AsyncControlResponse;

            expect(errorMessage.type).toBe('error');
            expect(errorMessage.content).toBe(
                'Start line must be 1 or greater'
            );
            expect(response.completedReason).toBe('completed');
            expect(response.usage.toolsUsed).toBe(1);
        });

        it('should reject invalid line counts', async () => {
            const parameter: ToolCallParameter = {
                name: 'read_file',
                parameters: {
                    filePath: 'test.txt',
                    lineCount: 150,
                },
            };

            const generator = readFileTool.call(parameter);
            const { value: message } = await generator.next();
            const { value: result } = await generator.next();

            const errorMessage = message as ErrorMessage;
            const response = result as AsyncControlResponse;

            expect(errorMessage.type).toBe('error');
            expect(errorMessage.content).toBe(
                'Line count must be between 1 and 100'
            );
            expect(response.completedReason).toBe('completed');
        });

        it('should reject line count of 0', async () => {
            const parameter: ToolCallParameter = {
                name: 'read_file',
                parameters: {
                    filePath: 'test.txt',
                    lineCount: 0,
                },
            };

            const generator = readFileTool.call(parameter);
            const { value: message } = await generator.next();
            await generator.next();

            const errorMessage = message as ErrorMessage;

            expect(errorMessage.type).toBe('error');
            expect(errorMessage.content).toBe(
                'Line count must be between 1 and 100'
            );
        });

        it('should reject access outside workspace', async () => {
            const parameter: ToolCallParameter = {
                name: 'read_file',
                parameters: {
                    filePath: '../outside/file.txt',
                },
            };

            const generator = readFileTool.call(parameter);
            const { value: message } = await generator.next();
            const { value: result } = await generator.next();

            const errorMessage = message as ErrorMessage;
            const response = result as AsyncControlResponse;

            expect(errorMessage.type).toBe('error');
            expect(errorMessage.content).toContain('Access denied');
            expect(response.completedReason).toBe('completed');
        });

        it('should read entire small file with default parameters', async () => {
            const parameter: ToolCallParameter = {
                name: 'read_file',
                parameters: {
                    filePath: 'test.txt',
                },
            };

            const fileContent = 'Line 1\nLine 2\nLine 3';
            mockFs.readFile.mockResolvedValue(fileContent);

            const generator = readFileTool.call(parameter);
            const { value: message } = await generator.next();
            const { value: result } = await generator.next();

            const toolMessage = message as ToolsMessage;
            const response = result as AsyncControlResponse;

            expect(mockFs.readFile).toHaveBeenCalledWith(
                path.resolve('test.txt'),
                'utf-8'
            );
            expect(toolMessage.type).toBe('tool');
            expect(toolMessage.content).toContain('File: test.txt');
            expect(toolMessage.content).toContain('Showing lines 1-3 of 3');
            expect(toolMessage.content).toContain('1→Line 1');
            expect(toolMessage.content).toContain('2→Line 2');
            expect(toolMessage.content).toContain('3→Line 3');
            expect(response.completedReason).toBe('completed');
        });

        it('should handle pagination with startLine and lineCount', async () => {
            const parameter: ToolCallParameter = {
                name: 'read_file',
                parameters: {
                    filePath: 'test.txt',
                    startLine: 2,
                    lineCount: 2,
                },
            };

            const fileContent = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';
            mockFs.readFile.mockResolvedValue(fileContent);

            const generator = readFileTool.call(parameter);
            const { value: message } = await generator.next();
            await generator.next();

            const toolMessage = message as ToolsMessage;

            expect(toolMessage.type).toBe('tool');
            expect(toolMessage.content).toContain('Showing lines 2-3 of 5');
            expect(toolMessage.content).toContain('2→Line 2');
            expect(toolMessage.content).toContain('3→Line 3');
            expect(toolMessage.content).not.toContain('1→Line 1');
            expect(toolMessage.content).not.toContain('4→Line 4');
        });

        it('should handle reading beyond file end', async () => {
            const parameter: ToolCallParameter = {
                name: 'read_file',
                parameters: {
                    filePath: 'test.txt',
                    startLine: 3,
                    lineCount: 10,
                },
            };

            const fileContent = 'Line 1\nLine 2\nLine 3\nLine 4';
            mockFs.readFile.mockResolvedValue(fileContent);

            const generator = readFileTool.call(parameter);
            const { value: message } = await generator.next();
            await generator.next();

            const toolMessage = message as ToolsMessage;

            expect(toolMessage.content).toContain('Showing lines 3-4 of 4');
            expect(toolMessage.content).toContain('3→Line 3');
            expect(toolMessage.content).toContain('4→Line 4');
        });

        it('should handle starting beyond file end', async () => {
            const parameter: ToolCallParameter = {
                name: 'read_file',
                parameters: {
                    filePath: 'test.txt',
                    startLine: 10,
                    lineCount: 5,
                },
            };

            const fileContent = 'Line 1\nLine 2\nLine 3';
            mockFs.readFile.mockResolvedValue(fileContent);

            const generator = readFileTool.call(parameter);
            const { value: message } = await generator.next();
            await generator.next();

            const toolMessage = message as ToolsMessage;

            expect(toolMessage.content).toContain('Showing lines 10-3 of 3');
            expect(toolMessage.content).not.toContain('→');
        });

        it('should handle empty file', async () => {
            const parameter: ToolCallParameter = {
                name: 'read_file',
                parameters: {
                    filePath: 'empty.txt',
                },
            };

            mockFs.readFile.mockResolvedValue('');

            const generator = readFileTool.call(parameter);
            const { value: message } = await generator.next();
            await generator.next();

            const toolMessage = message as ToolsMessage;

            expect(toolMessage.content).toContain('Showing lines 1-0 of 1');
        });

        it('should handle file with single empty line', async () => {
            const parameter: ToolCallParameter = {
                name: 'read_file',
                parameters: {
                    filePath: 'single-line.txt',
                },
            };

            mockFs.readFile.mockResolvedValue('Single line');

            const generator = readFileTool.call(parameter);
            const { value: message } = await generator.next();
            await generator.next();

            const toolMessage = message as ToolsMessage;

            expect(toolMessage.content).toContain('Showing lines 1-1 of 1');
            expect(toolMessage.content).toContain('1→Single line');
        });

        it('should handle file read errors', async () => {
            const parameter: ToolCallParameter = {
                name: 'read_file',
                parameters: {
                    filePath: 'nonexistent.txt',
                },
            };

            mockFs.readFile.mockRejectedValue(new Error('File not found'));

            const generator = readFileTool.call(parameter);
            const { value: message } = await generator.next();
            const { value: result } = await generator.next();

            const errorMessage = message as ErrorMessage;
            const response = result as AsyncControlResponse;

            expect(errorMessage.type).toBe('error');
            expect(errorMessage.content).toContain('Failed to read file');
            expect(response.completedReason).toBe('completed');
        });

        it('should include correct metadata in tools message', async () => {
            const parameter: ToolCallParameter = {
                name: 'read_file',
                parameters: {
                    filePath: 'test.txt',
                    startLine: 1,
                    lineCount: 2,
                },
            };

            mockFs.readFile.mockResolvedValue('Line 1\nLine 2\nLine 3');

            const generator = readFileTool.call(parameter);
            const { value: message } = await generator.next();
            const { value: result } = await generator.next();

            const toolMessage = message as ToolsMessage;
            const response = result as AsyncControlResponse;

            expect(toolMessage.metadata.toolName).toBe('read_file');
            expect(toolMessage.metadata.parameters).toEqual(
                parameter.parameters
            );
            expect(toolMessage.metadata.result).toContain('1→Line 1');
            expect(toolMessage.metadata.result).toContain('2→Line 2');
            expect(response.usage.outputTokens).toBeGreaterThan(0);
        });

        it('should use default values when parameters are not provided', async () => {
            const parameter: ToolCallParameter = {
                name: 'read_file',
                parameters: {
                    filePath: 'test.txt',
                },
            };

            // Create a file with more than 100 lines to test default pagination
            const lines = Array.from(
                { length: 150 },
                (_, i) => `Line ${i + 1}`
            );
            const fileContent = lines.join('\n');
            mockFs.readFile.mockResolvedValue(fileContent);

            const generator = readFileTool.call(parameter);
            const { value: message } = await generator.next();
            await generator.next();

            const toolMessage = message as ToolsMessage;

            expect(toolMessage.content).toContain('Showing lines 1-100 of 150');
            expect(toolMessage.content).toContain('1→Line 1');
            expect(toolMessage.content).toContain('100→Line 100');
            expect(toolMessage.content).not.toContain('101→Line 101');
        });
    });
});
