import * as fs from 'fs/promises';
import * as path from 'path';
import {
    AsyncControl,
    AsyncControlResponse,
} from '../../../../common/models/async-control';
import { generateContextualDiff } from '../../../../common/utils/diff-utils';
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

interface ReplaceFirstFileParameter {
    filePath: string;
    pattern: string;
    content: string;
}

/**
 * Tool for replacing first pattern match in files using regular expressions.
 *
 * Provides secure regex-based replacement within the workspace with permission management.
 * Only replaces the first occurrence found, unlike ReplaceAllFileTool.
 */
export class ReplaceFirstFileTool implements Tool, ToolPromptSource {
    constructor() {}

    get definition(): ToolDefinition {
        return {
            name: 'replace_first',
            description:
                'Replace first occurrence matching regex in file with new content',
            parameters: {
                type: 'object',
                properties: {
                    filePath: {
                        type: 'string',
                        description: 'Path to the file',
                    },
                    pattern: {
                        type: 'string',
                        description: 'Regex pattern to match',
                    },
                    content: {
                        type: 'string',
                        description: 'Replacement content',
                    },
                },
                required: ['filePath', 'pattern', 'content'],
            },
            permission: 'loose',
        };
    }

    async *call(
        parameter: ToolCallParameter
    ): AsyncGenerator<Message, AsyncControlResponse, AsyncControl> {
        const { filePath, pattern, content } =
            parameter.parameters as ReplaceFirstFileParameter;

        try {
            // Security check - prevent access outside current directory
            const resolvedPath = path.resolve(filePath);
            const workingDir = process.cwd();
            if (!resolvedPath.startsWith(workingDir)) {
                const errorMessage: ErrorMessage = {
                    id: generateUniqueId('error'),
                    content: `Access denied: Cannot modify files outside workspace (${filePath})`,
                    type: 'error',
                    sender: 'replace_first',
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
                    sender: 'replace_first',
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

            // Validate regex pattern
            let regex: RegExp;
            try {
                regex = new RegExp(pattern);
            } catch (error) {
                const errorMessage: ErrorMessage = {
                    id: generateUniqueId('error'),
                    content: `Invalid regex pattern: ${error instanceof Error ? error.message : String(error)}`,
                    type: 'error',
                    sender: 'replace_first',
                    timestamp: new Date(),
                    metadata: {
                        error:
                            error instanceof Error
                                ? error
                                : new Error('Invalid regex'),
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

            // Find first match
            const match = fileContent.match(regex);
            if (!match) {
                const errorMessage: ErrorMessage = {
                    id: generateUniqueId('error'),
                    content: `No match found for pattern: ${pattern}`,
                    type: 'error',
                    sender: 'replace_first',
                    timestamp: new Date(),
                    metadata: {
                        error: new Error('No match found'),
                    },
                };
                yield errorMessage;
                return {
                    messages: [errorMessage],
                    completedReason: 'completed',
                    usage: { inputTokens: 0, outputTokens: 0, toolsUsed: 1 },
                };
            }

            // Perform replacement (only first occurrence)
            const newContent = fileContent.replace(regex, content);

            // Write the modified content back to file
            await fs.writeFile(resolvedPath, newContent, 'utf-8');

            // Calculate line number and create contextual diff
            const matchIndex = fileContent.indexOf(match[0]);
            const beforeText = fileContent.substring(0, matchIndex);
            const lineNumber = beforeText.split('\n').length;

            const originalLines = fileContent.split('\n');
            const modifiedLines = newContent.split('\n');

            const changes = [
                {
                    lineNumber,
                    type: 'modified' as const,
                    oldText: match[0],
                    newText: content,
                },
            ];

            // Generate contextual diff for metadata
            const contextualDiff = generateContextualDiff(
                originalLines,
                modifiedLines,
                changes
            );

            // Show context around the replacement
            const contextStart = Math.max(1, lineNumber - 2);
            const contextEnd = Math.min(originalLines.length, lineNumber + 2);
            const beforeLines = originalLines.slice(
                contextStart - 1,
                contextEnd
            );
            const beforeContent = beforeLines.join('\n');

            const afterLines = modifiedLines.slice(
                contextStart - 1,
                contextEnd
            );
            const afterContent = afterLines.join('\n');

            const fileOperationMessage: FileOperationMessage = {
                id: generateUniqueId('file-operation'),
                content: `File: ${filePath}\nSuccessfully replaced first occurrence of pattern at line ${lineNumber}\nPattern: ${pattern}\nReplacement: ${content}\n\nbefore:\n\`\`\`\n${beforeContent}\n\`\`\`\n\nafter:\n\`\`\`\n${afterContent}\n\`\`\``,
                type: 'file_operation',
                sender: 'replace_first',
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
                    inputTokens: fileContent.length,
                    outputTokens: newContent.length - fileContent.length,
                    toolsUsed: 1,
                },
            };
        } catch (error) {
            const errorMessage: ErrorMessage = {
                id: generateUniqueId('error'),
                content: `Failed to replace content in file: ${error instanceof Error ? error.message : String(error)}`,
                type: 'error',
                sender: 'replace_first',
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
     * Generates a custom permission prompt for replacing first pattern match in files.
     * @param parameter - The tool call parameters for context
     * @returns A human-readable prompt asking for permission to replace the first pattern in the specific file
     */
    getPermissionPrompt(parameter: ToolCallParameter): string {
        const { filePath, pattern, content } =
            parameter.parameters as ReplaceFirstFileParameter;

        const patternPreview =
            pattern.length > 25 ? pattern.substring(0, 22) + '...' : pattern;
        const contentPreview =
            content.length > 24 ? content.substring(0, 21) + '...' : content;

        return `Allow agent to replace first "${patternPreview}" with "${contentPreview}" in file "${filePath}"?`;
    }
}
