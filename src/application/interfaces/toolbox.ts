import { Observable } from 'rxjs';
import { type EmbeddingService } from './embedding-service.js';
import { type DomainMessage } from '../../presentation/view-models/console/console-use-case.js';

/**
 * Tool execution result
 * 
 * Tools can emit rich messages through their messages$ Observable stream.
 * Each tool should publish DomainMessages to provide user feedback:
 * - File operations: FileOperationMessage with diffs and line counts
 * - Workspace analysis: PlainMessage with analysis results  
 * - Web searches: PlainMessage with search results
 * - Other tools: PlainMessage with completion status
 */
export interface ToolResult {
  success: boolean;
  data?: any;
  message?: string;
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
 * Domain message publisher interface for tools
 */
export interface DomainMessagePublisher {
  /**
   * Observable stream of domain messages for rich UI updates
   */
  readonly domainMessages$: Observable<DomainMessage>;
}

/**
 * Base toolbox interface
 */
export interface Toolbox extends DomainMessagePublisher {
  /**
   * Unique identifier for this toolbox
   */
  readonly id: string;

  /**
   * Description of what this toolbox provides
   */
  readonly description: string;


  /**
   * Embedding service for vector operations
   */
  readonly embeddingService: EmbeddingService;

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