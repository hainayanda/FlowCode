import { SettingsStore } from '../../application/stores/interfaces/settings-store';
import {
    ChoiceMessage,
    Message,
} from '../../application/stores/models/messages';
import { AsyncControl } from '../models/async-control';
import { generateUniqueId } from './id-generator';

/**
 * Generates permission key for settings storage
 */
export function generatePermissionKey(
    toolName: string,
    permission: 'loose' | 'strict',
    parameters?: Record<string, any>
): string {
    if (permission === 'strict' && parameters) {
        // Create object with sorted keys to ensure consistent string representation
        const sortedParams = Object.keys(parameters)
            .sort()
            .reduce((obj: Record<string, any>, key: string) => {
                obj[key] = parameters[key];
                return obj;
            }, {});
        const paramString = JSON.stringify(sortedParams);
        return `${toolName}(${paramString})`;
    }
    return toolName;
}

/**
 * Checks if a tool action is permitted based on settings and permission level
 */
export async function checkPermission(
    settingsStore: SettingsStore,
    toolName: string,
    permission: 'loose' | 'strict',
    parameters: Record<string, any>
): Promise<{ allowed: boolean; needsUserInput?: boolean }> {
    const permissionKey = generatePermissionKey(
        toolName,
        permission,
        parameters
    );

    const [isAllowed, isDenied] = await Promise.all([
        settingsStore.isToolAllowed(permissionKey),
        settingsStore.isToolDenied(permissionKey),
    ]);

    if (isAllowed) {
        return { allowed: true };
    }

    if (isDenied) {
        return { allowed: false };
    }

    // Not in settings, need user input
    return { allowed: false, needsUserInput: true };
}

/**
 * Creates a choice message to request user permission
 */
export function createPermissionChoiceMessage(prompt: string): ChoiceMessage {
    const finalPrompt = prompt;

    return {
        id: generateUniqueId('permission-choice'),
        content: `Asking user for choices:\\n${finalPrompt}\\n- Allow (allow)\\n- Always Allow (always_allow)\\n- Deny (deny)\\n- Always Deny (always_deny)`,
        type: 'choice',
        sender: 'workspace-tool',
        timestamp: new Date(),
        metadata: {
            prompt: finalPrompt,
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
 * Handles permission response from user and updates settings if needed
 */
export async function handlePermissionResponse(
    settingsStore: SettingsStore,
    responseMessage: Message | undefined,
    toolName: string,
    permission: 'loose' | 'strict',
    parameters: Record<string, any>
): Promise<boolean> {
    if (!responseMessage || responseMessage.type !== 'user-choice') {
        // No response or wrong type, consider as deny
        return false;
    }

    const choiceMessage = responseMessage as any; // Type assertion for user-choice
    const choice =
        choiceMessage.metadata?.choices?.[choiceMessage.metadata?.choice]
            ?.value;

    if (!choice) {
        return false;
    }

    const permissionKey = generatePermissionKey(
        toolName,
        permission,
        parameters
    );

    switch (choice) {
        case 'allow':
            return true;
        case 'always_allow':
            await settingsStore.addAllowedTool(permissionKey);
            return true;
        case 'deny':
            return false;
        case 'always_deny':
            await settingsStore.addDeniedTool(permissionKey);
            return false;
        default:
            return false;
    }
}

/**
 * Checks and handles tool permissions, returning whether execution should proceed
 */
export async function* handleToolPermission(
    settingsStore: SettingsStore,
    toolName: string,
    permission: 'none' | 'loose' | 'strict',
    parameters: Record<string, any>,
    prompt: string
): AsyncGenerator<Message, { allowed: boolean }, AsyncControl> {
    if (permission === 'none') {
        return { allowed: true };
    }

    const permissionCheck = await checkPermission(
        settingsStore,
        toolName,
        permission,
        parameters
    );

    if (permissionCheck.allowed) {
        return { allowed: true };
    }

    if (!permissionCheck.needsUserInput) {
        // Tool is explicitly denied
        return { allowed: false };
    }

    // Need to ask user for permission
    const choiceMessage = createPermissionChoiceMessage(prompt);
    yield choiceMessage;

    const control: AsyncControl = yield choiceMessage;
    const allowed = await handlePermissionResponse(
        settingsStore,
        control.responseMessage,
        toolName,
        permission,
        parameters
    );

    return { allowed };
}
