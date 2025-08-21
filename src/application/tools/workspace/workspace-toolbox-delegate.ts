import { AsyncControl, AsyncControlResponse } from '../../models/async-control';
import { Message } from '../../models/messages';

/**
 * Interface for workspace tool execution methods.
 * This interface defines the contract for all workspace-related tool operations
 * that can be called by the WorkspaceToolbox.
 */
export interface WorkspaceToolboxDelegate {
    /**
     * Lists files and directories in the specified path
     */
    listDirectory(
        parameters: Record<string, any>
    ): AsyncGenerator<Message, AsyncControlResponse, AsyncControl>;

    /**
     * Gets the current workspace path
     */
    workspacePath(
        parameters: Record<string, any>
    ): AsyncGenerator<Message, AsyncControlResponse, AsyncControl>;

    /**
     * Creates a new file with optional content
     */
    createFile(
        parameters: Record<string, any>
    ): AsyncGenerator<Message, AsyncControlResponse, AsyncControl>;

    /**
     * Creates a new directory with optional recursive creation
     */
    createDirectory(
        parameters: Record<string, any>
    ): AsyncGenerator<Message, AsyncControlResponse, AsyncControl>;

    /**
     * Checks if a file or directory exists at the given path
     */
    exists(
        parameters: Record<string, any>
    ): AsyncGenerator<Message, AsyncControlResponse, AsyncControl>;

    /**
     * Handles unknown tool errors
     */
    respondsWithNoToolsError(
        parameters: Record<string, any>
    ): AsyncGenerator<Message, AsyncControlResponse, AsyncControl>;
}
