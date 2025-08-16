import { Subject, BehaviorSubject, merge, switchMap, tap, catchError, finalize } from 'rxjs';
import { Agent, AgentInput, AgentMessage, AgentConfig, AgentFactory } from '../interfaces/agent.js';
import { Toolbox } from '../interfaces/toolbox.js';
import { ConfigReader } from '../interfaces/config-store.js';
import { 
  AgentExecutionRequest, 
  AgentExecutionResult, 
  AgentExecutionStatus, 
  AgentExecutionOutput 
} from '../interfaces/agent-execution.js';
import { CredentialStore } from '../interfaces/credential-store.js';

/**
 * Service for creating and executing agents based on worker configurations
 */
export class AgentService {
  private statusSubject = new BehaviorSubject<AgentExecutionStatus>({ status: 'starting' });
  private messagesSubject = new Subject<AgentMessage>();

  constructor(
    private readonly configReader: ConfigReader,
    private readonly agentFactory: AgentFactory,
    private readonly credentialsService: CredentialStore
  ) {}

  /**
   * Execute an agent with the given request and toolbox
   */
  async executeAgent(
    request: AgentExecutionRequest, 
    toolbox: Toolbox
  ): Promise<AgentExecutionOutput> {
    this.statusSubject.next({ status: 'starting', message: `Starting ${request.agentName} agent` });

    try {
      const agent = await this.createAgent(request.agentName, toolbox);
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

      this.statusSubject.next({ status: 'processing', message: 'Processing request...' });

      // Stream agent responses and tool executions
      const messages$ = merge(
        // Agent responses
        agent.processStream(agentInput).pipe(
          tap(response => {
            this.messagesSubject.next(response.message);
          }),
          switchMap(() => []) // Don't pass through, just side effect
        ),
        // Tool execution messages from toolbox
        toolbox.domainMessages$.pipe(
          tap(domainMessage => {
            this.statusSubject.next({ 
              status: 'tool_execution', 
              message: `Executing tool: ${domainMessage.type}` 
            });
          }),
          switchMap(() => []) // Don't pass through, just side effect
        ),
        // Main message stream
        this.messagesSubject.asObservable()
      ).pipe(
        catchError(error => {
          this.statusSubject.next({ 
            status: 'error', 
            message: `Agent execution failed: ${error.message}` 
          });
          throw error;
        }),
        finalize(() => {
          const executionTime = Date.now() - startTime;
          this.statusSubject.next({ 
            status: 'completed', 
            message: `Agent execution completed in ${executionTime}ms` 
          });
        })
      );

      return {
        status: this.statusSubject.asObservable(),
        messages: messages$
      };

    } catch (error) {
      this.statusSubject.next({ 
        status: 'error', 
        message: `Failed to create agent: ${error instanceof Error ? error.message : String(error)}` 
      });
      throw error;
    }
  }

  /**
   * Get execution result summary
   */
  async getExecutionResult(
    request: AgentExecutionRequest,
    executionTime: number,
    success: boolean,
    error?: string
  ): Promise<AgentExecutionResult> {
    const workerConfig = await this.configReader.getWorkerConfig(request.agentName);
    
    return {
      success,
      summary: success 
        ? `${request.agentName} agent executed successfully`
        : `${request.agentName} agent failed: ${error}`,
      executionTime,
      metadata: {
        agentName: request.agentName,
        provider: workerConfig?.provider,
        model: workerConfig?.model,
        temperature: request.temperature || workerConfig?.temperature
      }
    };
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