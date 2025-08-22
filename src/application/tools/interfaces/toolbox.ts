import type {
    AsyncControl,
    AsyncControlResponse,
} from '../../../common/models/async-control';
import type { Message } from '../../stores/models/messages';

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

    /**
     * Calls multiple tools with the given parameters.
     * @param parameters - Array of tool call parameters specifying which tools to run and with what arguments
     * @returns AsyncGenerator that yields intermediate messages and returns final tool execution result
     */
    callTools(
        parameters: ToolCallParameter[]
    ): AsyncGenerator<Message, AsyncControlResponse, AsyncControl>;
}

export interface Tool {
    definition: ToolDefinition;
    call(
        parameter: ToolCallParameter
    ): AsyncGenerator<Message, AsyncControlResponse, AsyncControl>;
}

/**
 * Interface for tools that can provide custom permission prompts.
 * When implemented, ToolWithPermission will ask the tool for a custom prompt
 * instead of using a generic permission request.
 */
export interface ToolPromptSource {
    /**
     * Generates a permission prompt for the specific tool call.
     * @param parameter - The tool call parameters for context
     * @returns A human-readable prompt asking for permission to execute this tool
     */
    getPermissionPrompt(parameter: ToolCallParameter): string;
}

/**
 * Interface for toolboxes that can provide custom permission prompts.
 * When implemented, ToolboxWithPermission will ask the toolbox for custom prompts
 * instead of using generic permission requests.
 */
export interface ToolboxPromptSource {
    /**
     * Generates a permission prompt for a batch of loose permission tools.
     * @param parameters - Array of tool call parameters for loose permission tools
     * @returns A human-readable prompt asking for permission to execute these tools
     */
    getBatchLoosePermissionPrompt(parameters: ToolCallParameter[]): string;

    /**
     * Generates a permission prompt for an individual tool call.
     * @param parameter - The tool call parameters for context
     * @returns A human-readable prompt asking for permission to execute this tool
     */
    getPermissionPrompt(parameter: ToolCallParameter): string;
}
