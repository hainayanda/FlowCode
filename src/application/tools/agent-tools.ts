import { Observable, Subject } from 'rxjs';
import { ToolDefinition, ToolCall, ToolResult, Toolbox } from '../interfaces/toolbox.js';
import { EmbeddingService } from '../interfaces/embedding-service.js';
import { DomainMessage, PlainMessage } from '../../presentation/view-models/console/console-use-case.js';
import { AgentExecutor } from '../interfaces/agent-executor.js';
import { AgentExecutionRequest } from '../interfaces/agent-executor.js';
import { SummaryMessage } from '../interfaces/agent.js';

/**
 * Agent execution parameters
 */
export interface AgentExecutionParams {
  agentName: string;
  prompt: string;
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
    private readonly agentExecutor: AgentExecutor,
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
    let summaryMessage: SummaryMessage | null = null;
    
    try {
      const params = this.validateParameters(toolCall.parameters);

      const request: AgentExecutionRequest = {
        agentName: params.agentName,
        prompt: params.prompt
      };

      // Execute agent and collect all domain messages
      const execution$ = this.agentExecutor.executeAgent(request, this.workerToolbox);
      
      // Wait for execution to complete and collect summary
      return new Promise<ToolResult>((resolve, _reject) => {
        execution$.subscribe({
          next: (domainMessage: DomainMessage) => {
            // Forward all domain messages
            this.domainMessagesSubject.next(domainMessage);
            
            // Check if this is a summary message from an AI response
            if (domainMessage.type === 'ai-response' && domainMessage.content.includes('summary')) {
              // Try to extract summary data from the message
              const messageContent = domainMessage.content;
              if (messageContent.includes('completed') || messageContent.includes('partial') || messageContent.includes('failed')) {
                summaryMessage = {
                  id: domainMessage.id,
                  type: 'summary',
                  content: messageContent,
                  timestamp: domainMessage.timestamp,
                  taskStatus: messageContent.includes('completed') ? 'completed' : 
                            messageContent.includes('partial') ? 'partial' : 'failed',
                  summaryData: messageContent
                } as SummaryMessage;
              }
            }
          },
          error: (error: Error) => {
            const executionTime = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);
            
            const errorDomainMessage: PlainMessage = {
              id: Date.now().toString(),
              type: 'system',
              content: `❌ Agent execution failed: ${errorMessage}`,
              timestamp: new Date()
            };
            this.domainMessagesSubject.next(errorDomainMessage);
            
            resolve({
              success: false,
              data: {
                success: false,
                summary: `Agent execution failed: ${errorMessage}`,
                executionTime,
                metadata: {
                  agentName: params.agentName,
                  error: errorMessage
                }
              },
              error: errorMessage,
              message: `Agent execution failed: ${errorMessage}`
            });
          },
          complete: () => {
            const executionTime = Date.now() - startTime;
            
            if (summaryMessage) {
              // Return summary message as the tool result
              resolve({
                success: summaryMessage.taskStatus === 'completed',
                data: {
                  success: summaryMessage.taskStatus === 'completed',
                  summary: summaryMessage.summaryData,
                  executionTime,
                  taskStatus: summaryMessage.taskStatus,
                  metadata: {
                    agentName: params.agentName,
                    messageId: summaryMessage.id
                  }
                },
                message: summaryMessage.summaryData
              });
            } else {
              // Fallback if no summary message was captured
              resolve({
                success: true,
                data: {
                  success: true,
                  summary: `${params.agentName} agent execution completed`,
                  executionTime,
                  metadata: {
                    agentName: params.agentName
                  }
                },
                message: `${params.agentName} agent execution completed`
              });
            }
          }
        });
      });

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Emit error message
      this.domainMessagesSubject.next({
        id: Date.now().toString(),
        type: 'system',
        content: `❌ Agent setup failed: ${errorMessage}`,
        timestamp: new Date()
      } as PlainMessage);

      return {
        success: false,
        data: {
          success: false,
          summary: `Agent setup failed: ${errorMessage}`,
          executionTime,
          metadata: {
            agentName: toolCall.parameters.agentName || 'unknown',
            error: errorMessage
          }
        },
        error: errorMessage,
        message: `Agent setup failed: ${errorMessage}`
      };
    }
  }

  private validateParameters(parameters: Record<string, any>): AgentExecutionParams {
    const { agentName, prompt } = parameters;

    if (!agentName || typeof agentName !== 'string') {
      throw new Error('Agent name is required and must be a string');
    }

    if (!prompt || typeof prompt !== 'string') {
      throw new Error('Prompt is required and must be a string');
    }

    return {
      agentName,
      prompt
    };
  }

}