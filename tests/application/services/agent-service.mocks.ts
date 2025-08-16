import { BehaviorSubject, Subject, Observable, EMPTY } from 'rxjs';
import { Agent, AgentInput, AgentMessage, AssistantMessage, ThinkingMessage, AgentConfig, AgentFactory, ModelDefinition, AgentResponse } from '../../../src/application/interfaces/agent.js';
import { AgentFactoryRegistry } from '../../../src/application/agents/agent-factory.js';
import { Toolbox } from '../../../src/application/interfaces/toolbox.js';
import { DomainMessage } from '../../../src/presentation/view-models/console/console-use-case.js';

/**
 * Mock Agent for testing AgentService
 */
export class MockAgent implements Agent {
  public processStreamCalled = false;
  public lastInput: AgentInput | null = null;
  public mockMessages: AgentMessage[] = [];
  private messagesSubject = new Subject<AgentResponse>();

  constructor(
    public readonly config: AgentConfig,
    public readonly toolbox: Toolbox
  ) {}

  processStream(input: AgentInput): Observable<AgentResponse> {
    this.processStreamCalled = true;
    this.lastInput = input;

    // Simulate streaming messages
    setTimeout(() => {
      this.mockMessages.forEach(message => {
        // Ensure the message is AssistantMessage or ThinkingMessage
        const responseMessage = message.type === 'thinking' || message.type === 'assistant' 
          ? message as AssistantMessage | ThinkingMessage
          : {
              ...message,
              type: 'assistant' as const
            } as AssistantMessage;
        
        this.messagesSubject.next({ message: responseMessage });
      });
      this.messagesSubject.complete();
    }, 10);

    return this.messagesSubject.asObservable();
  }

  async validateConfig(): Promise<boolean> {
    return true;
  }

  getProvider(): string {
    return this.config.provider;
  }

  setMockMessages(messages: AgentMessage[]): void {
    this.mockMessages = messages;
  }

  reset(): void {
    this.processStreamCalled = false;
    this.lastInput = null;
    this.mockMessages = [];
    this.messagesSubject = new Subject<AgentResponse>();
  }
}

/**
 * Mock AgentFactoryRegistry for testing
 */
export class MockAgentFactoryRegistry implements AgentFactory {
  public createAgentCalled = false;
  public lastConfig: AgentConfig | null = null;
  public lastToolbox: Toolbox | null = null;
  public mockAgent: MockAgent | null = null;

  createAgent(config: AgentConfig, toolbox: Toolbox): Agent {
    this.createAgentCalled = true;
    this.lastConfig = config;
    this.lastToolbox = toolbox;
    
    if (this.mockAgent) {
      return this.mockAgent;
    }
    
    return new MockAgent(config, toolbox);
  }

  supportsProvider(provider: string): boolean {
    return provider === 'test-provider';
  }

  getProviderName(): string {
    return 'test-provider';
  }

  getModels(): ModelDefinition[] {
    return [
      {
        provider: 'test-provider',
        model: 'test-model',
        alias: 'test-alias',
        description: 'Test model for unit testing'
      }
    ];
  }

  supportsModel(modelName: string): boolean {
    return modelName === 'test-model' || modelName === 'test-alias';
  }

  getModelByAlias(alias: string): ModelDefinition | null {
    if (alias === 'test-alias') {
      return this.getModels()[0];
    }
    return null;
  }

  setMockAgent(agent: MockAgent): void {
    this.mockAgent = agent;
  }

  reset(): void {
    this.createAgentCalled = false;
    this.lastConfig = null;
    this.lastToolbox = null;
    this.mockAgent = null;
  }
}

/**
 * Mock Toolbox for testing
 */
export class MockToolbox implements Toolbox {
  public readonly id = 'mock_toolbox';
  public readonly description = 'Mock toolbox for testing';
  public readonly embeddingService = null as any;

  private domainMessagesSubject = new Subject<DomainMessage>();

  get domainMessages$(): Observable<DomainMessage> {
    return this.domainMessagesSubject.asObservable();
  }

  getTools() {
    return [];
  }

  supportsTool() {
    return false;
  }

  async executeTool() {
    return { success: false, error: 'Mock toolbox' };
  }

  emitDomainMessage(message: DomainMessage): void {
    this.domainMessagesSubject.next(message);
  }

  reset(): void {
    this.domainMessagesSubject = new Subject<DomainMessage>();
  }
}

/**
 * Helper function to create test agent messages
 */
export function createTestAgentMessage(
  id: string,
  type: 'user' | 'assistant',
  content: string
): AgentMessage {
  return {
    id,
    type,
    content,
    timestamp: new Date()
  };
}