import { Observable } from 'rxjs';
import { Toolbox } from './toolbox.js';

/**
 * Message types for agent communication
 */
export interface AgentMessage {
  id: string;
  type: 'user' | 'assistant' | 'system' | 'tool' | 'thinking';
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface UserMessage extends AgentMessage {
  type: 'user';
}

export interface AssistantMessage extends AgentMessage {
  type: 'assistant';
  reasoning?: string;
}

export interface ThinkingMessage extends AgentMessage {
  type: 'thinking';
  toolCall?: ToolCall;
  result?: any;
  error?: string;
}

/**
 * Tool call representation
 */
export interface ToolCall {
  id: string;
  name: string;
  parameters: Record<string, any>;
}

/**
 * Agent input for processing
 */
export interface AgentInput {
  messages: AgentMessage[];
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDefinition[];
}

/**
 * Tool definition for agent capabilities
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>; // JSON Schema
}

/**
 * Agent response from processing
 */
export interface AgentResponse {
  message: AssistantMessage | ThinkingMessage;
  usage?: TokenUsage;
  finishReason?: 'stop' | 'length' | 'tool_calls' | 'content_filter';
}

/**
 * Token usage tracking
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Agent configuration
 */
export interface AgentConfig {
  model: string;
  provider: string;
  apiKey: string;
  temperature?: number;
  maxTokens?: number;
  baseUrl?: string;
  // Azure-specific properties
  resourceName?: string;

  // OpenRouter-specific properties
  referer?: string;
  appName?: string;

  deploymentName?: string;
  apiVersion?: string;
}

/**
 * Core agent interface for AI provider abstraction
 */
export interface Agent {
  /**
   * Stream processing with real-time message publishing
   */
  processStream(input: AgentInput): Observable<AgentResponse>;

  /**
   * Validate agent configuration
   */
  validateConfig(): Promise<boolean>;

  /**
   * Get provider name
   */
  getProvider(): string;
}

/**
 * Model definition with provider information and user-friendly alias
 */
export interface ModelDefinition {
  provider: string;
  model: string;
  alias: string;
  description?: string;
}

/**
 * Agent factory interface for creating provider-specific agents
 */
export interface AgentFactory {
  createAgent(config: AgentConfig, toolbox: Toolbox): Agent;
  supportsProvider(provider: string): boolean;
  getProviderName(): string;
  getModels(): ModelDefinition[];
  supportsModel(modelName: string): boolean;
  getModelByAlias(alias: string): ModelDefinition | null;
}