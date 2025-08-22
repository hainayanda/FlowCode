import {
    AsyncControl,
    AsyncControlResponse,
} from '../../common/models/async-control';
import { generateUniqueId } from '../../common/utils/id-generator';
import { SettingsStore } from '../stores/interfaces/settings-store';
import {
    ChoiceMessage,
    ErrorMessage,
    Message,
} from '../stores/models/messages';
import {
    Tool,
    ToolCallParameter,
    ToolDefinition,
    ToolPromptSource,
} from './interfaces/toolbox';

/**
 * A wrapper that adds permission checking to any tool.
 *
 * This wrapper implements the Tool interface and delegates to an underlying tool
 * after checking permissions based on the tool's permission level and user settings.
 *
 * Permission behavior:
 * - none: Execute immediately without checks
 * - loose: Check tool name in settings, ask for permission if not found
 * - strict: Check tool name + parameters in settings, ask for permission if not found
 * - always: Always ask for permission (allow/deny only, no "always" options)
 */
export class ToolWithPermission implements Tool {
    constructor(
        private underlyingTool: Tool,
        private settingsStore: SettingsStore
    ) {}

    get definition(): ToolDefinition {
        return this.underlyingTool.definition;
    }

    async *call(
        parameter: ToolCallParameter
    ): AsyncGenerator<Message, AsyncControlResponse, AsyncControl> {
        const permission = this.definition.permission;

        // Handle 'none' permission - execute immediately
        if (permission === 'none') {
            return yield* this.underlyingTool.call(parameter);
        }

        // Handle 'always' permission - always ask for permission
        if (permission === 'always') {
            const prompt = this.getPermissionPrompt(parameter);
            const choiceMessage =
                this.createAlwaysPermissionChoiceMessage(prompt);

            yield choiceMessage;
            const control: AsyncControl = yield choiceMessage;

            const allowed = this.handleAlwaysPermissionResponse(
                control.responseMessage
            );
            if (!allowed) {
                const errorMessage: ErrorMessage = {
                    id: generateUniqueId('error'),
                    content: 'Permission denied to execute tool',
                    type: 'error',
                    sender: this.definition.name,
                    timestamp: new Date(),
                    metadata: {
                        error: new Error('Permission denied'),
                    },
                };
                yield errorMessage;
                return {
                    messages: [errorMessage],
                    completedReason: 'completed',
                    usage: { inputTokens: 0, outputTokens: 0, toolsUsed: 1 },
                };
            }
            return yield* this.underlyingTool.call(parameter);
        }

        // Handle 'loose' and 'strict' permissions
        if (permission === 'loose' || permission === 'strict') {
            const permissionKey = this.generatePermissionKey(
                permission,
                parameter
            );

            // Check if tool is in allowed list
            const isAllowed =
                await this.settingsStore.isToolAllowed(permissionKey);
            if (isAllowed) {
                return yield* this.underlyingTool.call(parameter);
            }

            // Check if tool is in denied list
            const isDenied =
                await this.settingsStore.isToolDenied(permissionKey);
            if (isDenied) {
                const errorMessage: ErrorMessage = {
                    id: generateUniqueId('error'),
                    content: 'Permission denied to execute tool',
                    type: 'error',
                    sender: this.definition.name,
                    timestamp: new Date(),
                    metadata: {
                        error: new Error('Permission denied'),
                    },
                };
                yield errorMessage;
                return {
                    messages: [errorMessage],
                    completedReason: 'completed',
                    usage: { inputTokens: 0, outputTokens: 0, toolsUsed: 1 },
                };
            }

            // Not in settings, ask for permission
            const prompt = this.getPermissionPrompt(parameter);
            const choiceMessage =
                this.createStandardPermissionChoiceMessage(prompt);

            yield choiceMessage;
            const control: AsyncControl = yield choiceMessage;

            const allowed = await this.handleStandardPermissionResponse(
                control.responseMessage,
                permission,
                parameter
            );

            if (!allowed) {
                const errorMessage: ErrorMessage = {
                    id: generateUniqueId('error'),
                    content: 'Permission denied to execute tool',
                    type: 'error',
                    sender: this.definition.name,
                    timestamp: new Date(),
                    metadata: {
                        error: new Error('Permission denied'),
                    },
                };
                yield errorMessage;
                return {
                    messages: [errorMessage],
                    completedReason: 'completed',
                    usage: { inputTokens: 0, outputTokens: 0, toolsUsed: 1 },
                };
            }

            return yield* this.underlyingTool.call(parameter);
        }

        // Unknown permission level - deny by default
        const errorMessage: ErrorMessage = {
            id: generateUniqueId('error'),
            content: `Unknown permission level: ${permission}`,
            type: 'error',
            sender: this.definition.name,
            timestamp: new Date(),
            metadata: {
                error: new Error(`Unknown permission level: ${permission}`),
            },
        };
        yield errorMessage;
        return {
            messages: [errorMessage],
            completedReason: 'completed',
            usage: { inputTokens: 0, outputTokens: 0, toolsUsed: 1 },
        };
    }

    /**
     * Generates permission key for settings storage.
     * For loose: returns tool name only
     * For strict: returns tool name + parameters
     */
    private generatePermissionKey(
        permission: 'loose' | 'strict',
        parameter: ToolCallParameter
    ): string {
        if (permission === 'strict') {
            // Create object with sorted keys to ensure consistent string representation
            const sortedParams = Object.keys(parameter.parameters)
                .sort()
                .reduce((obj: Record<string, any>, key: string) => {
                    obj[key] = parameter.parameters[key];
                    return obj;
                }, {});
            const paramString = JSON.stringify(sortedParams);
            return `${this.definition.name}(${paramString})`;
        }
        return this.definition.name;
    }

    /**
     * Handles user response for standard permissions (loose/strict) and updates settings if needed.
     */
    private async handleStandardPermissionResponse(
        responseMessage: Message | undefined,
        permission: 'loose' | 'strict',
        parameter: ToolCallParameter
    ): Promise<boolean> {
        if (!responseMessage || responseMessage.type !== 'user-choice') {
            return false;
        }

        const choiceMessage = responseMessage as any;
        const choice =
            choiceMessage.metadata?.choices?.[choiceMessage.metadata?.choice]
                ?.value;

        if (!choice) {
            return false;
        }

        const permissionKey = this.generatePermissionKey(permission, parameter);

        switch (choice) {
            case 'allow':
                return true;
            case 'always_allow':
                await this.settingsStore.addAllowedTool(permissionKey);
                return true;
            case 'deny':
                return false;
            case 'always_deny':
                await this.settingsStore.addDeniedTool(permissionKey);
                return false;
            default:
                return false;
        }
    }

    /**
     * Gets the permission prompt, either from the tool if it implements ToolPromptSource,
     * or a generic prompt.
     */
    private getPermissionPrompt(parameter: ToolCallParameter): string {
        if (this.implementsToolPromptSource(this.underlyingTool)) {
            return this.underlyingTool.getPermissionPrompt(parameter);
        }

        return `Allow agent to execute ${this.definition.name}?`;
    }

    /**
     * Type guard to check if the underlying tool implements ToolPromptSource.
     */
    private implementsToolPromptSource(
        tool: Tool
    ): tool is Tool & ToolPromptSource {
        return typeof (tool as any).getPermissionPrompt === 'function';
    }

    /**
     * Creates a choice message for 'always' permission (allow/deny only).
     */
    private createAlwaysPermissionChoiceMessage(prompt: string): ChoiceMessage {
        return {
            id: generateUniqueId('permission-choice'),
            content: `Asking user for choices:\\n${prompt}\\n- Allow (allow)\\n- Deny (deny)`,
            type: 'choice',
            sender: this.definition.name,
            timestamp: new Date(),
            metadata: {
                prompt,
                choices: [
                    { label: 'Allow', value: 'allow' },
                    { label: 'Deny', value: 'deny' },
                ],
            },
        };
    }

    /**
     * Creates a choice message for standard permissions (allow/always allow/deny/always deny).
     */
    private createStandardPermissionChoiceMessage(
        prompt: string
    ): ChoiceMessage {
        return {
            id: generateUniqueId('permission-choice'),
            content: `Asking user for choices:\\n${prompt}\\n- Allow (allow)\\n- Always Allow (always_allow)\\n- Deny (deny)\\n- Always Deny (always_deny)`,
            type: 'choice',
            sender: this.definition.name,
            timestamp: new Date(),
            metadata: {
                prompt,
                choices: [
                    { label: 'Allow', value: 'allow' },
                    { label: 'Always Allow', value: 'always_allow' },
                    { label: 'Deny', value: 'deny' },
                    { label: 'Always Deny', value: 'always_deny' },
                ],
            },
        };
    }

    /**
     * Handles user response for 'always' permission (no settings storage).
     */
    private handleAlwaysPermissionResponse(
        responseMessage: Message | undefined
    ): boolean {
        if (!responseMessage || responseMessage.type !== 'user-choice') {
            return false;
        }

        const choiceMessage = responseMessage as any;
        const choice =
            choiceMessage.metadata?.choices?.[choiceMessage.metadata?.choice]
                ?.value;

        return choice === 'allow';
    }
}
