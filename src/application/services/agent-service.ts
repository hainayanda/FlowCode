import { Subject, Observable } from 'rxjs';
import { Agent, AgentInput, AgentMessage, AgentConfig, AgentFactory } from '../interfaces/agent.js';
import { Toolbox } from '../interfaces/toolbox.js';
import { ConfigReader } from '../interfaces/config-store.js';
import { CredentialStore } from '../interfaces/credential-store.js';
import { AgentExecutor, AgentExecutionRequest } from '../interfaces/agent-executor.js';
import { DomainMessage, PlainMessage, AIResponseMessage } from '../../presentation/view-models/console/console-use-case.js';

/**
 * Service for creating and executing agents based on worker configurations
 */
export class AgentService implements AgentExecutor {
  private domainMessagesSubject = new Subject<DomainMessage>();

  get domainMessages$(): Observable<DomainMessage> {
    return this.domainMessagesSubject.asObservable();
  }

  constructor(
    private readonly configReader: ConfigReader,
    private readonly agentFactory: AgentFactory,
    private readonly credentialsService: CredentialStore
  ) {}

  /**
   * Execute an agent with the given request and toolbox
   */
  executeAgent(
    request: AgentExecutionRequest, 
    toolbox: Toolbox
  ): Observable<DomainMessage> {
    return new Observable<DomainMessage>((subscriber) => {
      this.executeAgentInternal(request, toolbox, subscriber);
    });
  }

  private async executeAgentInternal(
    request: AgentExecutionRequest,
    toolbox: Toolbox,
    subscriber: any
  ): Promise<void> {
    try {
      const agent = await this.createAgent(request.agentName, toolbox);
      
      // Emit start message after agent creation succeeds
      const startMessage: PlainMessage = {
        id: Date.now().toString(),
        type: 'system',
        content: `Starting ${request.agentName} agent...`,
        timestamp: new Date()
      };
      subscriber.next(startMessage);
      this.domainMessagesSubject.next(startMessage);
      const startTime = Date.now();

      const agentInput: AgentInput = {
        messages: [
          ...(request.context || []),
          {
            id: Date.now().toString(),
            type: 'user',
            content: request.prompt,
            timestamp: new Date()
          }
        ],
        systemPrompt: request.systemPrompt,
        temperature: request.temperature,
        maxTokens: request.maxTokens
      };

      // Subscribe to toolbox domain messages and forward them
      const toolboxSubscription = toolbox.domainMessages$.subscribe({
        next: (domainMessage) => {
          subscriber.next(domainMessage);
          this.domainMessagesSubject.next(domainMessage);
        },
        error: (error) => {
          const errorMessage: PlainMessage = {
            id: Date.now().toString(),
            type: 'system',
            content: `Toolbox Error: ${error.message}`,
            timestamp: new Date()
          };
          subscriber.next(errorMessage);
          this.domainMessagesSubject.next(errorMessage);
        }
      });

      // Subscribe to agent responses and convert to domain messages
      const agentSubscription = agent.processStreamWithIteration(agentInput).subscribe({
        next: (response) => {
          const domainMessage = this.mapAgentMessageToDomainMessage(response.message, request.agentName);
          subscriber.next(domainMessage);
          this.domainMessagesSubject.next(domainMessage);
        },
        error: (error) => {
          const errorMessage: PlainMessage = {
            id: Date.now().toString(),
            type: 'system',
            content: `Agent Error: ${error.message}`,
            timestamp: new Date()
          };
          subscriber.next(errorMessage);
          this.domainMessagesSubject.next(errorMessage);
          subscriber.error(error);
        },
        complete: () => {
          const executionTime = Date.now() - startTime;
          const completionMessage: PlainMessage = {
            id: Date.now().toString(),
            type: 'system',
            content: `Agent execution completed in ${executionTime}ms`,
            timestamp: new Date()
          };
          subscriber.next(completionMessage);
          this.domainMessagesSubject.next(completionMessage);
          
          // Clean up subscriptions
          toolboxSubscription.unsubscribe();
          agentSubscription.unsubscribe();
          subscriber.complete();
        }
      });

    } catch (error) {
      const errorMessage: PlainMessage = {
        id: Date.now().toString(),
        type: 'system',
        content: `Failed to create agent: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date()
      };
      subscriber.next(errorMessage);
      this.domainMessagesSubject.next(errorMessage);
      subscriber.error(error);
    }
  }

  /**
   * Map AgentMessage to appropriate DomainMessage type
   */
  private mapAgentMessageToDomainMessage(message: AgentMessage, agentName: string): DomainMessage {
    switch (message.type) {
      case 'assistant':
      case 'summary':
        return {
          id: message.id,
          type: 'ai-response',
          content: message.content,
          timestamp: message.timestamp,
          metadata: {
            workerId: agentName,
            isStreaming: false
          }
        } as AIResponseMessage;

      case 'thinking':
        return {
          id: message.id,
          type: 'ai-thinking',
          content: message.content,
          timestamp: message.timestamp,
          metadata: {
            workerId: agentName,
            isStreaming: false
          }
        } as AIResponseMessage;

      case 'user':
      case 'system':
      case 'tool':
      default:
        return {
          id: message.id,
          type: 'system',
          content: message.content,
          timestamp: message.timestamp
        } as PlainMessage;
    }
  }

  private async createAgent(agentName: string, toolbox: Toolbox): Promise<Agent> {
    // Get worker configuration
    const workerConfig = await this.configReader.getWorkerConfig(agentName);
    if (!workerConfig) {
      throw new Error(`Worker '${agentName}' not found in configuration`);
    }

    if (!workerConfig.enabled) {
      throw new Error(`Worker '${agentName}' is disabled`);
    }

    // Get credentials for the provider
    const credentials = await this.credentialsService.getProviderCredential(workerConfig.provider);
    if (!credentials?.apiKey) {
      throw new Error(`No API key found for provider '${workerConfig.provider}'`);
    }

    // Create agent configuration
    const agentConfig: AgentConfig = {
      model: workerConfig.model,
      provider: workerConfig.provider,
      apiKey: credentials.apiKey,
      temperature: workerConfig.temperature
    };

    // Create agent using factory
    return this.agentFactory.createAgent(agentConfig, toolbox);
  }
}