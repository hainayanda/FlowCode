import type {
    AsyncControl,
    AsyncControlResponse,
} from '../models/async-control';
import type { Message } from '../models/messages';

/**
 * Permission levels that control when and how tools can be executed.
 */
export type PermissionLevel = 'none' | 'loose' | 'strict' | 'always';

/**
 * Definition of a tool that can be called by agents.
 * Contains metadata about the tool's capabilities and permission requirements.
 */
export interface ToolDefinition {
    /** Unique identifier for the tool */
    name: string;
    /** Human-readable description of what the tool does */
    description: string;
    /** JSON schema describing the tool's input parameters */
    parameters: Record<string, any>;
    /** Permission level required to execute this tool */
    permission: PermissionLevel;
}

/**
 * Parameters for calling a specific tool.
 * Contains the tool name and the arguments to pass to it.
 */
export interface ToolCallParameter {
    /** Name of the tool to call */
    name: string;
    /** Arguments to pass to the tool */
    parameters: Record<string, any>;
}

/**
 * Interface for toolboxes that provide tool execution capabilities to agents.
 * Manages available tools and handles their execution with proper async control.
 */
export interface Toolbox {
    /** Array of tools available in this toolbox */
    tools: ToolDefinition[];

    /**
     * Executes a tool with the given parameters.
     * @param parameter - The tool call parameters specifying which tool to run and with what arguments
     * @returns AsyncGenerator that yields intermediate messages and returns final tool execution result
     */
    callTool(
        parameter: ToolCallParameter
    ): AsyncGenerator<Message, AsyncControlResponse, AsyncControl>;
}
