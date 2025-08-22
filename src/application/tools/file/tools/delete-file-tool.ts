import * as fs from 'fs/promises';
import * as path from 'path';
import {
    AsyncControl,
    AsyncControlResponse,
} from '../../../../common/models/async-control';
import { generateDeleteDiff } from '../../../../common/utils/diff-utils';
import { generateUniqueId } from '../../../../common/utils/id-generator';
import {
    ErrorMessage,
    FileOperationMessage,
    Message,
} from '../../../stores/models/messages';
import {
    Tool,
    ToolCallParameter,
    ToolDefinition,
    ToolPromptSource,
} from '../../interfaces/toolbox';

interface DeleteFileParameter {
    filePath: string;
    lineNumber: number;
}

/**
 * Tool for deleting specific lines from files.
 *
 * Provides secure line deletion within the workspace with permission management.
 * Uses 1-based line numbering and generates detailed file operation messages.
 */
export class DeleteFileTool implements Tool, ToolPromptSource {
    constructor() {}

    get definition(): ToolDefinition {
        return {
            name: 'delete_at_line',
            description: 'Delete text at specific line number',
            parameters: {
                type: 'object',
                properties: {
                    filePath: {
                        type: 'string',
                        description: 'Path to the file',
                    },
                    lineNumber: {
                        type: 'number',
                        description: 'Line number to delete (1-based)',
                    },
                },
                required: ['filePath', 'lineNumber'],
            },
            permission: 'loose',
        };
    }

    async *call(
        parameter: ToolCallParameter
    ): AsyncGenerator<Message, AsyncControlResponse, AsyncControl> {
        const { filePath, lineNumber } =
            parameter.parameters as DeleteFileParameter;

        try {
            // Validate line number
            if (lineNumber < 1) {
                const errorMessage: ErrorMessage = {
                    id: generateUniqueId('error'),
                    content: 'Line number must be 1 or greater',
                    type: 'error',
                    sender: 'delete_at_line',
                    timestamp: new Date(),
                    metadata: {
                        error: new Error('Invalid line number'),
                    },
                };
                yield errorMessage;
                return {
                    messages: [errorMessage],
                    completedReason: 'completed',
                    usage: { inputTokens: 0, outputTokens: 0, toolsUsed: 1 },
                };
            }

            // Security check - prevent access outside current directory
            const resolvedPath = path.resolve(filePath);
            const workingDir = process.cwd();
            if (!resolvedPath.startsWith(workingDir)) {
                const errorMessage: ErrorMessage = {
                    id: generateUniqueId('error'),
                    content: `Access denied: Cannot modify files outside workspace (${filePath})`,
                    type: 'error',
                    sender: 'delete_at_line',
                    timestamp: new Date(),
                    metadata: {
                        error: new Error(
                            'Access denied: File outside workspace'
                        ),
                    },
                };
                yield errorMessage;
                return {
                    messages: [errorMessage],
                    completedReason: 'completed',
                    usage: { inputTokens: 0, outputTokens: 0, toolsUsed: 1 },
                };
            }

            // Check if file exists
            try {
                await fs.access(resolvedPath);
            } catch {
                const errorMessage: ErrorMessage = {
                    id: generateUniqueId('error'),
                    content: `File not found: ${filePath}`,
                    type: 'error',
                    sender: 'delete_at_line',
                    timestamp: new Date(),
                    metadata: {
                        error: new Error('File not found'),
                    },
                };
                yield errorMessage;
                return {
                    messages: [errorMessage],
                    completedReason: 'completed',
                    usage: { inputTokens: 0, outputTokens: 0, toolsUsed: 1 },
                };
            }

            // Read file content
            const fileContent = await fs.readFile(resolvedPath, 'utf-8');
            const lines = fileContent.split('\n');

            // Check if line number exists
            if (lineNumber > lines.length) {
                const errorMessage: ErrorMessage = {
                    id: generateUniqueId('error'),
                    content: `Line number ${lineNumber} exceeds file length (${lines.length} lines)`,
                    type: 'error',
                    sender: 'delete_at_line',
                    timestamp: new Date(),
                    metadata: {
                        error: new Error('Line number out of range'),
                    },
                };
                yield errorMessage;
                return {
                    messages: [errorMessage],
                    completedReason: 'completed',
                    usage: { inputTokens: 0, outputTokens: 0, toolsUsed: 1 },
                };
            }

            // Remove the line
            const modifiedLines = lines.filter(
                (_, index) => index !== lineNumber - 1
            );
            const newContent = modifiedLines.join('\n');

            // Write the modified content back to file
            await fs.writeFile(resolvedPath, newContent, 'utf-8');

            // Generate contextual diff for metadata
            const contextualDiff = generateDeleteDiff(lines, lineNumber);

            // Show context before deletion
            const contextStart = Math.max(1, lineNumber - 2);
            const contextEnd = Math.min(lines.length, lineNumber + 2);
            const beforeLines = lines.slice(contextStart - 1, contextEnd);
            const beforeContent = beforeLines.join('\n');

            // Show context after deletion
            const afterLines = modifiedLines.slice(
                contextStart - 1,
                Math.min(modifiedLines.length, contextEnd - 1)
            );
            const afterContent = afterLines.join('\n');

            const fileOperationMessage: FileOperationMessage = {
                id: generateUniqueId('file-operation'),
                content: `File: ${filePath}\nSuccessfully deleted line ${lineNumber}\n\nbefore:\n\`\`\`\n${beforeContent}\n\`\`\`\n\nafter:\n\`\`\`\n${afterContent}\n\`\`\``,
                type: 'file_operation',
                sender: 'delete_at_line',
                timestamp: new Date(),
                metadata: {
                    filePath: resolvedPath,
                    diffs: contextualDiff.lines,
                },
            };

            yield fileOperationMessage;
            return {
                messages: [fileOperationMessage],
                completedReason: 'completed',
                usage: { inputTokens: 0, outputTokens: 0, toolsUsed: 1 },
            };
        } catch (error) {
            const errorMessage: ErrorMessage = {
                id: generateUniqueId('error'),
                content: `Failed to delete line from file: ${error instanceof Error ? error.message : String(error)}`,
                type: 'error',
                sender: 'delete_at_line',
                timestamp: new Date(),
                metadata: {
                    error:
                        error instanceof Error
                            ? error
                            : new Error(String(error)),
                },
            };
            yield errorMessage;
            return {
                messages: [errorMessage],
                completedReason: 'completed',
                usage: { inputTokens: 0, outputTokens: 0, toolsUsed: 1 },
            };
        }
    }

    /**
     * Generates a custom permission prompt for deleting lines from files.
     * @param parameter - The tool call parameters for context
     * @returns A human-readable prompt asking for permission to delete the specific line
     */
    getPermissionPrompt(parameter: ToolCallParameter): string {
        const { filePath, lineNumber } =
            parameter.parameters as DeleteFileParameter;

        return `Allow agent to delete line ${lineNumber} from file "${filePath}"?`;
    }
}
