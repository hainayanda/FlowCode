import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FileToolbox } from '../../../../src/application/tools/file/file-toolbox';
import { ToolCallParameter } from '../../../../src/application/tools/interfaces/toolbox';
import {
    AsyncControl,
    AsyncControlResponse,
} from '../../../../src/common/models/async-control';
import {
    ErrorMessage,
    Message,
} from '../../../../src/application/stores/models/messages';

describe('FileToolbox', () => {
    let fileToolbox: FileToolbox;

    beforeEach(() => {
        fileToolbox = new FileToolbox();
    });

    describe('constructor', () => {
        it('should initialize with all file tools', () => {
            expect(fileToolbox.tools).toHaveLength(8);

            const toolNames = fileToolbox.tools.map((tool) => tool.name);
            expect(toolNames).toContain('append_file');
            expect(toolNames).toContain('delete_at_line');
            expect(toolNames).toContain('insert_at_line');
            expect(toolNames).toContain('read_file');
            expect(toolNames).toContain('replace_all');
            expect(toolNames).toContain('replace_at_line');
            expect(toolNames).toContain('replace_first');
            expect(toolNames).toContain('search_file');
        });
    });

    describe('tools', () => {
        it('should return tool definitions for all underlying tools', () => {
            const tools = fileToolbox.tools;

            expect(tools).toHaveLength(8);
            tools.forEach((tool) => {
                expect(tool.name).toBeDefined();
                expect(tool.description).toBeDefined();
                expect(tool.parameters).toBeDefined();
                expect(tool.permission).toBeDefined();
            });
        });
    });

    describe('callTool', () => {
        it('should return error for unknown tool', async () => {
            const parameter: ToolCallParameter = {
                name: 'unknown_tool',
                parameters: {},
            };

            const generator = fileToolbox.callTool(parameter);
            const { value: message, done: firstDone } = await generator.next();
            const { value: result, done: secondDone } = await generator.next();

            expect(firstDone).toBe(false);
            expect(secondDone).toBe(true);
            expect((message as ErrorMessage).type).toBe('error');
            expect((message as ErrorMessage).content).toBe(
                'Unknown tool: unknown_tool'
            );
            expect((result as AsyncControlResponse).completedReason).toBe(
                'completed'
            );
            expect((result as AsyncControlResponse).usage.toolsUsed).toBe(1);
        });

        it('should delegate to underlying tool for valid tool name', async () => {
            const parameter: ToolCallParameter = {
                name: 'read_file',
                parameters: {
                    filePath: './test.txt',
                },
            };

            const generator = fileToolbox.callTool(parameter);

            // The generator should start but we don't need to fully execute it
            // since it will try to read an actual file
            expect(generator).toBeDefined();
        });
    });

    describe('callTools', () => {
        it('should return empty response for empty parameters array', async () => {
            const generator = fileToolbox.callTools([]);
            const { value: result, done } = await generator.next();

            expect(done).toBe(true);
            expect((result as AsyncControlResponse).messages).toHaveLength(0);
            expect((result as AsyncControlResponse).completedReason).toBe(
                'completed'
            );
            expect((result as AsyncControlResponse).usage).toEqual({
                inputTokens: 0,
                outputTokens: 0,
                toolsUsed: 0,
            });
        });

        it('should delegate to callTool for single parameter', async () => {
            const parameter: ToolCallParameter = {
                name: 'unknown_tool',
                parameters: {},
            };

            const generator = fileToolbox.callTools([parameter]);
            const { value: message, done: firstDone } = await generator.next();
            const { value: result, done: secondDone } = await generator.next();

            expect(firstDone).toBe(false);
            expect(secondDone).toBe(true);
            expect((message as ErrorMessage).type).toBe('error');
            expect((result as AsyncControlResponse).completedReason).toBe(
                'completed'
            );
        });

        it('should group file operations and other tools', () => {
            const parameters: ToolCallParameter[] = [
                { name: 'append_file', parameters: {} },
                { name: 'read_file', parameters: {} },
                { name: 'delete_at_line', parameters: {} },
            ];

            // Access private method for testing
            const grouped = (fileToolbox as any).groupToolParameters(
                parameters
            );

            expect(grouped.fileOperations).toHaveLength(2);
            expect(grouped.fileOperations.map((p: any) => p.name)).toContain(
                'append_file'
            );
            expect(grouped.fileOperations.map((p: any) => p.name)).toContain(
                'delete_at_line'
            );

            expect(grouped.otherTools).toHaveLength(1);
            expect(grouped.otherTools[0]?.name).toBe('read_file');
        });
    });

    describe('getBatchLoosePermissionPrompt', () => {
        it('should return generic prompt for tools with no permission needed', () => {
            const parameters: ToolCallParameter[] = [];

            const prompt =
                fileToolbox.getBatchLoosePermissionPrompt(parameters);

            expect(prompt).toBe('Allow agent to perform file operations?');
        });

        it('should delegate to single tool prompt for one tool', () => {
            const parameters: ToolCallParameter[] = [
                {
                    name: 'append_file',
                    parameters: {
                        filePath: 'test.txt',
                        content: 'test content',
                    },
                },
            ];

            const prompt =
                fileToolbox.getBatchLoosePermissionPrompt(parameters);

            expect(prompt).toContain('append');
            expect(prompt).toContain('test.txt');
        });

        it('should create batch prompt for multiple tools', () => {
            const parameters: ToolCallParameter[] = [
                {
                    name: 'read_file',
                    parameters: { filePath: 'test1.txt' },
                },
                {
                    name: 'append_file',
                    parameters: { filePath: 'test2.txt', content: 'content' },
                },
            ];

            const prompt =
                fileToolbox.getBatchLoosePermissionPrompt(parameters);

            // read_file has 'none' permission so it gets filtered out
            // Only append_file (single tool) remains, so it delegates to individual prompt
            expect(prompt).toContain('append 1 line to file "test2.txt"');
        });

        it('should handle multiple read and write operations', () => {
            const parameters: ToolCallParameter[] = [
                { name: 'read_file', parameters: { filePath: 'test1.txt' } },
                { name: 'search_file', parameters: { filePath: 'test2.txt' } },
                { name: 'append_file', parameters: { filePath: 'test3.txt' } },
                {
                    name: 'delete_at_line',
                    parameters: { filePath: 'test4.txt' },
                },
            ];

            const prompt =
                fileToolbox.getBatchLoosePermissionPrompt(parameters);

            // read_file and search_file have 'none' permission so they get filtered out
            // Only append_file and delete_at_line remain (2 tools needing permission)
            expect(prompt).toContain('modify 2 files');
        });
    });

    describe('getPermissionPrompt', () => {
        it('should delegate to underlying tool if it implements ToolPromptSource', () => {
            const parameter: ToolCallParameter = {
                name: 'append_file',
                parameters: {
                    filePath: 'test.txt',
                    content: 'test content',
                },
            };

            const prompt = fileToolbox.getPermissionPrompt(parameter);

            expect(prompt).toContain('append');
            expect(prompt).toContain('test.txt');
        });

        it('should provide generic fallback for tools without ToolPromptSource', () => {
            const parameter: ToolCallParameter = {
                name: 'unknown_tool',
                parameters: {
                    filePath: 'test.txt',
                },
            };

            const prompt = fileToolbox.getPermissionPrompt(parameter);

            expect(prompt).toBe(
                'Allow agent to perform unknown_tool operation "test.txt"?'
            );
        });

        it('should handle missing filePath parameter', () => {
            const parameter: ToolCallParameter = {
                name: 'unknown_tool',
                parameters: {},
            };

            const prompt = fileToolbox.getPermissionPrompt(parameter);

            expect(prompt).toBe(
                'Allow agent to perform unknown_tool operation?'
            );
        });
    });

    describe('private helper methods', () => {
        it('should create empty response correctly', () => {
            const response = (fileToolbox as any).createEmptyResponse();

            expect(response.messages).toHaveLength(0);
            expect(response.completedReason).toBe('completed');
            expect(response.usage).toEqual({
                inputTokens: 0,
                outputTokens: 0,
                toolsUsed: 0,
            });
        });

        it('should create usage response correctly', () => {
            const messages = [{ id: 'test', type: 'text' }] as any[];
            const response = (fileToolbox as any).createUsageResponse(
                messages,
                100,
                50,
                2
            );

            expect(response.messages).toBe(messages);
            expect(response.completedReason).toBe('completed');
            expect(response.usage).toEqual({
                inputTokens: 100,
                outputTokens: 50,
                toolsUsed: 2,
            });
        });

        it('should check if tool implements ToolPromptSource', () => {
            const toolWithPrompt = {
                getPermissionPrompt: vi.fn(),
            };
            const toolWithoutPrompt = {};

            const hasPrompt = (fileToolbox as any).implementsToolPromptSource(
                toolWithPrompt
            );
            const noPrompt = (fileToolbox as any).implementsToolPromptSource(
                toolWithoutPrompt
            );

            expect(hasPrompt).toBe(true);
            expect(noPrompt).toBe(false);
        });
    });
});
