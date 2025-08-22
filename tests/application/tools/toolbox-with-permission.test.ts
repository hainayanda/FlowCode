import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ToolboxWithPermission } from '../../../src/application/tools/toolbox-with-permission';
import {
    Toolbox,
    ToolCallParameter,
    ToolDefinition,
    ToolboxPromptSource,
} from '../../../src/application/tools/interfaces/toolbox';
import { SettingsStore } from '../../../src/application/stores/interfaces/settings-store';
import { AsyncControlResponse } from '../../../src/common/models/async-control';
import {
    Message,
    ToolsMessage,
    ChoiceMessage,
} from '../../../src/application/stores/models/messages';
import { generateUniqueId } from '../../../src/common/utils/id-generator';

vi.mock('../../../src/common/utils/id-generator');

describe('ToolboxWithPermission', () => {
    let mockToolbox: Toolbox;
    let mockToolboxWithPromptSource: Toolbox & ToolboxPromptSource;
    let mockSettingsStore: SettingsStore;
    let toolboxWithPermission: ToolboxWithPermission;

    const createMockTools = (): ToolDefinition[] => [
        {
            name: 'none_tool',
            description: 'Tool with none permission',
            parameters: {},
            permission: 'none',
        },
        {
            name: 'loose_tool1',
            description: 'Tool with loose permission',
            parameters: {},
            permission: 'loose',
        },
        {
            name: 'loose_tool2',
            description: 'Another loose tool',
            parameters: {},
            permission: 'loose',
        },
        {
            name: 'strict_tool',
            description: 'Tool with strict permission',
            parameters: {},
            permission: 'strict',
        },
        {
            name: 'always_tool',
            description: 'Tool with always permission',
            parameters: {},
            permission: 'always',
        },
    ];

    beforeEach(() => {
        vi.mocked(generateUniqueId).mockReturnValue('test-id');

        mockToolbox = {
            tools: createMockTools(),
            async *callTool(parameter: ToolCallParameter) {
                const message: ToolsMessage = {
                    id: 'tool-msg-id',
                    content: `${parameter.name} executed successfully`,
                    type: 'tool',
                    sender: parameter.name,
                    timestamp: new Date(),
                    metadata: {
                        toolName: parameter.name,
                        parameters: parameter.parameters,
                        result: 'success',
                    },
                };
                yield message;
                return {
                    messages: [message],
                    completedReason: 'completed' as const,
                    usage: { inputTokens: 10, outputTokens: 20, toolsUsed: 1 },
                };
            },
            async *callTools(parameters: ToolCallParameter[]) {
                const messages: Message[] = [];
                let totalUsage = {
                    inputTokens: 0,
                    outputTokens: 0,
                    toolsUsed: 0,
                };

                for (const param of parameters) {
                    const result = yield* this.callTool(param);
                    messages.push(...result.messages);
                    totalUsage.inputTokens += result.usage.inputTokens;
                    totalUsage.outputTokens += result.usage.outputTokens;
                    totalUsage.toolsUsed += result.usage.toolsUsed;
                }

                return {
                    messages,
                    completedReason: 'completed' as const,
                    usage: totalUsage,
                };
            },
        };

        mockToolboxWithPromptSource = {
            ...mockToolbox,
            getBatchLoosePermissionPrompt(
                parameters: ToolCallParameter[]
            ): string {
                const tools = parameters.map((p) => p.name).join(', ');
                return `Custom batch prompt for: ${tools}`;
            },
            getPermissionPrompt(parameter: ToolCallParameter): string {
                return `Custom prompt for ${parameter.name}`;
            },
        };

        mockSettingsStore = {
            allowedTools: [],
            deniedTools: [],
            fetchSettings: vi
                .fn()
                .mockResolvedValue({ allowedTools: [], deniedTools: [] }),
            fetchAllowedTools: vi.fn().mockResolvedValue([]),
            fetchDeniedTools: vi.fn().mockResolvedValue([]),
            isToolAllowed: vi.fn().mockResolvedValue(false),
            isToolDenied: vi.fn().mockResolvedValue(false),
            writeSettings: vi.fn().mockResolvedValue(undefined),
            addAllowedTool: vi.fn().mockResolvedValue(undefined),
            addDeniedTool: vi.fn().mockResolvedValue(undefined),
            removeAllowedTool: vi.fn().mockResolvedValue(undefined),
            removeDeniedTool: vi.fn().mockResolvedValue(undefined),
        };
    });

    describe('single tool execution (callTool)', () => {
        beforeEach(() => {
            toolboxWithPermission = new ToolboxWithPermission(
                mockToolbox,
                mockSettingsStore
            );
        });

        it('should execute none permission tool immediately', async () => {
            const parameter: ToolCallParameter = {
                name: 'none_tool',
                parameters: {},
            };

            const generator = toolboxWithPermission.callTool(parameter);
            const { value: message } = await generator.next();
            const { value: result } = await generator.next();

            expect((message as ToolsMessage).content).toBe(
                'none_tool executed successfully'
            );
            expect((result as AsyncControlResponse).usage.toolsUsed).toBe(1);
        });

        it('should return error for unknown tool', async () => {
            const parameter: ToolCallParameter = {
                name: 'unknown_tool',
                parameters: {},
            };

            const generator = toolboxWithPermission.callTool(parameter);
            const { value: errorMessage } = await generator.next();

            expect((errorMessage as Message).type).toBe('error');
            expect((errorMessage as Message).content).toBe(
                'Unknown tool: unknown_tool'
            );
        });
    });

    describe('batch tool execution (callTools)', () => {
        beforeEach(() => {
            toolboxWithPermission = new ToolboxWithPermission(
                mockToolbox,
                mockSettingsStore
            );
        });

        it('should execute none permission tools immediately', async () => {
            const parameters: ToolCallParameter[] = [
                { name: 'none_tool', parameters: {} },
            ];

            const generator = toolboxWithPermission.callTools(parameters);
            const { value: message } = await generator.next();
            const { value: result } = await generator.next();

            expect((message as ToolsMessage).content).toBe(
                'none_tool executed successfully'
            );
            expect((result as AsyncControlResponse).usage.toolsUsed).toBe(1);
        });

        it('should handle empty parameters array', async () => {
            const generator = toolboxWithPermission.callTools([]);
            const { value: result } = await generator.next();

            expect((result as AsyncControlResponse).messages).toHaveLength(0);
            expect((result as AsyncControlResponse).usage.toolsUsed).toBe(0);
        });
    });

    describe('batch loose permission handling', () => {
        beforeEach(() => {
            toolboxWithPermission = new ToolboxWithPermission(
                mockToolbox,
                mockSettingsStore
            );
        });

        it('should ask batch permission for multiple loose tools', async () => {
            mockSettingsStore.isToolAllowed = vi.fn().mockResolvedValue(false);
            mockSettingsStore.isToolDenied = vi.fn().mockResolvedValue(false);

            const parameters: ToolCallParameter[] = [
                { name: 'loose_tool1', parameters: {} },
                { name: 'loose_tool2', parameters: {} },
            ];

            const generator = toolboxWithPermission.callTools(parameters);
            const { value: choiceMessage } = await generator.next();

            expect((choiceMessage as Message).type).toBe('choice');
            expect((choiceMessage as Message).content).toContain(
                'loose_tool1, loose_tool2'
            );
            expect(
                (choiceMessage as ChoiceMessage).metadata.choices
            ).toHaveLength(4); // allow, always_allow, deny, always_deny
        });

        it('should execute all loose tools when batch allowed', async () => {
            mockSettingsStore.isToolAllowed = vi.fn().mockResolvedValue(false);
            mockSettingsStore.isToolDenied = vi.fn().mockResolvedValue(false);

            const parameters: ToolCallParameter[] = [
                { name: 'loose_tool1', parameters: {} },
                { name: 'loose_tool2', parameters: {} },
            ];

            const generator = toolboxWithPermission.callTools(parameters);

            // First yield: choice message
            const { value: choiceMessage } = await generator.next();
            expect((choiceMessage as Message).type).toBe('choice');

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

            const asyncControl = {
                type: 'continue' as const,
                responseMessage: userResponse,
            };

            // Second yield: pass through duplicated yield
            await generator.next(asyncControl);

            // Consume all remaining messages until we get the final result
            let result: AsyncControlResponse | undefined;
            let done = false;
            while (!done) {
                const next = await generator.next(asyncControl);
                if (next.done) {
                    result = next.value;
                    done = true;
                } else {
                    // This is an intermediate message from tool execution
                }
            }

            expect(result).toBeDefined();
            expect(result!.messages).toHaveLength(2);
            expect(result!.messages[0].content).toContain(
                'loose_tool1 executed successfully'
            );
            expect(result!.messages[1].content).toContain(
                'loose_tool2 executed successfully'
            );
        });

        it('should save to settings when always_allow chosen for batch', async () => {
            mockSettingsStore.isToolAllowed = vi.fn().mockResolvedValue(false);
            mockSettingsStore.isToolDenied = vi.fn().mockResolvedValue(false);

            const parameters: ToolCallParameter[] = [
                { name: 'loose_tool1', parameters: {} },
                { name: 'loose_tool2', parameters: {} },
            ];

            const generator = toolboxWithPermission.callTools(parameters);
            await generator.next(); // Get choice message

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

            const asyncControl = {
                type: 'continue' as const,
                responseMessage: userResponse,
            };

            await generator.next(asyncControl);
            await generator.next(asyncControl);

            expect(mockSettingsStore.addAllowedTool).toHaveBeenCalledWith(
                'loose_tool1'
            );
            expect(mockSettingsStore.addAllowedTool).toHaveBeenCalledWith(
                'loose_tool2'
            );
        });

        it('should execute pre-approved loose tools without asking permission', async () => {
            mockSettingsStore.isToolAllowed = vi
                .fn()
                .mockImplementation((tool: string) =>
                    Promise.resolve(tool === 'loose_tool1')
                );
            mockSettingsStore.isToolDenied = vi.fn().mockResolvedValue(false);

            const parameters: ToolCallParameter[] = [
                { name: 'loose_tool1', parameters: {} }, // pre-approved
                { name: 'loose_tool2', parameters: {} }, // needs permission
            ];

            const generator = toolboxWithPermission.callTools(parameters);
            const { value: choiceMessage } = await generator.next();

            // Should only ask for loose_tool2
            expect((choiceMessage as Message).content).toContain('loose_tool2');
            expect((choiceMessage as Message).content).not.toContain(
                'loose_tool1'
            );
        });
    });

    describe('individual permission handling (strict and always)', () => {
        beforeEach(() => {
            toolboxWithPermission = new ToolboxWithPermission(
                mockToolbox,
                mockSettingsStore
            );
        });

        it('should ask individual permission for strict tools', async () => {
            mockSettingsStore.isToolAllowed = vi.fn().mockResolvedValue(false);
            mockSettingsStore.isToolDenied = vi.fn().mockResolvedValue(false);

            const parameters: ToolCallParameter[] = [
                { name: 'strict_tool', parameters: { param1: 'value1' } },
            ];

            const generator = toolboxWithPermission.callTools(parameters);
            const { value: choiceMessage } = await generator.next();

            expect((choiceMessage as Message).type).toBe('choice');
            expect((choiceMessage as Message).content).toContain('strict_tool');
            expect(
                (choiceMessage as ChoiceMessage).metadata.choices
            ).toHaveLength(4); // has always options
        });

        it('should ask individual permission for always tools', async () => {
            const parameters: ToolCallParameter[] = [
                { name: 'always_tool', parameters: {} },
            ];

            const generator = toolboxWithPermission.callTools(parameters);
            const { value: choiceMessage } = await generator.next();

            expect((choiceMessage as Message).type).toBe('choice');
            expect((choiceMessage as Message).content).toContain('always_tool');
            expect(
                (choiceMessage as ChoiceMessage).metadata.choices
            ).toHaveLength(2); // only allow/deny
        });

        it('should save to settings for strict tools with always_allow', async () => {
            mockSettingsStore.isToolAllowed = vi.fn().mockResolvedValue(false);
            mockSettingsStore.isToolDenied = vi.fn().mockResolvedValue(false);

            const parameters: ToolCallParameter[] = [
                { name: 'strict_tool', parameters: { param1: 'value1' } },
            ];

            const generator = toolboxWithPermission.callTools(parameters);
            await generator.next(); // Get choice message

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

            const asyncControl = {
                type: 'continue' as const,
                responseMessage: userResponse,
            };

            await generator.next(asyncControl);
            await generator.next(asyncControl);

            const expectedKey = 'strict_tool({"param1":"value1"})';
            expect(mockSettingsStore.addAllowedTool).toHaveBeenCalledWith(
                expectedKey
            );
        });

        it('should not save to settings for always tools', async () => {
            const parameters: ToolCallParameter[] = [
                { name: 'always_tool', parameters: {} },
            ];

            const generator = toolboxWithPermission.callTools(parameters);
            await generator.next(); // Get choice message

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
                        { label: 'Deny', value: 'deny' },
                    ],
                },
            };

            const asyncControl = {
                type: 'continue' as const,
                responseMessage: userResponse,
            };

            await generator.next(asyncControl);
            await generator.next(asyncControl);

            expect(mockSettingsStore.addAllowedTool).not.toHaveBeenCalled();
            expect(mockSettingsStore.addDeniedTool).not.toHaveBeenCalled();
        });
    });

    describe('mixed permission scenarios', () => {
        beforeEach(() => {
            toolboxWithPermission = new ToolboxWithPermission(
                mockToolbox,
                mockSettingsStore
            );
        });

        it('should handle mixed permission types correctly', async () => {
            mockSettingsStore.isToolAllowed = vi.fn().mockResolvedValue(false);
            mockSettingsStore.isToolDenied = vi.fn().mockResolvedValue(false);

            const parameters: ToolCallParameter[] = [
                { name: 'none_tool', parameters: {} }, // should execute immediately
                { name: 'loose_tool1', parameters: {} }, // batch permission
                { name: 'strict_tool', parameters: {} }, // individual permission
                { name: 'always_tool', parameters: {} }, // individual permission
            ];

            const generator = toolboxWithPermission.callTools(parameters);

            // First should get none_tool execution
            const { value: noneResult } = await generator.next();
            expect((noneResult as Message).content).toContain(
                'none_tool executed successfully'
            );

            // Then should get batch loose permission request
            const { value: looseChoice } = await generator.next();
            expect((looseChoice as Message).type).toBe('choice');
            expect((looseChoice as Message).content).toContain('loose_tool1');
        });
    });

    describe('custom prompts via ToolboxPromptSource', () => {
        beforeEach(() => {
            toolboxWithPermission = new ToolboxWithPermission(
                mockToolboxWithPromptSource,
                mockSettingsStore
            );
        });

        it('should use custom batch prompt for loose tools', async () => {
            mockSettingsStore.isToolAllowed = vi.fn().mockResolvedValue(false);
            mockSettingsStore.isToolDenied = vi.fn().mockResolvedValue(false);

            const parameters: ToolCallParameter[] = [
                { name: 'loose_tool1', parameters: {} },
                { name: 'loose_tool2', parameters: {} },
            ];

            const generator = toolboxWithPermission.callTools(parameters);
            const { value: choiceMessage } = await generator.next();

            expect((choiceMessage as ChoiceMessage).metadata.prompt).toBe(
                'Custom batch prompt for: loose_tool1, loose_tool2'
            );
        });

        it('should use custom individual prompt for strict/always tools', async () => {
            mockSettingsStore.isToolAllowed = vi.fn().mockResolvedValue(false);
            mockSettingsStore.isToolDenied = vi.fn().mockResolvedValue(false);

            const parameters: ToolCallParameter[] = [
                { name: 'strict_tool', parameters: {} },
            ];

            const generator = toolboxWithPermission.callTools(parameters);
            const { value: choiceMessage } = await generator.next();

            expect((choiceMessage as ChoiceMessage).metadata.prompt).toBe(
                'Custom prompt for strict_tool'
            );
        });
    });

    describe('error handling', () => {
        beforeEach(() => {
            toolboxWithPermission = new ToolboxWithPermission(
                mockToolbox,
                mockSettingsStore
            );
        });

        it('should generate errors for denied tools but continue with allowed ones', async () => {
            mockSettingsStore.isToolAllowed = vi.fn().mockResolvedValue(false);
            mockSettingsStore.isToolDenied = vi.fn().mockResolvedValue(false);

            const parameters: ToolCallParameter[] = [
                { name: 'loose_tool1', parameters: {} },
                { name: 'loose_tool2', parameters: {} },
            ];

            const generator = toolboxWithPermission.callTools(parameters);
            await generator.next(); // Get choice message

            const userResponse = {
                id: 'user-response',
                content: 'deny',
                type: 'user-choice' as const,
                sender: 'user',
                timestamp: new Date(),
                metadata: {
                    choice: 2,
                    choices: [
                        { label: 'Allow', value: 'allow' },
                        { label: 'Always Allow', value: 'always_allow' },
                        { label: 'Deny', value: 'deny' },
                        { label: 'Always Deny', value: 'always_deny' },
                    ],
                },
            };

            const asyncControl = {
                type: 'continue' as const,
                responseMessage: userResponse,
            };

            await generator.next(asyncControl);
            const { value: result } = await generator.next(asyncControl);

            // Should have error messages for both denied tools
            expect((result as AsyncControlResponse).messages).toHaveLength(2);
            expect((result as AsyncControlResponse).messages[0].type).toBe(
                'error'
            );
            expect((result as AsyncControlResponse).messages[1].type).toBe(
                'error'
            );
            expect(
                (result as AsyncControlResponse).messages[0].content
            ).toContain('Permission denied');
        });
    });

    describe('tools property', () => {
        it('should return underlying toolbox tools', () => {
            toolboxWithPermission = new ToolboxWithPermission(
                mockToolbox,
                mockSettingsStore
            );
            expect(toolboxWithPermission.tools).toBe(mockToolbox.tools);
        });
    });
});
