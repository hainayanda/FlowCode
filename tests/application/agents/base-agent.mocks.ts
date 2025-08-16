import { Observable, EMPTY, of } from 'rxjs';
import { BaseAgent } from '../../../src/application/agents/base-agent.js';
import { AgentConfig, AgentInput, AgentResponse, SummaryMessage } from '../../../src/application/interfaces/agent.js';
import { Toolbox, ToolDefinition, ToolCall, ToolResult } from '../../../src/application/interfaces/toolbox.js';
import { EmbeddingService } from '../../../src/application/interfaces/embedding-service.js';
import { DomainMessage } from '../../../src/presentation/view-models/console/console-use-case.js';

/**
 * Mock Embedding Service for testing
 */
export class MockEmbeddingService implements EmbeddingService {
  provider = 'mock';
  model = 'mock-model';
  dimensions = 384;

  async generateEmbedding(): Promise<number[]> {
    return [0.1, 0.2, 0.3];
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  getEmbeddingDimension(): number {
    return this.dimensions;
  }

  async embed(): Promise<number[]> {
    return [0.1, 0.2, 0.3];
  }

  async batchEmbed(): Promise<number[][]> {
    return [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]];
  }
}

/**
 * Mock Toolbox for testing
 */
export class MockToolbox implements Toolbox {
  readonly id = 'mock-toolbox';
  readonly description = 'Mock toolbox for testing';
  readonly domainMessages$ = EMPTY as Observable<DomainMessage>;
  readonly embeddingService = new MockEmbeddingService();

  executeToolCalled = false;
  lastToolCall: ToolCall | null = null;
  toolExecutionResult: ToolResult = { success: true, message: 'Mock execution' };

  getTools(): ToolDefinition[] {
    return [
      {
        name: 'mock-tool',
        description: 'A mock tool for testing',
        parameters: [
          {
            name: 'input',
            type: 'string',
            description: 'Input parameter',
            required: true
          }
        ],
        permission: 'loose'
      }
    ];
  }

  supportsTool(toolName: string): boolean {
    return toolName === 'mock-tool';
  }

  async executeTool(toolCall: ToolCall): Promise<ToolResult> {
    this.executeToolCalled = true;
    this.lastToolCall = toolCall;
    return this.toolExecutionResult;
  }
}

/**
 * Mock Agent implementation for testing
 */
export class MockAgent extends BaseAgent {
  processStreamCalled = false;
  processStreamCallCount = 0;
  lastInput: AgentInput | null = null;
  mockResponses: AgentResponse[] = [];
  currentResponseIndex = 0;
  
  mockResponse: AgentResponse = {
    message: {
      id: 'mock-response-id',
      type: 'assistant',
      content: 'Mock response',
      timestamp: new Date()
    }
  };

  processStream(input: AgentInput): Observable<AgentResponse> {
    this.processStreamCalled = true;
    this.processStreamCallCount++;
    this.lastInput = input;
    
    // If mockResponses is set, return the next response in sequence
    if (this.mockResponses.length > 0) {
      const response = this.mockResponses[this.currentResponseIndex % this.mockResponses.length];
      this.currentResponseIndex++;
      return of(response);
    }
    
    return of(this.mockResponse);
  }

  setMockResponses(responses: AgentResponse[]): void {
    this.mockResponses = responses;
    this.currentResponseIndex = 0;
  }

  reset(): void {
    this.processStreamCalled = false;
    this.processStreamCallCount = 0;
    this.lastInput = null;
    this.mockResponses = [];
    this.currentResponseIndex = 0;
  }

}

/**
 * Helper function to create mock agent config
 */
export function createMockAgentConfig(): AgentConfig {
  return {
    model: 'mock-model',
    provider: 'mock-provider',
    apiKey: 'mock-api-key',
    temperature: 0.7,
    maxTokens: 4096,
    baseUrl: 'https://mock-api.com'
  };
}

/**
 * Helper function to create mock agent input
 */
export function createMockAgentInput(): AgentInput {
  return {
    messages: [
      {
        id: 'msg-1',
        type: 'user',
        content: 'Hello, world!',
        timestamp: new Date()
      }
    ],
    systemPrompt: 'You are a helpful assistant',
    temperature: 0.5,
    maxTokens: 2048,
    tools: [
      {
        name: 'test-tool',
        description: 'A test tool',
        parameters: { type: 'string' }
      }
    ]
  };
}