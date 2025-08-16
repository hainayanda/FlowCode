import { Observable, Subject } from 'rxjs';
import { ToolDefinition, ToolCall, ToolResult, Toolbox } from '../interfaces/toolbox.js';
import { EmbeddingService } from '../interfaces/embedding-service.js';
import { DomainMessage, PlainMessage } from '../../presentation/view-models/console/console-use-case.js';
import { AgentService } from '../services/agent-service.js';
import { AgentExecutionRequest, AgentExecutionResult, AgentExecutionStatus } from '../interfaces/agent-execution.js';
import { AgentMessage } from '../interfaces/agent.js';

/**
 * Agent execution parameters
 */
export interface AgentExecutionParams {
  agentName: string;
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Agent tools implementation for executing configured worker agents
 */
export class AgentTools implements Toolbox {
  readonly id = 'agent_tools';
  readonly description = 'Agent execution toolbox for running configured worker agents';

  private readonly domainMessagesSubject = new Subject<DomainMessage>();

  get domainMessages$(): Observable<DomainMessage> {
    return this.domainMessagesSubject.asObservable();
  }

  constructor(
    public readonly embeddingService: EmbeddingService,
    private readonly agentService: AgentService,
    private readonly workerToolbox: Toolbox
  ) {}

  getTools(): ToolDefinition[] {
    return [
      {
        name: 'execute_agent',
        description: 'Execute a configured worker agent with a prompt',
        parameters: [
          {
            name: 'agentName',
            type: 'string',
            description: 'Name of the worker agent to execute',
            required: true
          },
          {
            name: 'prompt',
            type: 'string',
            description: 'Prompt to send to the agent',
            required: true
          },
          {
            name: 'systemPrompt',
            type: 'string',
            description: 'Optional system prompt for the agent',
            required: false
          },
          {
            name: 'temperature',
            type: 'number',
            description: 'Temperature setting for the agent (0.0 to 2.0)',
            required: false
          },
          {
            name: 'maxTokens',
            type: 'number',
            description: 'Maximum tokens for the agent response',
            required: false
          }
        ],
        permission: 'loose'
      }
    ];
  }

  supportsTool(toolName: string): boolean {
    return toolName === 'execute_agent';
  }

  async executeTool(toolCall: ToolCall): Promise<ToolResult> {
    if (!this.supportsTool(toolCall.name)) {
      return {
        success: false,
        error: `Tool '${toolCall.name}' is not supported by AgentTools`
      };
    }

    const startTime = Date.now();
    
    try {
      const params = this.validateParameters(toolCall.parameters);
      
      // Emit start message
      this.domainMessagesSubject.next({
        id: Date.now().toString(),
        type: 'system',
        content: `Starting ${params.agentName} agent...`,
        timestamp: new Date()
      } as PlainMessage);

      const request: AgentExecutionRequest = {
        agentName: params.agentName,
        prompt: params.prompt,
        systemPrompt: params.systemPrompt,
        temperature: params.temperature,
        maxTokens: params.maxTokens
      };

      const execution = await this.agentService.executeAgent(request, this.workerToolbox);
      
      // Subscribe to status updates and publish as domain messages
      execution.status.subscribe({
        next: (status: AgentExecutionStatus) => {
          this.domainMessagesSubject.next({
            id: Date.now().toString(),
            type: 'system',
            content: `Agent Status: ${status.status} - ${status.message || ''}`,
            timestamp: new Date()
          } as PlainMessage);
        },
        error: (error: Error) => {
          this.domainMessagesSubject.next({
            id: Date.now().toString(),
            type: 'system',
            content: `Agent Error: ${error.message}`,
            timestamp: new Date()
          } as PlainMessage);
        }
      });

      // Subscribe to agent messages and publish them
      execution.messages.subscribe({
        next: (message: AgentMessage) => {
          this.domainMessagesSubject.next({
            id: message.id,
            type: 'system',
            content: message.content,
            timestamp: message.timestamp
          } as PlainMessage);
        },
        error: (error: Error) => {
          this.domainMessagesSubject.next({
            id: Date.now().toString(),
            type: 'system',
            content: `Agent Message Error: ${error.message}`,
            timestamp: new Date()
          } as PlainMessage);
        }
      });

      const executionTime = Date.now() - startTime;
      const result = await this.agentService.getExecutionResult(
        request,
        executionTime,
        true
      );

      // Emit completion message
      this.domainMessagesSubject.next({
        id: Date.now().toString(),
        type: 'system',
        content: `Agent execution completed: ${result.summary}`,
        timestamp: new Date()
      } as PlainMessage);

      return {
        success: true,
        data: result,
        message: result.summary
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Get result even for failed execution
      const result: AgentExecutionResult = {
        success: false,
        summary: `Agent execution failed: ${errorMessage}`,
        executionTime,
        metadata: {
          agentName: toolCall.parameters.agentName,
          error: errorMessage
        }
      };

      // Emit error message
      this.domainMessagesSubject.next({
        id: Date.now().toString(),
        type: 'system',
        content: `❌ ${result.summary}`,
        timestamp: new Date()
      } as PlainMessage);

      return {
        success: false,
        data: result,
        error: errorMessage,
        message: result.summary
      };
    }
  }

  private validateParameters(parameters: Record<string, any>): AgentExecutionParams {
    const { agentName, prompt, systemPrompt, temperature, maxTokens } = parameters;

    if (!agentName || typeof agentName !== 'string') {
      throw new Error('Agent name is required and must be a string');
    }

    if (!prompt || typeof prompt !== 'string') {
      throw new Error('Prompt is required and must be a string');
    }

    if (systemPrompt !== undefined && typeof systemPrompt !== 'string') {
      throw new Error('System prompt must be a string');
    }

    if (temperature !== undefined && (typeof temperature !== 'number' || temperature < 0 || temperature > 2)) {
      throw new Error('Temperature must be a number between 0 and 2');
    }

    if (maxTokens !== undefined && (typeof maxTokens !== 'number' || maxTokens <= 0)) {
      throw new Error('Max tokens must be a positive number');
    }

    return {
      agentName,
      prompt,
      systemPrompt,
      temperature,
      maxTokens
    };
  }
}