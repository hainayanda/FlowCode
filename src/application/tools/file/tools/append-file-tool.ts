import * as fs from 'fs/promises';
import * as path from 'path';
import {
    AsyncControl,
    AsyncControlResponse,
} from '../../../../common/models/async-control';
import { generateAppendDiff } from '../../../../common/utils/diff-utils';
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

interface AppendFileParameter {
    filePath: string;
    content: string;
}

/**
 * Tool for appending content to files.
 *
 * Provides secure file appending within the workspace with permission management.
 * Creates files if they don't exist and generates detailed file operation messages.
 */
export class AppendFileTool implements Tool, ToolPromptSource {
    constructor() {}

    get definition(): ToolDefinition {
        return {
            name: 'append_file',
            description: 'Append text to end of file',
            parameters: {
                type: 'object',
                properties: {
                    filePath: {
                        type: 'string',
                        description: 'Path to the file',
                    },
                    content: {
                        type: 'string',
                        description: 'Content to append',
                    },
                },
                required: ['filePath', 'content'],
            },
            permission: 'loose',
        };
    }

    async *call(
        parameter: ToolCallParameter
    ): AsyncGenerator<Message, AsyncControlResponse, AsyncControl> {
        const { filePath, content } =
            parameter.parameters as AppendFileParameter;

        try {
            // Security check - prevent access outside current directory
            const resolvedPath = path.resolve(filePath);
            const workingDir = process.cwd();
            if (!resolvedPath.startsWith(workingDir)) {
                const errorMessage: ErrorMessage = {
                    id: generateUniqueId('error'),
                    content: `Access denied: Cannot write files outside workspace (${filePath})`,
                    type: 'error',
                    sender: 'append_file',
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

            // Check if file exists to determine permission message
            let fileExists = false;
            try {
                await fs.access(resolvedPath);
                fileExists = true;
            } catch {
                // File doesn't exist, will be created
            }

            // Read current file content to calculate line numbers for diff
            let originalLines: string[] = [];
            let startLineNumber = 1;

            if (fileExists) {
                const originalContent = await fs.readFile(
                    resolvedPath,
                    'utf-8'
                );
                originalLines = originalContent.split('\n');
                startLineNumber =
                    originalLines.length +
                    (originalContent.endsWith('\n') ? 0 : 1);
            }

            // Append content to file
            await fs.appendFile(resolvedPath, content, 'utf-8');

            // Generate contextual diff for metadata
            const contextualDiff = generateAppendDiff(
                originalLines,
                content,
                startLineNumber
            );

            const operation = fileExists
                ? 'appended to'
                : 'created and appended to';
            const contentLines = content.split('\n');
            const endLineNumber = startLineNumber + contentLines.length - 1;

            // Show context lines before the appended content
            const contextStart = Math.max(1, startLineNumber - 2);
            const contextEnd = startLineNumber - 1;
            const beforeLines = originalLines.slice(
                contextStart - 1,
                contextEnd
            );
            const beforeContent =
                beforeLines.length > 0 ? beforeLines.join('\n') : '';

            // Show the new content after appending
            const afterLines = originalLines.concat(contentLines);
            const afterContextLines = afterLines.slice(
                contextStart - 1,
                endLineNumber
            );
            const afterContent = afterContextLines.join('\n');

            const fileOperationMessage: FileOperationMessage = {
                id: generateUniqueId('file-operation'),
                content: `File: ${filePath}\nSuccessfully ${operation} - added content at line${contentLines.length === 1 ? '' : 's'} ${startLineNumber}${endLineNumber > startLineNumber ? `-${endLineNumber}` : ''}\n\nbefore:\n\`\`\`\n${beforeContent}\n\`\`\`\n\nafter:\n\`\`\`\n${afterContent}\n\`\`\``,
                type: 'file_operation',
                sender: 'append_file',
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
                usage: {
                    inputTokens: content.length,
                    outputTokens: 0,
                    toolsUsed: 1,
                },
            };
        } catch (error) {
            const errorMessage: ErrorMessage = {
                id: generateUniqueId('error'),
                content: `Failed to append to file: ${error instanceof Error ? error.message : String(error)}`,
                type: 'error',
                sender: 'append_file',
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
     * Generates a custom permission prompt for appending to files.
     * @param parameter - The tool call parameters for context
     * @returns A human-readable prompt asking for permission to append to the specific file
     */
    getPermissionPrompt(parameter: ToolCallParameter): string {
        const { filePath, content } =
            parameter.parameters as AppendFileParameter;

        const contentPreview =
            content.length > 50 ? content.substring(0, 50) + '...' : content;

        const lines = content.split('\n').length;
        const lineText = lines === 1 ? 'line' : 'lines';

        return `Allow agent to append ${lines} ${lineText} to file "${filePath}"? (Content: "${contentPreview}")`;
    }
}
