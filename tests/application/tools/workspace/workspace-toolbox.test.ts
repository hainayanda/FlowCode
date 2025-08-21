import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceToolbox } from '../../../../src/application/tools/workspace/workspace-toolbox';
import {
    MockSettingsStore,
    MockWorkspaceToolboxDelegate,
} from './workspace-toolbox.mocks';
import { ToolCallParameter } from '../../../../src/application/interfaces/toolbox';
import { AsyncControl } from '../../../../src/application/models/async-control';

describe('WorkspaceToolbox', () => {
    let mockSettingsStore: MockSettingsStore;
    let mockDelegate: MockWorkspaceToolboxDelegate;
    let toolbox: WorkspaceToolbox;

    beforeEach(() => {
        mockSettingsStore = new MockSettingsStore();
        mockDelegate = new MockWorkspaceToolboxDelegate();
        toolbox = new WorkspaceToolbox(mockSettingsStore, mockDelegate);
    });

    describe('constructor', () => {
        it('should create instance with provided dependencies', () => {
            expect(toolbox).toBeInstanceOf(WorkspaceToolbox);
            expect(toolbox.tools).toBeDefined();
        });
    });

    describe('tools', () => {
        it('should return all available workspace tools', () => {
            const tools = toolbox.tools;

            expect(tools).toHaveLength(5);
            expect(tools.map((t) => t.name)).toEqual([
                'list_directory',
                'workspace_path',
                'create_file',
                'create_directory',
                'exists',
            ]);
        });

        it('should have correct tool definitions', () => {
            const tools = toolbox.tools;

            const listDirTool = tools.find((t) => t.name === 'list_directory');
            expect(listDirTool).toEqual({
                name: 'list_directory',
                description: 'Get list of files and folders in given path',
                parameters: {
                    type: 'object',
                    properties: {
                        path: {
                            type: 'string',
                            description: 'Directory path to list',
                        },
                        includeHidden: {
                            type: 'boolean',
                            description: 'Include hidden files and folders',
                            default: false,
                        },
                    },
                    required: ['path'],
                },
                permission: 'none',
            });

            const createFileTool = tools.find((t) => t.name === 'create_file');
            expect(createFileTool?.permission).toBe('loose');

            const workspacePathTool = tools.find(
                (t) => t.name === 'workspace_path'
            );
            expect(workspacePathTool?.permission).toBe('none');
        });
    });

    describe('callTool', () => {
        describe('list_directory', () => {
            it('should call delegate listDirectory method', async () => {
                const params = { path: '/test/path', includeHidden: true };
                const toolCall: ToolCallParameter = {
                    name: 'list_directory',
                    parameters: params,
                };

                const generator = toolbox.callTool(toolCall);
                const control: AsyncControl = { type: 'continue' };

                // Iterate through all messages until completion
                const messages = [];
                let result = await generator.next(control);

                while (!result.done) {
                    messages.push(result.value);
                    result = await generator.next(control);
                }

                expect(mockDelegate.listDirectory).toHaveBeenCalledWith(params);
                expect(result.done).toBe(true);
            });
        });

        describe('workspace_path', () => {
            it('should call delegate workspacePath method', async () => {
                const toolCall: ToolCallParameter = {
                    name: 'workspace_path',
                    parameters: {},
                };

                const generator = toolbox.callTool(toolCall);
                const control: AsyncControl = { type: 'continue' };

                // Iterate through all messages until completion
                const messages = [];
                let result = await generator.next(control);

                while (!result.done) {
                    messages.push(result.value);
                    result = await generator.next(control);
                }

                expect(mockDelegate.workspacePath).toHaveBeenCalledWith({});
                expect(result.done).toBe(true);
            });
        });

        describe('create_file', () => {
            it('should request permission and call delegate when allowed', async () => {
                mockSettingsStore.setToolAllowed('create_file', true);

                const params = {
                    filePath: '/test/file.txt',
                    content: 'test content',
                };
                const toolCall: ToolCallParameter = {
                    name: 'create_file',
                    parameters: params,
                };

                const generator = toolbox.callTool(toolCall);
                const control: AsyncControl = { type: 'continue' };

                // Iterate through all messages until completion
                const messages = [];
                let result = await generator.next(control);

                while (!result.done) {
                    messages.push(result.value);
                    result = await generator.next(control);
                }

                expect(mockDelegate.createFile).toHaveBeenCalledWith(params);
                expect(result.done).toBe(true);
            });

            it('should deny execution when tool is denied', async () => {
                mockSettingsStore.setToolDenied('create_file', true);

                const params = { filePath: '/test/file.txt' };
                const toolCall: ToolCallParameter = {
                    name: 'create_file',
                    parameters: params,
                };

                const generator = toolbox.callTool(toolCall);
                const control: AsyncControl = { type: 'continue' };

                // Iterate through all messages until completion
                const messages = [];
                let result = await generator.next(control);

                while (!result.done) {
                    messages.push(result.value);
                    result = await generator.next(control);
                }

                expect(mockDelegate.createFile).not.toHaveBeenCalled();
                expect(result.done).toBe(true);
                expect(result.value.messages[0].type).toBe('error');
                expect(result.value.messages[0].content).toContain(
                    "Permission denied for tool 'create_file'"
                );
            });

            it('should ask for user permission when not in settings', async () => {
                const params = { filePath: '/test/file.txt' };
                const toolCall: ToolCallParameter = {
                    name: 'create_file',
                    parameters: params,
                };

                const generator = toolbox.callTool(toolCall);

                // First call should yield choice message
                const choiceResult1 = await generator.next({
                    type: 'continue',
                });
                expect(choiceResult1.done).toBe(false);
                expect(choiceResult1.value.type).toBe('choice');
                expect(choiceResult1.value.content).toContain(
                    "Allow agent to create a file at '/test/file.txt' (empty)?"
                );

                // Second call should yield the same choice message and wait for control
                const choiceResult2 = await generator.next({
                    type: 'continue',
                });
                expect(choiceResult2.done).toBe(false);
                expect(choiceResult2.value.type).toBe('choice');

                // User allows execution
                const userResponse = {
                    id: 'user-response',
                    content: 'allow',
                    type: 'user-choice' as const,
                    sender: 'user',
                    timestamp: new Date(),
                    metadata: {
                        choice: 0,
                        choices: [
                            { label: 'Allow', value: 'allow' },
                            { label: 'Always Allow', value: 'always_allow' },
                            { label: 'Deny', value: 'deny' },
                            { label: 'Always Deny', value: 'always_deny' },
                        ],
                    },
                };

                // Continue iterating until completion
                const messages = [];
                let result = await generator.next({
                    type: 'continue',
                    responseMessage: userResponse,
                });

                while (!result.done) {
                    messages.push(result.value);
                    result = await generator.next({ type: 'continue' });
                }

                expect(mockDelegate.createFile).toHaveBeenCalledWith(params);
                expect(result.done).toBe(true);
            });
        });

        describe('create_directory', () => {
            it('should handle loose permission correctly', async () => {
                mockSettingsStore.setToolAllowed('create_directory', true);

                const params = { directoryPath: '/test/dir', recursive: true };
                const toolCall: ToolCallParameter = {
                    name: 'create_directory',
                    parameters: params,
                };

                const generator = toolbox.callTool(toolCall);
                const control: AsyncControl = { type: 'continue' };

                // Iterate through all messages until completion
                const messages = [];
                let result = await generator.next(control);

                while (!result.done) {
                    messages.push(result.value);
                    result = await generator.next(control);
                }

                expect(mockDelegate.createDirectory).toHaveBeenCalledWith(
                    params
                );
                expect(result.done).toBe(true);
            });
        });

        describe('exists', () => {
            it('should call delegate exists method without permission check', async () => {
                const params = { path: '/test/path' };
                const toolCall: ToolCallParameter = {
                    name: 'exists',
                    parameters: params,
                };

                const generator = toolbox.callTool(toolCall);
                const control: AsyncControl = { type: 'continue' };

                // Iterate through all messages until completion
                const messages = [];
                let result = await generator.next(control);

                while (!result.done) {
                    messages.push(result.value);
                    result = await generator.next(control);
                }

                expect(mockDelegate.exists).toHaveBeenCalledWith(params);
                expect(result.done).toBe(true);
            });
        });

        describe('unknown tool', () => {
            it('should call respondsWithNoToolsError for unknown tools', async () => {
                const toolCall: ToolCallParameter = {
                    name: 'unknown_tool',
                    parameters: {},
                };

                const generator = toolbox.callTool(toolCall);
                const control: AsyncControl = { type: 'continue' };

                // Iterate through all messages until completion
                const messages = [];
                let result = await generator.next(control);

                while (!result.done) {
                    messages.push(result.value);
                    result = await generator.next(control);
                }

                expect(
                    mockDelegate.respondsWithNoToolsError
                ).toHaveBeenCalledWith({});
                expect(result.done).toBe(true);
            });
        });
    });

    describe('permission handling', () => {
        describe('createSpecificPrompt', () => {
            it('should create specific prompt for create_file with content', () => {
                const toolbox = new WorkspaceToolbox(
                    mockSettingsStore,
                    mockDelegate
                );
                const prompt = (toolbox as any).createSpecificPrompt(
                    'create_file',
                    { filePath: '/test/file.txt', content: 'hello world' }
                );
                expect(prompt).toBe(
                    "Allow agent to create a file at '/test/file.txt' with content?"
                );
            });

            it('should create specific prompt for create_file without content', () => {
                const toolbox = new WorkspaceToolbox(
                    mockSettingsStore,
                    mockDelegate
                );
                const prompt = (toolbox as any).createSpecificPrompt(
                    'create_file',
                    { filePath: '/test/empty.txt' }
                );
                expect(prompt).toBe(
                    "Allow agent to create a file at '/test/empty.txt' (empty)?"
                );
            });

            it('should create specific prompt for create_directory with recursive', () => {
                const toolbox = new WorkspaceToolbox(
                    mockSettingsStore,
                    mockDelegate
                );
                const prompt = (toolbox as any).createSpecificPrompt(
                    'create_directory',
                    { directoryPath: '/test/nested/dir', recursive: true }
                );
                expect(prompt).toBe(
                    "Allow agent to create a directory at '/test/nested/dir' recursively?"
                );
            });

            it('should create specific prompt for create_directory without recursive', () => {
                const toolbox = new WorkspaceToolbox(
                    mockSettingsStore,
                    mockDelegate
                );
                const prompt = (toolbox as any).createSpecificPrompt(
                    'create_directory',
                    { directoryPath: '/test/dir', recursive: false }
                );
                expect(prompt).toBe(
                    "Allow agent to create a directory at '/test/dir'?"
                );
            });

            it('should create generic prompt for unknown tools', () => {
                const toolbox = new WorkspaceToolbox(
                    mockSettingsStore,
                    mockDelegate
                );
                const params = { param1: 'value1', param2: 'value2' };
                const prompt = (toolbox as any).createSpecificPrompt(
                    'unknown_tool',
                    params
                );
                expect(prompt).toBe(
                    'Allow tool \'unknown_tool\' to execute with parameters: {"param1":"value1","param2":"value2"}?'
                );
            });
        });

        describe('custom prompt support', () => {
            it('should use custom prompt when provided to executeWithPermission', async () => {
                const toolbox = new WorkspaceToolbox(
                    mockSettingsStore,
                    mockDelegate
                );

                // Access private method to test custom prompt functionality
                const generator = (toolbox as any).executeWithPermission(
                    'test_tool',
                    'loose',
                    { param: 'value' },
                    async function* () {
                        yield {
                            id: 'test',
                            content: 'test',
                            type: 'tool',
                            sender: 'test',
                            timestamp: new Date(),
                        };
                        return {
                            messages: [],
                            completedReason: 'completed',
                            usage: {
                                inputTokens: 0,
                                outputTokens: 0,
                                toolsUsed: 1,
                            },
                        };
                    },
                    'Custom permission prompt for testing?'
                );

                // First call should yield choice message with custom prompt
                const choiceResult = await generator.next({ type: 'continue' });
                expect(choiceResult.done).toBe(false);
                expect(choiceResult.value.type).toBe('choice');
                expect(choiceResult.value.content).toContain(
                    'Custom permission prompt for testing?'
                );
                expect(choiceResult.value.metadata?.prompt).toBe(
                    'Custom permission prompt for testing?'
                );
            });
        });

        describe('user choice handling', () => {
            it('should save "always_allow" choice to settings', async () => {
                const params = { filePath: '/test/file.txt' };
                const toolCall: ToolCallParameter = {
                    name: 'create_file',
                    parameters: params,
                };

                const generator = toolbox.callTool(toolCall);

                // Get choice messages (two yields)
                await generator.next({ type: 'continue' });
                await generator.next({ type: 'continue' });

                // User chooses "always allow"
                const userResponse = {
                    id: 'user-response',
                    content: 'always_allow',
                    type: 'user-choice' as const,
                    sender: 'user',
                    timestamp: new Date(),
                    metadata: {
                        choice: 1,
                        choices: [
                            { label: 'Allow', value: 'allow' },
                            { label: 'Always Allow', value: 'always_allow' },
                            { label: 'Deny', value: 'deny' },
                            { label: 'Always Deny', value: 'always_deny' },
                        ],
                    },
                };

                // Continue iterating until completion
                const messages = [];
                let result = await generator.next({
                    type: 'continue',
                    responseMessage: userResponse,
                });

                while (!result.done) {
                    messages.push(result.value);
                    result = await generator.next({ type: 'continue' });
                }

                expect(mockSettingsStore.addAllowedTool).toHaveBeenCalledWith(
                    'create_file'
                );
            });

            it('should save "always_deny" choice to settings', async () => {
                const params = { filePath: '/test/file.txt' };
                const toolCall: ToolCallParameter = {
                    name: 'create_file',
                    parameters: params,
                };

                const generator = toolbox.callTool(toolCall);

                // Get choice messages (two yields)
                await generator.next({ type: 'continue' });
                await generator.next({ type: 'continue' });

                // User chooses "always deny"
                const userResponse = {
                    id: 'user-response',
                    content: 'always_deny',
                    type: 'user-choice' as const,
                    sender: 'user',
                    timestamp: new Date(),
                    metadata: {
                        choice: 3,
                        choices: [
                            { label: 'Allow', value: 'allow' },
                            { label: 'Always Allow', value: 'always_allow' },
                            { label: 'Deny', value: 'deny' },
                            { label: 'Always Deny', value: 'always_deny' },
                        ],
                    },
                };

                // Continue iterating until completion
                const messages = [];
                let result = await generator.next({
                    type: 'continue',
                    responseMessage: userResponse,
                });

                while (!result.done) {
                    messages.push(result.value);
                    result = await generator.next({ type: 'continue' });
                }

                expect(mockSettingsStore.addDeniedTool).toHaveBeenCalledWith(
                    'create_file'
                );
                expect(mockDelegate.createFile).not.toHaveBeenCalled();
            });

            it('should handle invalid choice gracefully', async () => {
                const params = { filePath: '/test/file.txt' };
                const toolCall: ToolCallParameter = {
                    name: 'create_file',
                    parameters: params,
                };

                const generator = toolbox.callTool(toolCall);

                // Get choice messages (two yields)
                await generator.next({ type: 'continue' });
                await generator.next({ type: 'continue' });

                // User provides invalid response
                const userResponse = {
                    id: 'user-response',
                    content: 'invalid',
                    type: 'user-choice' as const,
                    sender: 'user',
                    timestamp: new Date(),
                    metadata: { choice: 999, choices: [] },
                };

                // Continue iterating until completion
                const messages = [];
                let result = await generator.next({
                    type: 'continue',
                    responseMessage: userResponse,
                });

                while (!result.done) {
                    messages.push(result.value);
                    result = await generator.next({ type: 'continue' });
                }

                expect(mockDelegate.createFile).not.toHaveBeenCalled();
                expect(result.value.messages[0].type).toBe('error');
            });
        });
    });
});
