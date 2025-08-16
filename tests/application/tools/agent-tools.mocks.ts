import { BehaviorSubject, Subject, Observable, of } from 'rxjs';
import { AgentService } from '../../../src/application/services/agent-service.js';
import { EmbeddingService } from '../../../src/application/interfaces/embedding-service.js';
import { 
  AgentExecutionRequest, 
  AgentExecutionResult, 
  AgentExecutionStatus,
  AgentExecutionOutput 
} from '../../../src/application/interfaces/agent-execution.js';
import { AgentMessage, AgentFactory } from '../../../src/application/interfaces/agent.js';
import { Toolbox } from '../../../src/application/interfaces/toolbox.js';
import { DomainMessage } from '../../../src/presentation/view-models/console/console-use-case.js';
import { ConfigReader } from '../../../src/application/interfaces/config-store.js';
import { CredentialStore } from '../../../src/application/interfaces/credential-store.js';

/**
 * Mock AgentService for testing AgentTools
 */
export class MockAgentService extends AgentService {
  public executeAgentCalled = false;
  public getExecutionResultCalled = false;
  public lastRequest: AgentExecutionRequest | null = null;
  public lastToolbox: Toolbox | null = null;
  public mockExecutionOutput: AgentExecutionOutput | null = null;
  public mockExecutionResult: AgentExecutionResult | null = null;

  constructor() {
    // Create mock instances for the parent constructor
    const mockConfigReader = {} as ConfigReader;
    const mockAgentFactory = {} as AgentFactory;
    const mockCredentialsService = {} as CredentialStore;
    
    super(mockConfigReader, mockAgentFactory, mockCredentialsService);
  }

  async executeAgent(request: AgentExecutionRequest, toolbox: Toolbox): Promise<AgentExecutionOutput> {
    this.executeAgentCalled = true;
    this.lastRequest = request;
    this.lastToolbox = toolbox;

    if (this.mockExecutionOutput) {
      return this.mockExecutionOutput;
    }

    // Default mock execution output
    const statusSubject = new BehaviorSubject<AgentExecutionStatus>({ status: 'starting' });
    const messagesSubject = new Subject<AgentMessage>();

    // Simulate execution flow
    setTimeout(() => {
      statusSubject.next({ status: 'processing', message: 'Processing request...' });
      messagesSubject.next({
        id: 'msg-1',
        type: 'assistant',
        content: 'Mock agent response',
        timestamp: new Date()
      });
      statusSubject.next({ status: 'completed', message: 'Execution completed' });
      messagesSubject.complete();
    }, 10);

    return {
      status: statusSubject.asObservable(),
      messages: messagesSubject.asObservable()
    };
  }

  async getExecutionResult(
    request: AgentExecutionRequest,
    executionTime: number,
    success: boolean,
    error?: string
  ): Promise<AgentExecutionResult> {
    this.getExecutionResultCalled = true;

    if (this.mockExecutionResult) {
      return this.mockExecutionResult;
    }

    // Default mock result
    return {
      success,
      summary: success 
        ? `${request.agentName} agent executed successfully`
        : `${request.agentName} agent failed: ${error}`,
      executionTime,
      metadata: {
        agentName: request.agentName,
        provider: 'mock-provider',
        model: 'mock-model'
      }
    };
  }

  setMockExecutionOutput(output: AgentExecutionOutput): void {
    this.mockExecutionOutput = output;
  }

  setMockExecutionResult(result: AgentExecutionResult): void {
    this.mockExecutionResult = result;
  }

  simulateError(errorMessage: string): void {
    // Override executeAgent to throw an error
    this.executeAgent = async () => {
      throw new Error(errorMessage);
    };
  }

  reset(): void {
    this.executeAgentCalled = false;
    this.getExecutionResultCalled = false;
    this.lastRequest = null;
    this.lastToolbox = null;
    this.mockExecutionOutput = null;
    this.mockExecutionResult = null;
  }
}

/**
 * Mock EmbeddingService for testing
 */
export class MockEmbeddingService implements EmbeddingService {
  async generateEmbedding(text: string): Promise<number[]> {
    return [0.1, 0.2, 0.3];
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  getEmbeddingDimension(): number {
    return 3;
  }

  async generateEmbeddings(): Promise<number[][]> {
    return [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]];
  }
}

/**
 * Mock Toolbox for testing AgentTools
 */
export class MockWorkerToolbox implements Toolbox {
  public readonly id = 'mock_worker_toolbox';
  public readonly description = 'Mock worker toolbox for testing';
  public readonly embeddingService: EmbeddingService = new MockEmbeddingService();

  public executeToolCalled = false;
  public lastToolCall: any = null;
  public mockToolResult: any = { success: true, data: 'mock result' };
  
  private domainMessagesSubject = new Subject<DomainMessage>();

  get domainMessages$(): Observable<DomainMessage> {
    return this.domainMessagesSubject.asObservable();
  }

  getTools() {
    return [
      {
        name: 'mock_tool',
        description: 'Mock tool for testing',
        parameters: [],
        permission: 'loose' as const
      }
    ];
  }

  supportsTool(toolName: string): boolean {
    return toolName === 'mock_tool';
  }

  async executeTool(toolCall: any): Promise<any> {
    this.executeToolCalled = true;
    this.lastToolCall = toolCall;
    return this.mockToolResult;
  }

  setMockToolResult(result: any): void {
    this.mockToolResult = result;
  }

  emitDomainMessage(message: DomainMessage): void {
    this.domainMessagesSubject.next(message);
  }

  reset(): void {
    this.executeToolCalled = false;
    this.lastToolCall = null;
    this.mockToolResult = { success: true, data: 'mock result' };
    this.domainMessagesSubject = new Subject<DomainMessage>();
  }
}

/**
 * Helper function to create test tool calls
 */
export function createTestToolCall(
  name: string,
  parameters: Record<string, any>
) {
  return {
    name,
    parameters,
    id: `test-${Date.now()}`
  };
}