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

interface ReadFileParameter {
    filePath: string;
    startLine?: number;
    lineCount?: number;
}

/**
 * Tool for reading file content with pagination support.
 *
 * Provides secure file reading within the workspace with line-based pagination.
 * Prevents access to files outside the current working directory and handles
 * errors gracefully through the message system.
 */
export class ReadFileTool implements Tool {
    get definition(): ToolDefinition {
        return {
            name: 'read_file',
            description:
                'Read file content with pagination (100 lines per page)',
            parameters: {
                type: 'object',
                properties: {
                    filePath: {
                        type: 'string',
                        description: 'Path to the file',
                    },
                    startLine: {
                        type: 'number',
                        description: 'Starting line number (1-based)',
                        default: 1,
                    },
                    lineCount: {
                        type: 'number',
                        description: 'Number of lines to read',
                        default: 100, // this is also maximum
                    },
                },
                required: ['filePath'],
            },
            permission: 'none',
        };
    }

    async *call(
        parameter: ToolCallParameter
    ): AsyncGenerator<Message, AsyncControlResponse, AsyncControl> {
        const {
            filePath,
            startLine = 1,
            lineCount = 100,
        } = parameter.parameters as ReadFileParameter;

        try {
            // Validate inputs
            if (startLine < 1) {
                const errorMessage: ErrorMessage = {
                    id: generateUniqueId('error'),
                    content: 'Start line must be 1 or greater',
                    type: 'error',
                    sender: 'read_file',
                    timestamp: new Date(),
                    metadata: {
                        error: new Error('Invalid start line'),
                    },
                };
                yield errorMessage;
                return {
                    messages: [errorMessage],
                    completedReason: 'completed',
                    usage: { inputTokens: 0, outputTokens: 0, toolsUsed: 1 },
                };
            }

            if (lineCount > 100 || lineCount < 1) {
                const errorMessage: ErrorMessage = {
                    id: generateUniqueId('error'),
                    content: 'Line count must be between 1 and 100',
                    type: 'error',
                    sender: 'read_file',
                    timestamp: new Date(),
                    metadata: {
                        error: new Error('Invalid line count'),
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
                    content: `Access denied: Cannot read files outside workspace (${filePath})`,
                    type: 'error',
                    sender: 'read_file',
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

            // Read file content
            const fileContent = await fs.readFile(resolvedPath, 'utf-8');
            const lines = fileContent.split('\n');

            // Calculate pagination
            const endLine = Math.min(startLine + lineCount - 1, lines.length);
            const requestedLines = lines.slice(startLine - 1, endLine);

            // Format content with line numbers
            const formattedContent = requestedLines
                .map((line, index) => `${startLine + index}→${line}`)
                .join('\n');

            const totalLines = lines.length;
            const showing = `Showing lines ${startLine}-${endLine} of ${totalLines}`;

            const toolsMessage: ToolsMessage = {
                id: generateUniqueId('tool'),
                content: `File: ${filePath}\n${showing}\n\n${formattedContent}`,
                type: 'tool',
                sender: 'read_file',
                timestamp: new Date(),
                metadata: {
                    toolName: 'read_file',
                    parameters: parameter.parameters,
                    result: formattedContent,
                },
            };

            yield toolsMessage;
            return {
                messages: [toolsMessage],
                completedReason: 'completed',
                usage: {
                    inputTokens: 0,
                    outputTokens: formattedContent.length,
                    toolsUsed: 1,
                },
            };
        } catch (error) {
            const errorMessage: ErrorMessage = {
                id: generateUniqueId('error'),
                content: `Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
                type: 'error',
                sender: 'read_file',
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
