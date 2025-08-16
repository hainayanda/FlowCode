import { Observable } from 'rxjs';
import { DomainMessage } from '../../presentation/view-models/console/console-use-case.js';
import { Toolbox } from './toolbox.js';
import { AgentMessage } from './agent.js';

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
 * Interface for executing agents and publishing results as domain messages
 */
export interface AgentExecutor {
  /**
   * Execute an agent with the given request and toolbox
   * Returns observable of domain messages from the execution
   */
  executeAgent(request: AgentExecutionRequest, toolbox: Toolbox): Observable<DomainMessage>;

  /**
   * Get domain messages stream from agent executions
   */
  readonly domainMessages$: Observable<DomainMessage>;
}