import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ToolWithPermission } from '../../../src/application/tools/tool-with-permission';
import {
    Tool,
    ToolCallParameter,
    ToolPromptSource,
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

describe('ToolWithPermission', () => {
    let mockTool: Tool;
    let mockToolWithPromptSource: Tool & ToolPromptSource;
    let mockSettingsStore: SettingsStore;
    let toolWithPermission: ToolWithPermission;

    beforeEach(() => {
        vi.mocked(generateUniqueId).mockReturnValue('test-id');

        mockTool = {
            definition: {
                name: 'test_tool',
                description: 'Test tool',
                parameters: {},
                permission: 'none',
            },
            async *call(parameter: ToolCallParameter) {
                const message: ToolsMessage = {
                    id: 'tool-msg-id',
                    content: 'Tool executed successfully',
                    type: 'tool',
                    sender: 'test_tool',
                    timestamp: new Date(),
                    metadata: {
                        toolName: 'test_tool',
                        parameters: parameter.parameters,
                        result: 'success',
                    },
                };
                yield message;
                return {
                    messages: [message],
                    completedReason: 'completed' as const,
                    usage: { inputTokens: 0, outputTokens: 0, toolsUsed: 1 },
                };
            },
        };

        mockToolWithPromptSource = {
            ...mockTool,
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

    describe('permission level: none', () => {
        beforeEach(() => {
            mockTool.definition.permission = 'none';
            toolWithPermission = new ToolWithPermission(
                mockTool,
                mockSettingsStore
            );
        });

        it('should execute tool immediately without permission checks', async () => {
            const parameter: ToolCallParameter = {
                name: 'test_tool',
                parameters: { test: 'value' },
            };

            const generator = toolWithPermission.call(parameter);
            const { value: message } = await generator.next();
            const { value: result } = await generator.next();

            expect((message as Message).content).toBe(
                'Tool executed successfully'
            );
            expect((result as AsyncControlResponse).completedReason).toBe(
                'completed'
            );
        });
    });

    describe('permission level: always', () => {
        beforeEach(() => {
            mockTool.definition.permission = 'always';
            toolWithPermission = new ToolWithPermission(
                mockTool,
                mockSettingsStore
            );
        });

        it('should always ask for permission with allow/deny options only', async () => {
            const parameter: ToolCallParameter = {
                name: 'test_tool',
                parameters: { test: 'value' },
            };

            const generator = toolWithPermission.call(parameter);
            const { value: choiceMessage } = await generator.next();

            expect((choiceMessage as Message).type).toBe('choice');
            expect((choiceMessage as ChoiceMessage).metadata.choices).toEqual([
                { label: 'Allow', value: 'allow' },
                { label: 'Deny', value: 'deny' },
            ]);
        });

        it('should execute tool when user allows', async () => {
            const parameter: ToolCallParameter = {
                name: 'test_tool',
                parameters: { test: 'value' },
            };

            const generator = toolWithPermission.call(parameter);

            // First iteration - get choice message
            const choiceResult = await generator.next();
            expect((choiceResult.value as Message).type).toBe('choice');

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

            // Second iteration - pass through duplicated yield
            await generator.next(asyncControl);

            // The tool should execute after permission is granted
            // We should get tool messages from the underlying tool
            const toolResult = await generator.next(asyncControl);
            expect(toolResult.value).toBeDefined();
        });

        it('should deny tool when user denies', async () => {
            const parameter: ToolCallParameter = {
                name: 'test_tool',
                parameters: { test: 'value' },
            };

            const generator = toolWithPermission.call(parameter);

            // First iteration - get choice message
            const choiceResult = await generator.next();
            expect((choiceResult.value as Message).type).toBe('choice');

            const userResponse = {
                id: 'user-response',
                content: 'deny',
                type: 'user-choice' as const,
                sender: 'user',
                timestamp: new Date(),
                metadata: {
                    choice: 1,
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

            // Second iteration - pass through duplicated yield
            await generator.next(asyncControl);

            // Third iteration - should return error message
            const errorResult = await generator.next(asyncControl);
            expect((errorResult.value as Message).type).toBe('error');
            expect((errorResult.value as Message).content).toBe(
                'Permission denied to execute tool'
            );
        });
    });

    describe('permission level: loose', () => {
        beforeEach(() => {
            mockTool.definition.permission = 'loose';
            toolWithPermission = new ToolWithPermission(
                mockTool,
                mockSettingsStore
            );
        });

        it('should execute immediately if tool is in allowed list', async () => {
            mockSettingsStore.isToolAllowed = vi.fn().mockResolvedValue(true);

            const parameter: ToolCallParameter = {
                name: 'test_tool',
                parameters: { test: 'value' },
            };

            const generator = toolWithPermission.call(parameter);
            const { value: message } = await generator.next();
            const { value: result } = await generator.next();

            expect((message as Message).content).toBe(
                'Tool executed successfully'
            );
            expect((result as AsyncControlResponse).completedReason).toBe(
                'completed'
            );
        });

        it('should deny immediately if tool is in denied list', async () => {
            mockSettingsStore.isToolDenied = vi.fn().mockResolvedValue(true);

            const parameter: ToolCallParameter = {
                name: 'test_tool',
                parameters: { test: 'value' },
            };

            const generator = toolWithPermission.call(parameter);
            const { value: errorMessage } = await generator.next();

            expect((errorMessage as Message).type).toBe('error');
            expect((errorMessage as Message).content).toBe(
                'Permission denied to execute tool'
            );
        });

        it('should ask for permission with all four options if not in settings', async () => {
            mockSettingsStore.isToolAllowed = vi.fn().mockResolvedValue(false);
            mockSettingsStore.isToolDenied = vi.fn().mockResolvedValue(false);

            const parameter: ToolCallParameter = {
                name: 'test_tool',
                parameters: { test: 'value' },
            };

            const generator = toolWithPermission.call(parameter);
            const { value: choiceMessage } = await generator.next();

            expect((choiceMessage as Message).type).toBe('choice');
            expect((choiceMessage as ChoiceMessage).metadata.choices).toEqual([
                { label: 'Allow', value: 'allow' },
                { label: 'Always Allow', value: 'always_allow' },
                { label: 'Deny', value: 'deny' },
                { label: 'Always Deny', value: 'always_deny' },
            ]);
        });
    });

    describe('ToolPromptSource integration', () => {
        beforeEach(() => {
            mockToolWithPromptSource.definition.permission = 'always';
            toolWithPermission = new ToolWithPermission(
                mockToolWithPromptSource,
                mockSettingsStore
            );
        });

        it('should use custom prompt from ToolPromptSource', async () => {
            const parameter: ToolCallParameter = {
                name: 'test_tool',
                parameters: { test: 'value' },
            };

            const generator = toolWithPermission.call(parameter);
            const { value: choiceMessage } = await generator.next();

            expect((choiceMessage as ChoiceMessage).metadata.prompt).toBe(
                'Custom prompt for test_tool'
            );
        });
    });

    describe('unknown permission level', () => {
        beforeEach(() => {
            mockTool.definition.permission = 'unknown' as any;
            toolWithPermission = new ToolWithPermission(
                mockTool,
                mockSettingsStore
            );
        });

        it('should deny execution for unknown permission levels', async () => {
            const parameter: ToolCallParameter = {
                name: 'test_tool',
                parameters: { test: 'value' },
            };

            const generator = toolWithPermission.call(parameter);
            const { value: errorMessage } = await generator.next();

            expect((errorMessage as Message).type).toBe('error');
            expect((errorMessage as Message).content).toBe(
                'Unknown permission level: unknown'
            );
        });
    });

    describe('definition property', () => {
        it('should return the underlying tool definition', () => {
            toolWithPermission = new ToolWithPermission(
                mockTool,
                mockSettingsStore
            );
            expect(toolWithPermission.definition).toBe(mockTool.definition);
        });
    });

    describe('permission key generation', () => {
        beforeEach(() => {
            mockTool.definition.permission = 'loose';
            toolWithPermission = new ToolWithPermission(
                mockTool,
                mockSettingsStore
            );
        });

        it('should use tool name only for loose permission', async () => {
            mockSettingsStore.isToolAllowed = vi.fn().mockResolvedValue(false);
            mockSettingsStore.isToolDenied = vi.fn().mockResolvedValue(false);

            const parameter: ToolCallParameter = {
                name: 'test_tool',
                parameters: { param1: 'value1', param2: 'value2' },
            };

            const generator = toolWithPermission.call(parameter);
            await generator.next(); // This should trigger permission checking

            expect(mockSettingsStore.isToolAllowed).toHaveBeenCalledWith(
                'test_tool'
            );
            expect(mockSettingsStore.isToolDenied).toHaveBeenCalledWith(
                'test_tool'
            );
        });

        it('should use tool name and parameters for strict permission', async () => {
            mockTool.definition.permission = 'strict';
            toolWithPermission = new ToolWithPermission(
                mockTool,
                mockSettingsStore
            );

            mockSettingsStore.isToolAllowed = vi.fn().mockResolvedValue(false);
            mockSettingsStore.isToolDenied = vi.fn().mockResolvedValue(false);

            const parameter: ToolCallParameter = {
                name: 'test_tool',
                parameters: { param2: 'value2', param1: 'value1' }, // Unordered to test sorting
            };

            const generator = toolWithPermission.call(parameter);
            await generator.next(); // This should trigger permission checking

            const expectedKey =
                'test_tool({"param1":"value1","param2":"value2"})';
            expect(mockSettingsStore.isToolAllowed).toHaveBeenCalledWith(
                expectedKey
            );
            expect(mockSettingsStore.isToolDenied).toHaveBeenCalledWith(
                expectedKey
            );
        });

        it('should save to settings when user chooses always allow for loose permission', async () => {
            mockSettingsStore.isToolAllowed = vi.fn().mockResolvedValue(false);
            mockSettingsStore.isToolDenied = vi.fn().mockResolvedValue(false);

            const parameter: ToolCallParameter = {
                name: 'test_tool',
                parameters: { param1: 'value1' },
            };

            const generator = toolWithPermission.call(parameter);
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

            await generator.next(asyncControl); // Pass through duplicated yield
            await generator.next(asyncControl); // Handle response

            expect(mockSettingsStore.addAllowedTool).toHaveBeenCalledWith(
                'test_tool'
            );
        });

        it('should save to settings when user chooses always deny for strict permission', async () => {
            mockTool.definition.permission = 'strict';
            toolWithPermission = new ToolWithPermission(
                mockTool,
                mockSettingsStore
            );

            mockSettingsStore.isToolAllowed = vi.fn().mockResolvedValue(false);
            mockSettingsStore.isToolDenied = vi.fn().mockResolvedValue(false);

            const parameter: ToolCallParameter = {
                name: 'test_tool',
                parameters: { param1: 'value1' },
            };

            const generator = toolWithPermission.call(parameter);
            await generator.next(); // Get choice message

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

            const asyncControl = {
                type: 'continue' as const,
                responseMessage: userResponse,
            };

            await generator.next(asyncControl); // Pass through duplicated yield
            await generator.next(asyncControl); // Handle response

            const expectedKey = 'test_tool({"param1":"value1"})';
            expect(mockSettingsStore.addDeniedTool).toHaveBeenCalledWith(
                expectedKey
            );
        });
    });
});
