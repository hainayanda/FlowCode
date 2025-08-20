import type { AsyncControl, AsyncControlResponse } from "../models/async-control";
import type { Message } from "../models/messages";


export type PermissionLevel = 'none' | 'loose' | 'strict' | 'always';

export interface ToolDefinition { 
    name: string;
    description: string;
    parameters: Record<string, any>;
    permission: PermissionLevel;
}

export interface ToolCallParameter {
    name: string;
    parameters: Record<string, any>;
}

export interface Toolbox { 
    tools: ToolDefinition[];
    callTool(parameter: ToolCallParameter): AsyncGenerator<Message, AsyncControlResponse, AsyncControl>;
}