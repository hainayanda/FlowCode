/**
 * Tool execution result
 */
export interface ToolResult {
  success: boolean;
  data?: any;
  message?: string;
  error?: string;
}

/**
 * Toolbox message types for UI status updates
 */
export type ToolboxMessageStatus = 'executing' | 'failing' | 'succeed';

export interface ToolboxMessage {
  id: string;
  toolCall: ToolCall;
  status: ToolboxMessageStatus;
  message: string;
  timestamp: Date;
  result?: any;
  error?: string;
}

/**
 * Tool parameter definition
 */
export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  default?: any;
}

/**
 * Permission level for tools
 */
export type PermissionLevel = 'none' | 'loose' | 'strict' | 'always';

/**
 * Tool definition interface
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameter[];
  permission: PermissionLevel;
}

/**
 * Tool call request
 */
export interface ToolCall {
  name: string;
  parameters: Record<string, any>;
}

/**
 * Base toolbox interface
 */
export interface Toolbox {
  /**
   * Unique identifier for this toolbox
   */
  readonly id: string;

  /**
   * Description of what this toolbox provides
   */
  readonly description: string;

  /**
   * Observable stream of toolbox status messages
   */
  readonly messages$: import('rxjs').Observable<ToolboxMessage>;

  /**
   * Embedding service for vector operations
   */
  readonly embeddingService: import('../interfaces/embedding-service.js').EmbeddingService;

  /**
   * Get list of tools this toolbox supports
   */
  getTools(): ToolDefinition[];

  /**
   * Check if this toolbox supports a specific tool
   */
  supportsTool(toolName: string): boolean;

  /**
   * Execute a tool call with status updates
   */
  executeTool(toolCall: ToolCall): Promise<ToolResult>;
}