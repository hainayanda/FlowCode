import { generateUniqueId } from '../../../utils/id-generator';
import { handleToolPermission } from '../../../utils/permission-utils';
import { SettingsStore } from '../../interfaces/settings-store';
import {
    Toolbox,
    ToolCallParameter,
    ToolDefinition,
} from '../../interfaces/toolbox';
import { AsyncControl, AsyncControlResponse } from '../../models/async-control';
import { Message } from '../../models/messages';
import { WorkspaceToolboxDelegate } from './workspace-toolbox-delegate';

/**
 * Toolbox for workspace and filesystem operations.
 *
 * Provides a complete set of file and directory manipulation tools with permission management.
 * Handles creation, listing, and existence checking of files and directories in the workspace.
 */
export class WorkspaceToolbox implements Toolbox {
    /**
     * Creates a new WorkspaceToolbox instance.
     *
     * @param settingsStore - Store for accessing user settings and permissions
     * @param delegate - Implementation of workspace operations
     */
    constructor(
        private readonly settingsStore: SettingsStore,
        private readonly delegate: WorkspaceToolboxDelegate
    ) {}

    /**
     * Gets the available workspace tools with their definitions.
     *
     * @returns Array of tool definitions including parameters, permissions, and descriptions
     */
    get tools(): ToolDefinition[] {
        return [
            {
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
            },
            {
                name: 'workspace_path',
                description: 'Get current working directory',
                parameters: {
                    type: 'object',
                    properties: {},
                    required: [],
                },
                permission: 'none',
            },
            {
                name: 'create_file',
                description: 'Create new file with optional content',
                parameters: {
                    type: 'object',
                    properties: {
                        filePath: {
                            type: 'string',
                            description: 'File path to create',
                        },
                        content: {
                            type: 'string',
                            description: 'Initial file content',
                            default: '',
                        },
                    },
                    required: ['filePath'],
                },
                permission: 'loose',
            },
            {
                name: 'create_directory',
                description: 'Create new directory',
                parameters: {
                    type: 'object',
                    properties: {
                        directoryPath: {
                            type: 'string',
                            description: 'Directory path to create',
                        },
                        recursive: {
                            type: 'boolean',
                            description: 'Create parent directories if needed',
                            default: false,
                        },
                    },
                    required: ['directoryPath'],
                },
                permission: 'loose',
            },
            {
                name: 'exists',
                description: 'Check if file or directory exists',
                parameters: {
                    type: 'object',
                    properties: {
                        path: {
                            type: 'string',
                            description: 'Path to check',
                        },
                    },
                    required: ['path'],
                },
                permission: 'none',
            },
        ];
    }

    /**
     * Executes a workspace tool with the provided parameters.
     *
     * @param parameter - Tool call parameters including name and arguments
     * @returns AsyncGenerator yielding messages and returning execution response
     * @throws Yields error messages for unknown tools or permission denials
     */
    async *callTool(
        parameter: ToolCallParameter
    ): AsyncGenerator<Message, AsyncControlResponse, AsyncControl> {
        switch (parameter.name) {
            case 'list_directory':
                return yield* this.executeWithPermission(
                    'list_directory',
                    'none',
                    parameter.parameters,
                    () => this.delegate.listDirectory(parameter.parameters)
                );
            case 'workspace_path':
                return yield* this.executeWithPermission(
                    'workspace_path',
                    'none',
                    parameter.parameters,
                    () => this.delegate.workspacePath(parameter.parameters)
                );
            case 'create_file': {
                const fileContent = parameter.parameters['content']
                    ? ` with content`
                    : ' (empty)';
                const prompt = `Allow agent to create a file at '${parameter.parameters['filePath']}'${fileContent}?`;
                return yield* this.executeWithPermission(
                    'create_file',
                    'loose',
                    parameter.parameters,
                    () => this.delegate.createFile(parameter.parameters),
                    prompt
                );
            }
            case 'create_directory': {
                const recursive = parameter.parameters['recursive']
                    ? ' recursively'
                    : '';
                const prompt = `Allow agent to create a directory at '${parameter.parameters['directoryPath']}'${recursive}?`;
                return yield* this.executeWithPermission(
                    'create_directory',
                    'loose',
                    parameter.parameters,
                    () => this.delegate.createDirectory(parameter.parameters),
                    prompt
                );
            }
            case 'exists':
                return yield* this.executeWithPermission(
                    'exists',
                    'none',
                    parameter.parameters,
                    () => this.delegate.exists(parameter.parameters)
                );
            default:
                return yield* this.delegate.respondsWithNoToolsError(
                    parameter.parameters
                );
        }
    }

    /**
     * Creates context-specific prompts for different tools.
     *
     * @param toolName - Name of the tool being executed
     * @param parameters - Parameters being passed to the tool
     * @returns Human-readable permission prompt describing the operation
     */
    private createSpecificPrompt(
        toolName: string,
        parameters: Record<string, any>
    ): string {
        switch (toolName) {
            case 'create_file': {
                const fileContent = parameters['content']
                    ? ` with content`
                    : ' (empty)';
                return `Allow agent to create a file at '${parameters['filePath']}'${fileContent}?`;
            }
            case 'create_directory': {
                const recursive = parameters['recursive'] ? ' recursively' : '';
                return `Allow agent to create a directory at '${parameters['directoryPath']}'${recursive}?`;
            }
            default:
                return `Allow tool '${toolName}' to execute with parameters: ${JSON.stringify(parameters)}?`;
        }
    }

    /**
     * Executes a tool method with permission checking.
     *
     * @param toolName - Name of the tool being executed
     * @param permission - Permission level required for the tool
     * @param parameters - Parameters to pass to the tool
     * @param toolMethod - The actual tool implementation to execute
     * @param customPrompt - Optional custom permission prompt
     * @returns AsyncGenerator yielding messages and returning execution response
     */
    private async *executeWithPermission(
        toolName: string,
        permission: 'none' | 'loose' | 'strict',
        parameters: Record<string, any>,
        toolMethod: () => AsyncGenerator<
            Message,
            AsyncControlResponse,
            AsyncControl
        >,
        customPrompt?: string
    ): AsyncGenerator<Message, AsyncControlResponse, AsyncControl> {
        const prompt =
            customPrompt || this.createSpecificPrompt(toolName, parameters);
        const permissionResult = yield* handleToolPermission(
            this.settingsStore,
            toolName,
            permission,
            parameters,
            prompt
        );

        if (!permissionResult.allowed) {
            const deniedMessage = {
                id: generateUniqueId('permission-denied'),
                content: `Permission denied for tool '${toolName}'`,
                type: 'error' as const,
                sender: 'workspace-tool',
                timestamp: new Date(),
                metadata: {
                    error: new Error('Tool execution not permitted'),
                },
            };

            yield deniedMessage;

            return {
                messages: [deniedMessage],
                completedReason: 'completed',
                usage: { inputTokens: 0, outputTokens: 0, toolsUsed: 0 },
            };
        }

        return yield* toolMethod();
    }
}
