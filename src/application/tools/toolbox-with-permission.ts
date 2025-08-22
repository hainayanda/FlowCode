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
    PermissionLevel,
    Toolbox,
    ToolboxPromptSource,
    ToolCallParameter,
    ToolDefinition,
} from './interfaces/toolbox';

/**
 * Permission group for organizing tools by their permission requirements.
 */
interface PermissionGroup {
    permission: PermissionLevel;
    tools: ToolCallParameter[];
    needsPermission: ToolCallParameter[];
}

/**
 * A wrapper that adds permission checking to any toolbox.
 *
 * This wrapper implements the Toolbox interface and delegates to an underlying toolbox
 * after checking permissions. It provides sophisticated batch permission handling:
 * - loose: Batched together for group permission requests
 * - strict/always: Individual permission requests
 * - none: Execute immediately without checks
 */
export class ToolboxWithPermission implements Toolbox {
    constructor(
        private underlyingToolbox: Toolbox,
        private settingsStore: SettingsStore
    ) {}

    get tools(): ToolDefinition[] {
        return this.underlyingToolbox.tools;
    }

    /**
     * Executes a single tool with permission checking.
     * Delegates to the underlying toolbox after checking permissions.
     */
    async *callTool(
        parameter: ToolCallParameter
    ): AsyncGenerator<Message, AsyncControlResponse, AsyncControl> {
        const toolDefinition = this.tools.find(
            (t) => t.name === parameter.name
        );
        if (!toolDefinition) {
            const errorMessage: ErrorMessage = {
                id: generateUniqueId('error'),
                content: `Unknown tool: ${parameter.name}`,
                type: 'error',
                sender: 'toolbox-with-permission',
                timestamp: new Date(),
                metadata: {
                    error: new Error(`Tool not found: ${parameter.name}`),
                },
            };
            yield errorMessage;
            return {
                messages: [errorMessage],
                completedReason: 'completed',
                usage: { inputTokens: 0, outputTokens: 0, toolsUsed: 1 },
            };
        }

        const permission = toolDefinition.permission;

        // Handle 'none' permission - execute immediately
        if (permission === 'none') {
            return yield* this.underlyingToolbox.callTool(parameter);
        }

        // Handle other permissions using the batch logic for consistency
        return yield* this.callTools([parameter]);
    }

    /**
     * Executes multiple tools with sophisticated batch permission handling.
     */
    async *callTools(
        parameters: ToolCallParameter[]
    ): AsyncGenerator<Message, AsyncControlResponse, AsyncControl> {
        if (parameters.length === 0) {
            return {
                messages: [],
                completedReason: 'completed',
                usage: { inputTokens: 0, outputTokens: 0, toolsUsed: 0 },
            };
        }

        // Group tools by permission requirements
        const permissionGroups = await this.groupToolsByPermission(parameters);

        const allMessages: Message[] = [];
        let totalUsage = { inputTokens: 0, outputTokens: 0, toolsUsed: 0 };

        // Execute tools with no permission requirements immediately
        const noneGroup = permissionGroups.find((g) => g.permission === 'none');
        if (noneGroup) {
            for (const param of noneGroup.tools) {
                const result = yield* this.underlyingToolbox.callTool(param);
                allMessages.push(...result.messages);
                totalUsage.inputTokens += result.usage.inputTokens;
                totalUsage.outputTokens += result.usage.outputTokens;
                totalUsage.toolsUsed += result.usage.toolsUsed;
            }
        }

        // Handle loose permission tools as a batch
        const looseGroup = permissionGroups.find(
            (g) => g.permission === 'loose'
        );
        if (looseGroup && looseGroup.needsPermission.length > 0) {
            // Ask batch permission for loose tools
            const prompt = this.getBatchLoosePermissionPrompt(
                looseGroup.needsPermission
            );
            const choiceMessage =
                this.createBatchPermissionChoiceMessage(prompt);

            yield choiceMessage;
            const control: AsyncControl = yield choiceMessage;

            const choice = this.extractChoice(control.responseMessage);
            const allowed = choice === 'allow' || choice === 'always_allow';

            // Write to settings if always allow/deny
            if (choice === 'always_allow' || choice === 'always_deny') {
                await this.writeBatchLoosePermissions(
                    looseGroup.needsPermission,
                    choice === 'always_allow'
                );
            }

            if (allowed) {
                // Execute all loose tools (both needsPermission and pre-approved)
                for (const param of looseGroup.tools) {
                    const result =
                        yield* this.underlyingToolbox.callTool(param);
                    allMessages.push(...result.messages);
                    totalUsage.inputTokens += result.usage.inputTokens;
                    totalUsage.outputTokens += result.usage.outputTokens;
                    totalUsage.toolsUsed += result.usage.toolsUsed;
                }
            } else {
                // Execute pre-approved loose tools only
                const preApproved = looseGroup.tools.filter(
                    (tool) => !looseGroup.needsPermission.includes(tool)
                );
                for (const param of preApproved) {
                    const result =
                        yield* this.underlyingToolbox.callTool(param);
                    allMessages.push(...result.messages);
                    totalUsage.inputTokens += result.usage.inputTokens;
                    totalUsage.outputTokens += result.usage.outputTokens;
                    totalUsage.toolsUsed += result.usage.toolsUsed;
                }

                // Generate errors for denied loose tools
                for (const param of looseGroup.needsPermission) {
                    const errorMessage: ErrorMessage = {
                        id: generateUniqueId('error'),
                        content: `Permission denied to execute ${param.name}`,
                        type: 'error',
                        sender: 'toolbox-with-permission',
                        timestamp: new Date(),
                        metadata: {
                            error: new Error('Permission denied'),
                        },
                    };
                    allMessages.push(errorMessage);
                    totalUsage.toolsUsed += 1;
                }
            }
        } else if (looseGroup) {
            // All loose tools are pre-approved, execute them
            for (const param of looseGroup.tools) {
                const result = yield* this.underlyingToolbox.callTool(param);
                allMessages.push(...result.messages);
                totalUsage.inputTokens += result.usage.inputTokens;
                totalUsage.outputTokens += result.usage.outputTokens;
                totalUsage.toolsUsed += result.usage.toolsUsed;
            }
        }

        // Handle strict and always permission tools individually
        const strictGroup = permissionGroups.find(
            (g) => g.permission === 'strict'
        );
        const alwaysGroup = permissionGroups.find(
            (g) => g.permission === 'always'
        );

        const individualTools = [
            ...(strictGroup?.needsPermission || []),
            ...(alwaysGroup?.needsPermission || []),
        ];

        for (const param of individualTools) {
            const toolDefinition = this.tools.find(
                (t) => t.name === param.name
            )!;

            // Ask individual permission
            const prompt = this.getIndividualPermissionPrompt(param);
            const choiceMessage =
                toolDefinition.permission === 'always'
                    ? this.createAlwaysPermissionChoiceMessage(prompt)
                    : this.createStandardPermissionChoiceMessage(prompt);

            yield choiceMessage;
            const control: AsyncControl = yield choiceMessage;

            const choice = this.extractChoice(control.responseMessage);
            const allowed = choice === 'allow' || choice === 'always_allow';

            // Write to settings for strict permission
            if (
                toolDefinition.permission === 'strict' &&
                (choice === 'always_allow' || choice === 'always_deny')
            ) {
                const permissionKey = this.generatePermissionKey(
                    'strict',
                    param
                );
                if (choice === 'always_allow') {
                    await this.settingsStore.addAllowedTool(permissionKey);
                } else {
                    await this.settingsStore.addDeniedTool(permissionKey);
                }
            }

            if (allowed) {
                const result = yield* this.underlyingToolbox.callTool(param);
                allMessages.push(...result.messages);
                totalUsage.inputTokens += result.usage.inputTokens;
                totalUsage.outputTokens += result.usage.outputTokens;
                totalUsage.toolsUsed += result.usage.toolsUsed;
            } else {
                const errorMessage: ErrorMessage = {
                    id: generateUniqueId('error'),
                    content: `Permission denied to execute ${param.name}`,
                    type: 'error',
                    sender: 'toolbox-with-permission',
                    timestamp: new Date(),
                    metadata: {
                        error: new Error('Permission denied'),
                    },
                };
                allMessages.push(errorMessage);
                totalUsage.toolsUsed += 1;
            }
        }

        // Execute pre-approved strict tools
        const preApprovedStrict =
            strictGroup?.tools.filter(
                (tool) => !strictGroup.needsPermission.includes(tool)
            ) || [];

        for (const param of preApprovedStrict) {
            const result = yield* this.underlyingToolbox.callTool(param);
            allMessages.push(...result.messages);
            totalUsage.inputTokens += result.usage.inputTokens;
            totalUsage.outputTokens += result.usage.outputTokens;
            totalUsage.toolsUsed += result.usage.toolsUsed;
        }

        return {
            messages: allMessages,
            completedReason: 'completed',
            usage: totalUsage,
        };
    }

    /**
     * Groups tools by their permission requirements and checks settings.
     */
    private async groupToolsByPermission(
        parameters: ToolCallParameter[]
    ): Promise<PermissionGroup[]> {
        const groups: Map<PermissionLevel, PermissionGroup> = new Map();

        for (const param of parameters) {
            const toolDefinition = this.tools.find(
                (t) => t.name === param.name
            );
            if (!toolDefinition) continue;

            const permission = toolDefinition.permission;

            if (!groups.has(permission)) {
                groups.set(permission, {
                    permission,
                    tools: [],
                    needsPermission: [],
                });
            }

            const group = groups.get(permission)!;
            group.tools.push(param);

            // Check if tool needs permission (not in settings or always permission)
            if (permission === 'always') {
                group.needsPermission.push(param);
            } else if (permission === 'loose' || permission === 'strict') {
                const permissionKey = this.generatePermissionKey(
                    permission,
                    param
                );
                const [isAllowed, isDenied] = await Promise.all([
                    this.settingsStore.isToolAllowed(permissionKey),
                    this.settingsStore.isToolDenied(permissionKey),
                ]);

                if (!isAllowed && !isDenied) {
                    group.needsPermission.push(param);
                }
            }
        }

        return Array.from(groups.values());
    }

    // Helper methods for permission key generation, prompts, choice messages, etc.
    private generatePermissionKey(
        permission: 'loose' | 'strict',
        parameter: ToolCallParameter
    ): string {
        if (permission === 'strict') {
            const sortedParams = Object.keys(parameter.parameters)
                .sort()
                .reduce((obj: Record<string, any>, key: string) => {
                    obj[key] = parameter.parameters[key];
                    return obj;
                }, {});
            const paramString = JSON.stringify(sortedParams);
            return `${parameter.name}(${paramString})`;
        }
        return parameter.name;
    }

    private getBatchLoosePermissionPrompt(
        parameters: ToolCallParameter[]
    ): string {
        if (this.implementsToolboxPromptSource(this.underlyingToolbox)) {
            return this.underlyingToolbox.getBatchLoosePermissionPrompt(
                parameters
            );
        }

        const toolNames = parameters.map((p) => p.name).join(', ');
        return `Allow agent to execute these tools: ${toolNames}`;
    }

    private getIndividualPermissionPrompt(
        parameter: ToolCallParameter
    ): string {
        if (this.implementsToolboxPromptSource(this.underlyingToolbox)) {
            return this.underlyingToolbox.getPermissionPrompt(parameter);
        }

        return `Allow agent to execute ${parameter.name}?`;
    }

    private implementsToolboxPromptSource(
        toolbox: Toolbox
    ): toolbox is Toolbox & ToolboxPromptSource {
        return (
            typeof (toolbox as any).getBatchLoosePermissionPrompt ===
                'function' &&
            typeof (toolbox as any).getPermissionPrompt === 'function'
        );
    }

    private createBatchPermissionChoiceMessage(prompt: string): ChoiceMessage {
        return {
            id: generateUniqueId('permission-choice'),
            content: `Asking user for choices:\\n${prompt}\\n- Allow (allow)\\n- Always Allow (always_allow)\\n- Deny (deny)\\n- Always Deny (always_deny)`,
            type: 'choice',
            sender: 'toolbox-with-permission',
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

    private createStandardPermissionChoiceMessage(
        prompt: string
    ): ChoiceMessage {
        return {
            id: generateUniqueId('permission-choice'),
            content: `Asking user for choices:\\n${prompt}\\n- Allow (allow)\\n- Always Allow (always_allow)\\n- Deny (deny)\\n- Always Deny (always_deny)`,
            type: 'choice',
            sender: 'toolbox-with-permission',
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

    private createAlwaysPermissionChoiceMessage(prompt: string): ChoiceMessage {
        return {
            id: generateUniqueId('permission-choice'),
            content: `Asking user for choices:\\n${prompt}\\n- Allow (allow)\\n- Deny (deny)`,
            type: 'choice',
            sender: 'toolbox-with-permission',
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

    private extractChoice(responseMessage: Message | undefined): string {
        if (!responseMessage || responseMessage.type !== 'user-choice') {
            return 'deny';
        }

        const choiceMessage = responseMessage as any;
        return (
            choiceMessage.metadata?.choices?.[choiceMessage.metadata?.choice]
                ?.value || 'deny'
        );
    }

    private async writeBatchLoosePermissions(
        parameters: ToolCallParameter[],
        allowed: boolean
    ): Promise<void> {
        for (const param of parameters) {
            const permissionKey = this.generatePermissionKey('loose', param);
            if (allowed) {
                await this.settingsStore.addAllowedTool(permissionKey);
            } else {
                await this.settingsStore.addDeniedTool(permissionKey);
            }
        }
    }
}
