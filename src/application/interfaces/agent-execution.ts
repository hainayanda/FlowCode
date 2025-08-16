import { Observable } from 'rxjs';
import { AgentMessage, TokenUsage } from './agent.js';

/**
 * Structured response from agent execution
 */
export interface AgentExecutionResult {
  success: boolean;
  summary: string;
  executionTime: number;
  usage?: TokenUsage;
  metadata?: Record<string, unknown>;
}

/**
 * Agent execution status updates
 */
export interface AgentExecutionStatus {
  status: 'starting' | 'processing' | 'tool_execution' | 'completed' | 'error';
  message?: string;
  currentTool?: string;
  progress?: number;
}

/**
 * Agent execution request
 */
export interface AgentExecutionRequest {
  agentName: string;
  prompt: string;
  context?: AgentMessage[];
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Agent execution output that combines status and messages
 */
export interface AgentExecutionOutput {
  status: Observable<AgentExecutionStatus>;
  messages: Observable<AgentMessage>;
}