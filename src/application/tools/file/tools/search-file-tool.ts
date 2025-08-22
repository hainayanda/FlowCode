import * as fs from 'fs/promises';
import * as path from 'path';
import {
    AsyncControl,
    AsyncControlResponse,
} from '../../../../common/models/async-control';
import { generateUniqueId } from '../../../../common/utils/id-generator';
import {
    ErrorMessage,
    Message,
    ToolsMessage,
} from '../../../stores/models/messages';
import {
    Tool,
    ToolCallParameter,
    ToolDefinition,
} from '../../interfaces/toolbox';

interface SearchFileParameter {
    filePath: string;
    pattern: string;
    caseSensitive?: boolean;
}

/**
 * Tool for searching content in files using regular expressions.
 *
 * Provides secure file searching within the workspace with line-by-line results.
 * Returns matching lines with their line numbers and highlights the matches.
 */
export class SearchFileTool implements Tool {
    constructor() {}

    get definition(): ToolDefinition {
        return {
            name: 'search_file',
            description:
                'Search for regex pattern in file and return matching lines with line numbers',
            parameters: {
                type: 'object',
                properties: {
                    filePath: {
                        type: 'string',
                        description: 'Path to the file',
                    },
                    pattern: {
                        type: 'string',
                        description: 'Regex pattern to search for',
                    },
                    caseSensitive: {
                        type: 'boolean',
                        description: 'Whether search should be case sensitive',
                        default: true,
                    },
                },
                required: ['filePath', 'pattern'],
            },
            permission: 'none',
        };
    }

    async *call(
        parameter: ToolCallParameter
    ): AsyncGenerator<Message, AsyncControlResponse, AsyncControl> {
        const {
            filePath,
            pattern,
            caseSensitive = true,
        } = parameter.parameters as SearchFileParameter;

        try {
            // Security check - prevent access outside current directory
            const resolvedPath = path.resolve(filePath);
            const workingDir = process.cwd();
            if (!resolvedPath.startsWith(workingDir)) {
                const errorMessage: ErrorMessage = {
                    id: generateUniqueId('error'),
                    content: `Access denied: Cannot read files outside workspace (${filePath})`,
                    type: 'error',
                    sender: 'search_file',
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
                    sender: 'search_file',
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
                const flags = caseSensitive ? 'g' : 'gi';
                regex = new RegExp(pattern, flags);
            } catch (error) {
                const errorMessage: ErrorMessage = {
                    id: generateUniqueId('error'),
                    content: `Invalid regex pattern: ${error instanceof Error ? error.message : String(error)}`,
                    type: 'error',
                    sender: 'search_file',
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
            const lines = fileContent.split('\n');

            // Search for matches
            const matches: Array<{
                lineNumber: number;
                content: string;
                match: string;
            }> = [];

            lines.forEach((line, index) => {
                const lineMatches = line.match(regex);
                if (lineMatches) {
                    matches.push({
                        lineNumber: index + 1,
                        content: line,
                        match: lineMatches[0],
                    });
                }
            });

            // Format results
            let resultContent: string;
            if (matches.length === 0) {
                resultContent = `File: ${filePath}\nNo matches found for pattern: ${pattern}`;
            } else {
                const resultsText = matches
                    .map((match) => `${match.lineNumber}→${match.content}`)
                    .join('\n');
                resultContent = `File: ${filePath}\nFound ${matches.length} match${matches.length === 1 ? '' : 'es'} for pattern: ${pattern}\n\n${resultsText}`;
            }

            const toolsMessage: ToolsMessage = {
                id: generateUniqueId('tool'),
                content: resultContent,
                type: 'tool',
                sender: 'search_file',
                timestamp: new Date(),
                metadata: {
                    toolName: 'search_file',
                    parameters: parameter.parameters,
                    result: JSON.stringify(matches),
                },
            };

            yield toolsMessage;
            return {
                messages: [toolsMessage],
                completedReason: 'completed',
                usage: {
                    inputTokens: fileContent.length,
                    outputTokens: resultContent.length,
                    toolsUsed: 1,
                },
            };
        } catch (error) {
            const errorMessage: ErrorMessage = {
                id: generateUniqueId('error'),
                content: `Failed to search file: ${error instanceof Error ? error.message : String(error)}`,
                type: 'error',
                sender: 'search_file',
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
}
