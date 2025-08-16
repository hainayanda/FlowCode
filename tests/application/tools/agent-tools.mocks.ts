import { BehaviorSubject, Subject, Observable, of } from 'rxjs';
import { EmbeddingService } from '../../../src/application/interfaces/embedding-service.js';
import { Toolbox } from '../../../src/application/interfaces/toolbox.js';
import { DomainMessage, PlainMessage, AIResponseMessage } from '../../../src/presentation/view-models/console/console-use-case.js';
import { AgentExecutor, AgentExecutionRequest } from '../../../src/application/interfaces/agent-executor.js';

/**
 * Mock AgentExecutor for testing AgentTools
 */
export class MockAgentExecutor implements AgentExecutor {
  public executeAgentCalled = false;
  public lastRequest: AgentExecutionRequest | null = null;
  public lastToolbox: Toolbox | null = null;
  public shouldSimulateError = false;
  public simulatedErrorMessage = '';

  private domainMessagesSubject = new Subject<DomainMessage>();

  get domainMessages$(): Observable<DomainMessage> {
    return this.domainMessagesSubject.asObservable();
  }

  executeAgent(request: AgentExecutionRequest, toolbox: Toolbox): Observable<DomainMessage> {
    this.executeAgentCalled = true;
    this.lastRequest = request;
    this.lastToolbox = toolbox;

    return new Observable<DomainMessage>((subscriber) => {
      if (this.shouldSimulateError) {
        setTimeout(() => {
          const errorMessage: PlainMessage = {
            id: 'error-1',
            type: 'system',
            content: `Agent Error: ${this.simulatedErrorMessage}`,
            timestamp: new Date()
          };
          subscriber.next(errorMessage);
          this.domainMessagesSubject.next(errorMessage);
          subscriber.error(new Error(this.simulatedErrorMessage));
        }, 10);
        return;
      }

      // Simulate normal execution flow
      setTimeout(() => {
        // Start message
        const startMessage: PlainMessage = {
          id: 'start-1',
          type: 'system',
          content: `Starting ${request.agentName} agent...`,
          timestamp: new Date()
        };
        subscriber.next(startMessage);
        this.domainMessagesSubject.next(startMessage);

        // Agent response
        const agentResponse: AIResponseMessage = {
          id: 'agent-1',
          type: 'ai-response',
          content: 'Mock agent response',
          timestamp: new Date(),
          metadata: {
            workerId: request.agentName,
            isStreaming: false
          }
        };
        subscriber.next(agentResponse);
        this.domainMessagesSubject.next(agentResponse);

        // Summary message
        const summaryResponse: AIResponseMessage = {
          id: 'summary-1',
          type: 'ai-response',
          content: `Task completed successfully. Summary: ${request.agentName} executed the requested task.`,
          timestamp: new Date(),
          metadata: {
            workerId: request.agentName,
            isStreaming: false
          }
        };
        subscriber.next(summaryResponse);
        this.domainMessagesSubject.next(summaryResponse);

        // Completion message
        const completionMessage: PlainMessage = {
          id: 'complete-1',
          type: 'system',
          content: `Agent execution completed in 50ms`,
          timestamp: new Date()
        };
        subscriber.next(completionMessage);
        this.domainMessagesSubject.next(completionMessage);

        subscriber.complete();
      }, 10);
    });
  }

  simulateError(errorMessage: string): void {
    this.shouldSimulateError = true;
    this.simulatedErrorMessage = errorMessage;
  }

  reset(): void {
    this.executeAgentCalled = false;
    this.lastRequest = null;
    this.lastToolbox = null;
    this.shouldSimulateError = false;
    this.simulatedErrorMessage = '';
    this.domainMessagesSubject = new Subject<DomainMessage>();
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