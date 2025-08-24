import * as fs from 'fs/promises';
import * as path from 'path';
import {
    AsyncControl,
    AsyncControlResponse,
} from '../../../../common/models/async-control';
import { generateInsertDiff } from '../../../../common/utils/diff-utils';
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

interface InsertFileParameter {
    filePath: string;
    lineNumber: number;
    content: string;
}

/**
 * Tool for inserting content at specific line numbers in files.
 *
 * Provides secure line insertion within the workspace with permission management.
 * Uses 1-based line numbering and creates files if they don't exist.
 */
export class InsertFileTool implements Tool, ToolPromptSource {
    constructor() {}

    get definition(): ToolDefinition {
        return {
            name: 'insert_at_line',
            description: 'Insert text at specific line number',
            parameters: {
                type: 'object',
                properties: {
                    filePath: {
                        type: 'string',
                        description: 'Path to the file',
                    },
                    lineNumber: {
                        type: 'number',
                        description: 'Line number to insert at (1-based)',
                    },
                    content: {
                        type: 'string',
                        description: 'Content to insert',
                    },
                },
                required: ['filePath', 'lineNumber', 'content'],
            },
            permission: 'loose',
        };
    }

    async *call(
        parameter: ToolCallParameter
    ): AsyncGenerator<Message, AsyncControlResponse, AsyncControl> {
        const { filePath, lineNumber, content } =
            parameter.parameters as InsertFileParameter;

        try {
            // Validate line number
            if (lineNumber < 1) {
                const errorMessage: ErrorMessage = {
                    id: generateUniqueId('error'),
                    content: 'Line number must be 1 or greater',
                    type: 'error',
                    sender: 'insert_at_line',
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
                    sender: 'insert_at_line',
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
            let fileExists = false;
            let lines: string[] = [];

            try {
                const fileContent = await fs.readFile(resolvedPath, 'utf-8');
                lines = fileContent.split('\n');
                fileExists = true;
            } catch {
                // File doesn't exist, will be created
                lines = [];
            }

            // Validate line number for existing files (allow reasonable padding up to 5 lines)
            if (fileExists && lineNumber > lines.length + 5) {
                const errorMessage: ErrorMessage = {
                    id: generateUniqueId('error'),
                    content: `Line number ${lineNumber} is beyond file end + 1 (${lines.length + 1} max)`,
                    type: 'error',
                    sender: 'insert_at_line',
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

            // Insert content
            const contentLines = content.split('\n');
            const insertIndex = lineNumber - 1;

            // If inserting beyond current file length, pad with empty lines
            while (lines.length < insertIndex) {
                lines.push('');
            }

            // Insert the content lines at the specified position
            lines.splice(insertIndex, 0, ...contentLines);

            const newContent = lines.join('\n');
            await fs.writeFile(resolvedPath, newContent, 'utf-8');

            // Generate contextual diff for metadata
            const originalLinesForDiff = fileExists
                ? lines
                      .slice(0, insertIndex)
                      .concat(lines.slice(insertIndex + contentLines.length))
                : [];
            const contextualDiff = generateInsertDiff(
                originalLinesForDiff,
                content,
                lineNumber
            );

            const operation = fileExists ? 'edited' : 'created';
            const endLineNumber = lineNumber + contentLines.length - 1;

            // Show context before insertion
            const contextStart = Math.max(1, lineNumber - 2);
            const beforeLines = originalLinesForDiff.slice(
                contextStart - 1,
                Math.min(originalLinesForDiff.length, lineNumber - 1)
            );
            const beforeContent = beforeLines.join('\n');

            // Show context after insertion
            const afterLines = lines.slice(contextStart - 1, endLineNumber + 2);
            const afterContent = afterLines.join('\n');

            const fileOperationMessage: FileOperationMessage = {
                id: generateUniqueId('file-operation'),
                content: `File: ${filePath}\nSuccessfully ${operation} - inserted content at line${contentLines.length === 1 ? '' : 's'} ${lineNumber}${endLineNumber > lineNumber ? `-${endLineNumber}` : ''}\n\nbefore:\n\`\`\`\n${beforeContent}\n\`\`\`\n\nafter:\n\`\`\`\n${afterContent}\n\`\`\``,
                type: 'file_operation',
                sender: 'insert_at_line',
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
                content: `Failed to insert content in file: ${error instanceof Error ? error.message : String(error)}`,
                type: 'error',
                sender: 'insert_at_line',
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
     * Generates a custom permission prompt for inserting content into files.
     * @param parameter - The tool call parameters for context
     * @returns A human-readable prompt asking for permission to insert at the specific line
     */
    getPermissionPrompt(parameter: ToolCallParameter): string {
        const { filePath, lineNumber, content } =
            parameter.parameters as InsertFileParameter;

        const contentPreview =
            content.length > 42 ? content.substring(0, 39) + '...' : content;

        const lines = content.split('\n').length;
        const lineText = lines === 1 ? 'line' : 'lines';

        return `Allow agent to insert ${lines} ${lineText} at line ${lineNumber} in file "${filePath}"? (Content: "${contentPreview}")`;
    }
}
