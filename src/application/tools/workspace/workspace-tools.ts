import { promises as fs } from 'fs';
import { join, resolve } from 'path';
import { generateUniqueId } from '../../../utils/id-generator';
import { AsyncControl, AsyncControlResponse } from '../../models/async-control';
import { ErrorMessage, Message, ToolsMessage } from '../../models/messages';
import { WorkspaceToolboxDelegate } from './workspace-toolbox-delegate';

/**
 * Implementation of workspace tool operations.
 * Handles all filesystem operations for the WorkspaceToolbox.
 */
export class WorkspaceTools implements WorkspaceToolboxDelegate {
    /**
     * Lists files and directories in the specified path.
     *
     * @param parameters - Object containing path and optional includeHidden flag
     * @param parameters.path - The directory path to list contents from
     * @param parameters.includeHidden - Whether to include hidden files (defaults to false)
     * @returns AsyncGenerator yielding tool messages with directory contents
     * @throws Yields error message if directory cannot be accessed
     */
    async *listDirectory(
        parameters: Record<string, any>
    ): AsyncGenerator<Message, AsyncControlResponse, AsyncControl> {
        const { path, includeHidden = false } = parameters;

        try {
            const resolvedPath = resolve(path);
            const entries = await fs.readdir(resolvedPath, {
                withFileTypes: true,
            });

            const filteredEntries = includeHidden
                ? entries
                : entries.filter((entry) => !entry.name.startsWith('.'));

            const results = filteredEntries.map((entry) => ({
                name: entry.name,
                type: entry.isDirectory() ? 'directory' : 'file',
                path: join(resolvedPath, entry.name),
            }));

            const resultMessage = this.createToolMessage(
                'list-dir',
                `Successfully listed ${results.length} items in directory:\n${results.map((r) => `- ${r.path}`).join('\n')}`,
                'list_directory',
                { path, includeHidden },
                JSON.stringify(results)
            );

            yield resultMessage;

            return {
                messages: [resultMessage],
                completedReason: 'completed',
                usage: { inputTokens: 0, outputTokens: 0, toolsUsed: 1 },
            };
        } catch (error) {
            const errorMessage = this.createErrorMessage(
                'list-dir-error',
                `Cannot access directory: ${error instanceof Error ? error.message : String(error)}`,
                error instanceof Error ? error : new Error(String(error))
            );

            yield errorMessage;

            return {
                messages: [errorMessage],
                completedReason: 'completed',
                usage: { inputTokens: 0, outputTokens: 0, toolsUsed: 1 },
            };
        }
    }

    /**
     * Gets the current workspace path (working directory).
     *
     * @param _parameters - Unused parameters object (required by interface)
     * @returns AsyncGenerator yielding tool message with current working directory path
     */
    async *workspacePath(
        _parameters: Record<string, any>
    ): AsyncGenerator<Message, AsyncControlResponse, AsyncControl> {
        const cwd = process.cwd();

        const resultMessage = this.createToolMessage(
            'workspace-path',
            `Current working directory is ${cwd}`,
            'workspace_path',
            {},
            cwd
        );

        yield resultMessage;

        return {
            messages: [resultMessage],
            completedReason: 'completed',
            usage: { inputTokens: 0, outputTokens: 0, toolsUsed: 1 },
        };
    }

    /**
     * Creates a new file with optional content.
     *
     * @param parameters - Object containing file creation parameters
     * @param parameters.filePath - The path where the file should be created
     * @param parameters.content - Optional content to write to the file (defaults to empty string)
     * @returns AsyncGenerator yielding tool message confirming file creation
     * @throws Yields error message if file cannot be created
     */
    async *createFile(
        parameters: Record<string, any>
    ): AsyncGenerator<Message, AsyncControlResponse, AsyncControl> {
        const { filePath, content = '' } = parameters;

        try {
            const resolvedPath = resolve(filePath);
            await fs.writeFile(resolvedPath, content, 'utf8');

            const resultMessage = this.createToolMessage(
                'create-file',
                content
                    ? `Created file at ${filePath} with content:\n\`\`\`\n${content}\n\`\`\``
                    : `Created file at ${filePath} as empty file`,
                'create_file',
                { filePath, content },
                `File created at ${resolvedPath}`
            );

            yield resultMessage;

            return {
                messages: [resultMessage],
                completedReason: 'completed',
                usage: { inputTokens: 0, outputTokens: 0, toolsUsed: 1 },
            };
        } catch (error) {
            const errorMessage = this.createErrorMessage(
                'create-file-error',
                `Cannot create file: ${error instanceof Error ? error.message : String(error)}`,
                error instanceof Error ? error : new Error(String(error))
            );

            yield errorMessage;

            return {
                messages: [errorMessage],
                completedReason: 'completed',
                usage: { inputTokens: 0, outputTokens: 0, toolsUsed: 1 },
            };
        }
    }

    /**
     * Creates a new directory with optional recursive creation.
     *
     * @param parameters - Object containing directory creation parameters
     * @param parameters.directoryPath - The path where the directory should be created
     * @param parameters.recursive - Whether to create parent directories if they don't exist (defaults to false)
     * @returns AsyncGenerator yielding tool message confirming directory creation
     * @throws Yields error message if directory cannot be created
     */
    async *createDirectory(
        parameters: Record<string, any>
    ): AsyncGenerator<Message, AsyncControlResponse, AsyncControl> {
        const { directoryPath, recursive = false } = parameters;

        try {
            const resolvedPath = resolve(directoryPath);
            await fs.mkdir(resolvedPath, { recursive });

            const resultMessage = this.createToolMessage(
                'create-dir',
                `Created directory at ${directoryPath}${recursive ? ' including any missing parent directories' : ''}`,
                'create_directory',
                { directoryPath, recursive },
                `Directory created at ${resolvedPath}`
            );

            yield resultMessage;

            return {
                messages: [resultMessage],
                completedReason: 'completed',
                usage: { inputTokens: 0, outputTokens: 0, toolsUsed: 1 },
            };
        } catch (error) {
            const errorMessage = this.createErrorMessage(
                'create-dir-error',
                `Cannot create directory: ${error instanceof Error ? error.message : String(error)}`,
                error instanceof Error ? error : new Error(String(error))
            );

            yield errorMessage;

            return {
                messages: [errorMessage],
                completedReason: 'completed',
                usage: { inputTokens: 0, outputTokens: 0, toolsUsed: 1 },
            };
        }
    }

    /**
     * Checks if a file or directory exists at the given path.
     *
     * @param parameters - Object containing path to check
     * @param parameters.path - The file or directory path to check for existence
     * @returns AsyncGenerator yielding tool message with existence status and type (file/directory)
     */
    async *exists(
        parameters: Record<string, any>
    ): AsyncGenerator<Message, AsyncControlResponse, AsyncControl> {
        const { path } = parameters;

        try {
            const resolvedPath = resolve(path);
            const stats = await fs.stat(resolvedPath);
            const type = stats.isDirectory() ? 'directory' : 'file';

            const resultMessage = this.createToolMessage(
                'exists',
                `Path exists and is a ${type}: ${path}`,
                'exists',
                { path },
                JSON.stringify({ exists: true, type })
            );

            yield resultMessage;

            return {
                messages: [resultMessage],
                completedReason: 'completed',
                usage: { inputTokens: 0, outputTokens: 0, toolsUsed: 1 },
            };
        } catch {
            const resultMessage = this.createToolMessage(
                'exists',
                `Path does not exist: ${path}`,
                'exists',
                { path },
                JSON.stringify({ exists: false })
            );

            yield resultMessage;

            return {
                messages: [resultMessage],
                completedReason: 'completed',
                usage: { inputTokens: 0, outputTokens: 0, toolsUsed: 1 },
            };
        }
    }

    /**
     * Handles requests for unknown or unavailable tools by returning an error message.
     *
     * @param _parameters - Unused parameters object (required by interface)
     * @returns AsyncGenerator yielding error message indicating tool is not available
     */
    async *respondsWithNoToolsError(
        _parameters: Record<string, any>
    ): AsyncGenerator<Message, AsyncControlResponse, AsyncControl> {
        const errorMessage = this.createErrorMessage(
            'no-tool-error',
            'Requested tool is not available in WorkspaceToolbox',
            new Error('Tool not found')
        );

        yield errorMessage;

        return {
            messages: [errorMessage],
            completedReason: 'completed',
            usage: { inputTokens: 0, outputTokens: 0, toolsUsed: 1 },
        };
    }

    /**
     * Creates a standardized tool success message.
     *
     * @param idPrefix - Prefix for generating unique message ID
     * @param content - Human-readable message content
     * @param toolName - Name of the tool that generated this message
     * @param parameters - Parameters that were passed to the tool
     * @param result - Optional result data to include in metadata
     * @returns ToolsMessage with standardized format
     */
    private createToolMessage(
        idPrefix: string,
        content: string,
        toolName: string,
        parameters: Record<string, any>,
        result?: string
    ): ToolsMessage {
        return {
            id: generateUniqueId(idPrefix),
            content,
            type: 'tool',
            sender: 'workspace-tool',
            timestamp: new Date(),
            metadata: {
                toolName,
                parameters,
                ...(result ? { result } : {}),
            },
        };
    }

    /**
     * Creates a standardized error message.
     *
     * @param idPrefix - Prefix for generating unique message ID
     * @param content - Human-readable error message content
     * @param error - Error object containing error details
     * @returns ErrorMessage with standardized format including error stack if available
     */
    private createErrorMessage(
        idPrefix: string,
        content: string,
        error: Error
    ): ErrorMessage {
        return {
            id: generateUniqueId(idPrefix),
            content,
            type: 'error',
            sender: 'workspace-tool',
            timestamp: new Date(),
            metadata: {
                error,
                ...(error.stack ? { stack: error.stack } : {}),
            },
        };
    }
}
