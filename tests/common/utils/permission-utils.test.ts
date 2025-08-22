import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    generatePermissionKey,
    checkPermission,
    createPermissionChoiceMessage,
    handlePermissionResponse,
    handleToolPermission,
} from '../../../src/common/utils/permission-utils';
import { SettingsStore } from '../../../src/application/stores/interfaces/settings-store';
import { Message } from '../../../src/application/stores/models/messages';
import { AsyncControl } from '../../../src/common/models/async-control';

// Mock settings store
const createMockSettingsStore = (): SettingsStore =>
    ({
        isToolAllowed: vi.fn(),
        isToolDenied: vi.fn(),
        addAllowedTool: vi.fn(),
        addDeniedTool: vi.fn(),
    }) as any;

describe('permission-utils', () => {
    describe('generatePermissionKey', () => {
        it('should return tool name for loose permission', () => {
            const key = generatePermissionKey('test_tool', 'loose');
            expect(key).toBe('test_tool');
        });

        it('should return tool name for loose permission with parameters', () => {
            const parameters = { param1: 'value1', param2: 'value2' };
            const key = generatePermissionKey('test_tool', 'loose', parameters);
            expect(key).toBe('test_tool');
        });

        it('should generate key with sorted parameters for strict permission', () => {
            const parameters = { param2: 'value2', param1: 'value1' };
            const key = generatePermissionKey(
                'test_tool',
                'strict',
                parameters
            );
            expect(key).toBe(
                'test_tool({"param1":"value1","param2":"value2"})'
            );
        });

        it('should return tool name only for strict permission without parameters', () => {
            const key = generatePermissionKey('test_tool', 'strict');
            expect(key).toBe('test_tool');
        });

        it('should handle complex parameter values in strict mode', () => {
            const parameters = {
                nested: { key: 'value' },
                array: [1, 2, 3],
                string: 'test',
            };
            const key = generatePermissionKey(
                'test_tool',
                'strict',
                parameters
            );
            expect(key).toBe(
                'test_tool({"array":[1,2,3],"nested":{"key":"value"},"string":"test"})'
            );
        });
    });

    describe('checkPermission', () => {
        it('should return allowed true when tool is in allowed list', async () => {
            const mockStore = createMockSettingsStore();
            vi.mocked(mockStore.isToolAllowed).mockResolvedValue(true);
            vi.mocked(mockStore.isToolDenied).mockResolvedValue(false);

            const result = await checkPermission(
                mockStore,
                'test_tool',
                'loose',
                {}
            );

            expect(result).toEqual({ allowed: true });
            expect(mockStore.isToolAllowed).toHaveBeenCalledWith('test_tool');
        });

        it('should return allowed false when tool is in denied list', async () => {
            const mockStore = createMockSettingsStore();
            vi.mocked(mockStore.isToolAllowed).mockResolvedValue(false);
            vi.mocked(mockStore.isToolDenied).mockResolvedValue(true);

            const result = await checkPermission(
                mockStore,
                'test_tool',
                'loose',
                {}
            );

            expect(result).toEqual({ allowed: false });
            expect(mockStore.isToolDenied).toHaveBeenCalledWith('test_tool');
        });

        it('should return needsUserInput when tool is not in any list', async () => {
            const mockStore = createMockSettingsStore();
            vi.mocked(mockStore.isToolAllowed).mockResolvedValue(false);
            vi.mocked(mockStore.isToolDenied).mockResolvedValue(false);

            const result = await checkPermission(
                mockStore,
                'test_tool',
                'loose',
                {}
            );

            expect(result).toEqual({ allowed: false, needsUserInput: true });
        });

        it('should use correct permission key for strict mode', async () => {
            const mockStore = createMockSettingsStore();
            vi.mocked(mockStore.isToolAllowed).mockResolvedValue(false);
            vi.mocked(mockStore.isToolDenied).mockResolvedValue(false);

            const parameters = { param1: 'value1' };
            await checkPermission(mockStore, 'test_tool', 'strict', parameters);

            expect(mockStore.isToolAllowed).toHaveBeenCalledWith(
                'test_tool({"param1":"value1"})'
            );
            expect(mockStore.isToolDenied).toHaveBeenCalledWith(
                'test_tool({"param1":"value1"})'
            );
        });
    });

    describe('createPermissionChoiceMessage', () => {
        it('should create a choice message with correct structure', () => {
            const prompt = 'Allow test operation?';
            const message = createPermissionChoiceMessage(prompt);

            expect(message.type).toBe('choice');
            expect(message.sender).toBe('workspace-tool');
            expect(message.content).toContain(prompt);
            expect(message.content).toContain('Allow (allow)');
            expect(message.content).toContain('Always Allow (always_allow)');
            expect(message.content).toContain('Deny (deny)');
            expect(message.content).toContain('Always Deny (always_deny)');

            expect(message.metadata?.prompt).toBe(prompt);
            expect(message.metadata?.choices).toHaveLength(4);
            expect(message.metadata?.choices?.[0]).toEqual({
                label: 'Allow',
                value: 'allow',
            });
        });

        it('should generate unique message ID', () => {
            const message1 = createPermissionChoiceMessage('Test 1');
            const message2 = createPermissionChoiceMessage('Test 2');

            expect(message1.id).not.toBe(message2.id);
            expect(message1.id).toContain('permission-choice');
        });
    });

    describe('handlePermissionResponse', () => {
        let mockStore: SettingsStore;

        beforeEach(() => {
            mockStore = createMockSettingsStore();
        });

        it('should return false for no response message', async () => {
            const result = await handlePermissionResponse(
                mockStore,
                undefined,
                'test_tool',
                'loose',
                {}
            );

            expect(result).toBe(false);
        });

        it('should return false for wrong message type', async () => {
            const message: Message = {
                id: 'test',
                content: 'test',
                type: 'user',
                sender: 'user',
                timestamp: new Date(),
            };

            const result = await handlePermissionResponse(
                mockStore,
                message,
                'test_tool',
                'loose',
                {}
            );

            expect(result).toBe(false);
        });

        it('should return true for allow choice', async () => {
            const message = {
                id: 'test',
                content: 'test',
                type: 'user-choice',
                sender: 'user',
                timestamp: new Date(),
                metadata: {
                    choice: 0,
                    choices: [{ label: 'Allow', value: 'allow' }],
                },
            } as any;

            const result = await handlePermissionResponse(
                mockStore,
                message,
                'test_tool',
                'loose',
                {}
            );

            expect(result).toBe(true);
        });

        it('should add to allowed list and return true for always_allow', async () => {
            const message = {
                id: 'test',
                content: 'test',
                type: 'user-choice',
                sender: 'user',
                timestamp: new Date(),
                metadata: {
                    choice: 1,
                    choices: [
                        { label: 'Allow', value: 'allow' },
                        { label: 'Always Allow', value: 'always_allow' },
                    ],
                },
            } as any;

            const result = await handlePermissionResponse(
                mockStore,
                message,
                'test_tool',
                'loose',
                {}
            );

            expect(result).toBe(true);
            expect(mockStore.addAllowedTool).toHaveBeenCalledWith('test_tool');
        });

        it('should return false for deny choice', async () => {
            const message = {
                id: 'test',
                content: 'test',
                type: 'user-choice',
                sender: 'user',
                timestamp: new Date(),
                metadata: {
                    choice: 2,
                    choices: [
                        { label: 'Allow', value: 'allow' },
                        { label: 'Always Allow', value: 'always_allow' },
                        { label: 'Deny', value: 'deny' },
                    ],
                },
            } as any;

            const result = await handlePermissionResponse(
                mockStore,
                message,
                'test_tool',
                'loose',
                {}
            );

            expect(result).toBe(false);
        });

        it('should add to denied list and return false for always_deny', async () => {
            const message = {
                id: 'test',
                content: 'test',
                type: 'user-choice',
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
            } as any;

            const result = await handlePermissionResponse(
                mockStore,
                message,
                'test_tool',
                'loose',
                {}
            );

            expect(result).toBe(false);
            expect(mockStore.addDeniedTool).toHaveBeenCalledWith('test_tool');
        });

        it('should use correct permission key for strict mode', async () => {
            const message = {
                id: 'test',
                content: 'test',
                type: 'user-choice',
                sender: 'user',
                timestamp: new Date(),
                metadata: {
                    choice: 1,
                    choices: [
                        { label: 'Allow', value: 'allow' },
                        { label: 'Always Allow', value: 'always_allow' },
                    ],
                },
            } as any;

            const parameters = { param1: 'value1' };
            await handlePermissionResponse(
                mockStore,
                message,
                'test_tool',
                'strict',
                parameters
            );

            expect(mockStore.addAllowedTool).toHaveBeenCalledWith(
                'test_tool({"param1":"value1"})'
            );
        });
    });

    describe('handleToolPermission', () => {
        let mockStore: SettingsStore;

        beforeEach(() => {
            mockStore = createMockSettingsStore();
        });

        it('should return allowed true for none permission', async () => {
            const generator = handleToolPermission(
                mockStore,
                'test_tool',
                'none',
                {},
                'Test prompt'
            );

            const result = await generator.next();
            expect(result.done).toBe(true);
            expect(result.value).toEqual({ allowed: true });
        });

        it('should return allowed true when tool is pre-approved', async () => {
            vi.mocked(mockStore.isToolAllowed).mockResolvedValue(true);
            vi.mocked(mockStore.isToolDenied).mockResolvedValue(false);

            const generator = handleToolPermission(
                mockStore,
                'test_tool',
                'loose',
                {},
                'Test prompt'
            );

            const result = await generator.next();
            expect(result.done).toBe(true);
            expect(result.value).toEqual({ allowed: true });
        });

        it('should return allowed false when tool is denied', async () => {
            vi.mocked(mockStore.isToolAllowed).mockResolvedValue(false);
            vi.mocked(mockStore.isToolDenied).mockResolvedValue(true);

            const generator = handleToolPermission(
                mockStore,
                'test_tool',
                'loose',
                {},
                'Test prompt'
            );

            const result = await generator.next();
            expect(result.done).toBe(true);
            expect(result.value).toEqual({ allowed: false });
        });

        it('should yield choice message and handle user response', async () => {
            vi.mocked(mockStore.isToolAllowed).mockResolvedValue(false);
            vi.mocked(mockStore.isToolDenied).mockResolvedValue(false);

            const generator = handleToolPermission(
                mockStore,
                'test_tool',
                'loose',
                {},
                'Test prompt'
            );

            // First yield should be a choice message
            const choiceResult = await generator.next();
            expect(choiceResult.done).toBe(false);
            expect((choiceResult.value as Message)?.type).toBe('choice');
            expect((choiceResult.value as Message)?.content).toContain(
                'Test prompt'
            );

            // Mock user response
            const userResponse = {
                id: 'response',
                content: 'response',
                type: 'user-choice',
                sender: 'user',
                timestamp: new Date(),
                metadata: {
                    choice: 0,
                    choices: [{ label: 'Allow', value: 'allow' }],
                },
            } as any;

            const asyncControl: AsyncControl = {
                type: 'continue',
                responseMessage: userResponse,
            };

            // Second iteration - pass through the duplicated yield
            const secondResult = await generator.next(asyncControl);
            expect(secondResult.done).toBe(false);

            // Third yield should handle the response
            const finalResult = await generator.next(asyncControl);
            expect(finalResult.done).toBe(true);
            expect(finalResult.value).toEqual({ allowed: true });
        });

        it('should handle user denial response', async () => {
            vi.mocked(mockStore.isToolAllowed).mockResolvedValue(false);
            vi.mocked(mockStore.isToolDenied).mockResolvedValue(false);

            const generator = handleToolPermission(
                mockStore,
                'test_tool',
                'loose',
                {},
                'Test prompt'
            );

            // Skip to user response
            await generator.next();

            const userResponse = {
                id: 'response',
                content: 'response',
                type: 'user-choice',
                sender: 'user',
                timestamp: new Date(),
                metadata: {
                    choice: 2,
                    choices: [
                        { label: 'Allow', value: 'allow' },
                        { label: 'Always Allow', value: 'always_allow' },
                        { label: 'Deny', value: 'deny' },
                    ],
                },
            } as any;

            const asyncControl: AsyncControl = {
                type: 'continue',
                responseMessage: userResponse,
            };

            // Second iteration - pass through the duplicated yield
            await generator.next(asyncControl);

            // Third yield should handle the response
            const finalResult = await generator.next(asyncControl);
            expect(finalResult.done).toBe(true);
            expect(finalResult.value).toEqual({ allowed: false });
        });
    });
});
