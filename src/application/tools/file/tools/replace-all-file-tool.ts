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

interface ReplaceAllFileParameter {
    filePath: string;
    pattern: string;
    content: string;
}

/**
 * Tool for replacing all pattern matches in files using regular expressions.
 *
 * Provides secure regex-based replacements within the workspace with permission management.
 * Supports capture groups and complex replacement patterns.
 */
export class ReplaceAllFileTool implements Tool, ToolPromptSource {
    constructor() {}

    get definition(): ToolDefinition {
        return {
            name: 'replace_all',
            description:
                'Replace all occurrences matching regex in file with new content',
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
            permission: 'strict',
        };
    }

    async *call(
        parameter: ToolCallParameter
    ): AsyncGenerator<Message, AsyncControlResponse, AsyncControl> {
        const { filePath, pattern, content } =
            parameter.parameters as ReplaceAllFileParameter;

        try {
            // Security check - prevent access outside current directory
            const resolvedPath = path.resolve(filePath);
            const workingDir = process.cwd();
            if (!resolvedPath.startsWith(workingDir)) {
                const errorMessage: ErrorMessage = {
                    id: generateUniqueId('error'),
                    content: `Access denied: Cannot modify files outside workspace (${filePath})`,
                    type: 'error',
                    sender: 'replace_all',
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
                    sender: 'replace_all',
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
                regex = new RegExp(pattern, 'g');
            } catch (error) {
                const errorMessage: ErrorMessage = {
                    id: generateUniqueId('error'),
                    content: `Invalid regex pattern: ${error instanceof Error ? error.message : String(error)}`,
                    type: 'error',
                    sender: 'replace_all',
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

            // Perform replacement
            const matches = [...fileContent.matchAll(regex)];
            if (matches.length === 0) {
                const errorMessage: ErrorMessage = {
                    id: generateUniqueId('error'),
                    content: `No matches found for pattern: ${pattern}`,
                    type: 'error',
                    sender: 'replace_all',
                    timestamp: new Date(),
                    metadata: {
                        error: new Error('No matches found'),
                    },
                };
                yield errorMessage;
                return {
                    messages: [errorMessage],
                    completedReason: 'completed',
                    usage: { inputTokens: 0, outputTokens: 0, toolsUsed: 1 },
                };
            }

            const newContent = fileContent.replace(regex, content);

            // Write the modified content back to file
            await fs.writeFile(resolvedPath, newContent, 'utf-8');

            // Create detailed diff information for regex replacements
            const originalLines = fileContent.split('\n');
            const modifiedLines = newContent.split('\n');

            const changes = matches.map((match) => {
                const matchStart = match.index || 0;
                const beforeText = fileContent.substring(0, matchStart);
                const lineNumber = beforeText.split('\n').length;

                return {
                    lineNumber,
                    type: 'modified' as const,
                    oldText: match[0],
                    newText: content,
                };
            });

            // Generate contextual diff for metadata
            const contextualDiff = generateContextualDiff(
                originalLines,
                modifiedLines,
                changes
            );

            // For multiple replacements, show relevant sections
            const beforeContent = fileContent;
            const afterContent = newContent;

            const fileOperationMessage: FileOperationMessage = {
                id: generateUniqueId('file-operation'),
                content: `File: ${filePath}\nSuccessfully replaced ${matches.length} occurrence${matches.length === 1 ? '' : 's'} of pattern\nPattern: ${pattern}\nReplacement: ${content}\n\nbefore:\n\`\`\`\n${beforeContent}\n\`\`\`\n\nafter:\n\`\`\`\n${afterContent}\n\`\`\``,
                type: 'file_operation',
                sender: 'replace_all',
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
                sender: 'replace_all',
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
     * Generates a custom permission prompt for replacing all pattern matches in files.
     * @param parameter - The tool call parameters for context
     * @returns A human-readable prompt asking for permission to replace patterns in the specific file
     */
    getPermissionPrompt(parameter: ToolCallParameter): string {
        const { filePath, pattern, content } =
            parameter.parameters as ReplaceAllFileParameter;

        const patternPreview =
            pattern.length > 20 ? pattern.substring(0, 20) + '...' : pattern;
        const contentPreview =
            content.length > 20 ? content.substring(0, 20) + '...' : content;

        return `Allow agent to replace all "${patternPreview}" with "${contentPreview}" in file "${filePath}"?`;
    }
}
