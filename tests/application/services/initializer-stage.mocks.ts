import { AgentFactory, AgentConfig, Agent, ModelDefinition } from '../../../src/application/interfaces/agent.js';
import { EmbeddingAgentFactory, EmbeddingAgentConfig, EmbeddingAgent } from '../../../src/application/embedded-agents/base-embedding-agent.js';
import { CredentialReader, ProviderCredential } from '../../../src/application/interfaces/credential-store.js';
import { Toolbox, ToolDefinition, ToolCall, ToolResult, ToolboxMessage } from '../../../src/application/interfaces/toolbox.js';
import { Observable, of, Subject } from 'rxjs';
import { DomainMessage } from '../../../src/presentation/view-models/console/console-use-case.js';

export class MockAgentFactory implements AgentFactory {
  public createAgentCalled = false;
  public lastAgentConfig: AgentConfig | null = null;

  private models: ModelDefinition[] = [
    { provider: 'openai', model: 'gpt-4', alias: 'GPT-4', description: 'OpenAI GPT-4' },
    { provider: 'anthropic', model: 'claude-3-sonnet', alias: 'Claude 3 Sonnet', description: 'Anthropic Claude 3 Sonnet' },
    { provider: 'google', model: 'gemini-pro', alias: 'Gemini Pro', description: 'Google Gemini Pro' }
  ];

  createAgent(config: AgentConfig, toolbox: Toolbox): Agent {
    this.createAgentCalled = true;
    this.lastAgentConfig = config;
    return new MockAgent(config);
  }

  supportsProvider(provider: string): boolean {
    return ['openai', 'anthropic', 'google'].includes(provider);
  }

  getProviderName(): string {
    return 'mock-factory';
  }

  getModels(): ModelDefinition[] {
    return this.models;
  }

  supportsModel(modelName: string): boolean {
    return this.models.some(m => m.model === modelName);
  }

  getModelByAlias(alias: string): ModelDefinition | null {
    return this.models.find(m => m.alias === alias) || null;
  }
}

export class MockAgent implements Agent {
  constructor(private config: AgentConfig) {}

  processStream(): Observable<any> {
    return of({
      message: {
        id: '1',
        type: 'assistant',
        content: 'Mock response',
        timestamp: new Date()
      },
      finishReason: 'stop'
    });
  }

  async validateConfig(): Promise<boolean> {
    return true;
  }

  getProvider(): string {
    return this.config.provider;
  }
}

export class MockEmbeddingAgentFactory implements EmbeddingAgentFactory {
  public createEmbeddingAgentCalled = false;
  public lastEmbeddingAgentConfig: EmbeddingAgentConfig | null = null;

  private models: ModelDefinition[] = [
    { provider: 'openai', model: 'text-embedding-3-small', alias: 'OpenAI Small Embedding', description: 'OpenAI text-embedding-3-small' },
    { provider: 'cohere', model: 'embed-english-v3.0', alias: 'Cohere English v3', description: 'Cohere embedding model' }
  ];

  createEmbeddingAgent(config: EmbeddingAgentConfig): EmbeddingAgent {
    this.createEmbeddingAgentCalled = true;
    this.lastEmbeddingAgentConfig = config;
    return new MockEmbeddingAgent(config);
  }

  supportsProvider(provider: string): boolean {
    return ['openai', 'cohere'].includes(provider);
  }

  getProviderName(): string {
    return 'mock-embedding-factory';
  }

  getModels(): ModelDefinition[] {
    return this.models;
  }

  supportsModel(modelName: string): boolean {
    return this.models.some(m => m.model === modelName);
  }

  getModelByAlias(alias: string): ModelDefinition | null {
    return this.models.find(m => m.alias === alias) || null;
  }
}

export class MockEmbeddingAgent implements EmbeddingAgent {
  constructor(private config: EmbeddingAgentConfig) {}

  async generateEmbedding(text: string): Promise<number[]> {
    return new Array(1536).fill(0).map(() => Math.random());
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  getEmbeddingDimension(): number {
    return 1536;
  }

  async validateConfig(): Promise<boolean> {
    return true;
  }

  getProvider(): string {
    return this.config.provider;
  }

  getModel(): string {
    return this.config.model;
  }
}

export class MockCredentialReader implements CredentialReader {
  public getCredentialsCalled = false;
  public getProviderCredentialCalled = false;
  public hasCredentialCalled = false;
  public lastProviderQueried: string | null = null;

  private credentials: Record<string, ProviderCredential> = {
    openai: { apiKey: 'sk-test-openai-key', lastUsed: '2023-01-01T00:00:00.000Z' },
    anthropic: { apiKey: 'sk-ant-test-key', lastUsed: '2023-01-01T00:00:00.000Z' }
  };

  async getCredentials() {
    this.getCredentialsCalled = true;
    return this.credentials;
  }

  async getProviderCredential(provider: string): Promise<ProviderCredential | null> {
    this.getProviderCredentialCalled = true;
    this.lastProviderQueried = provider;
    return this.credentials[provider] || null;
  }

  async getAllProviders(): Promise<string[]> {
    return Object.keys(this.credentials);
  }

  async hasCredential(provider: string): Promise<boolean> {
    this.hasCredentialCalled = true;
    this.lastProviderQueried = provider;
    return provider in this.credentials;
  }

  async credentialsExist(): Promise<boolean> {
    return true;
  }

  getCredentialsPath(): string {
    return '/mock/credentials.json';
  }

  // Helper methods for testing
  setCredential(provider: string, credential: ProviderCredential): void {
    this.credentials[provider] = credential;
  }

  removeCredential(provider: string): void {
    delete this.credentials[provider];
  }

  clearCredentials(): void {
    this.credentials = {};
  }
}

export class MockToolbox implements Toolbox {
  readonly id = 'mock-toolbox';
  readonly description = 'Mock toolbox for testing';
  readonly embeddingService: any = null;

  public executeToolCalled = false;
  public lastToolCall: ToolCall | null = null;
  private domainMessagesSubject = new Subject<DomainMessage>();

  private tools: ToolDefinition[] = [
    {
      name: 'workspace_analyze',
      description: 'Analyze workspace structure',
      parameters: [],
      permission: 'loose'
    },
    {
      name: 'file_write',
      description: 'Write file content',
      parameters: [
        { name: 'path', type: 'string', description: 'File path', required: true },
        { name: 'content', type: 'string', description: 'File content', required: true }
      ],
      permission: 'loose'
    }
  ];

  get messages$(): Observable<ToolboxMessage> {
    return of();
  }

  get domainMessages$(): Observable<DomainMessage> {
    return this.domainMessagesSubject.asObservable();
  }

  getTools(): ToolDefinition[] {
    return this.tools;
  }

  supportsTool(toolName: string): boolean {
    return this.tools.some(t => t.name === toolName);
  }

  async executeTool(toolCall: ToolCall): Promise<ToolResult> {
    this.executeToolCalled = true;
    this.lastToolCall = toolCall;
    
    // Create appropriate DomainMessage based on tool type
    let domainMessage;
    
    if (toolCall.name.includes('file')) {
      // For file operations, return a file operation message
      domainMessage = {
        id: Date.now().toString(),
        type: 'file-operation' as const,
        content: `Mock file operation: ${toolCall.name}`,
        timestamp: new Date(),
        metadata: {
          filePath: toolCall.parameters.path || '/mock/path',
          fileOperation: 'edit' as const,
          totalLinesAdded: 5,
          totalLinesRemoved: 2
        }
      };
    } else {
      // For other tools, return a system message
      domainMessage = {
        id: Date.now().toString(),
        type: 'system' as const,
        content: `✓ Tool executed successfully: ${toolCall.name}`,
        timestamp: new Date()
      };
    }
    
    return {
      success: true,
      data: `Mock result for ${toolCall.name}`,
      message: domainMessage
    };
  }
}