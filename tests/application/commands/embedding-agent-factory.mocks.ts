import { EmbeddingAgentFactory, EmbeddingAgent, EmbeddingAgentConfig } from '../../../src/application/embedded-agents/base-embedding-agent.js';
import { ModelDefinition } from '../../../src/application/interfaces/agent.js';

export class EmbeddingAgentMock implements EmbeddingAgent {
  readonly provider = 'mock';
  readonly model = 'mock-embedding';
  
  generateEmbeddingCalled = false;
  lastText: string | null = null;

  async generateEmbedding(text: string): Promise<number[]> {
    this.generateEmbeddingCalled = true;
    this.lastText = text;
    return [0.1, 0.2, 0.3];
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  getEmbeddingDimension(): number {
    return 3;
  }

  async validateConfig(): Promise<boolean> {
    return true;
  }

  getProvider(): string {
    return this.provider;
  }

  getModel(): string {
    return this.model;
  }
}

export class EmbeddingAgentFactoryMock implements EmbeddingAgentFactory {
  readonly provider = 'mock';
  
  createEmbeddingAgentCalled = false;
  getModelsCalled = false;
  private mockAgent = new EmbeddingAgentMock();

  createEmbeddingAgent(_config: EmbeddingAgentConfig): EmbeddingAgent {
    this.createEmbeddingAgentCalled = true;
    return this.mockAgent;
  }

  supportsProvider(provider: string): boolean {
    return provider === 'mock';
  }

  getProviderName(): string {
    return this.provider;
  }

  getModels(): ModelDefinition[] {
    this.getModelsCalled = true;
    return [
      {
        model: 'mock-embedding-small',
        alias: 'Mock Small',
        provider: 'mock',
        description: 'Small mock embedding model'
      },
      {
        model: 'mock-embedding-large', 
        alias: 'Mock Large',
        provider: 'mock',
        description: 'Large mock embedding model'
      }
    ];
  }

  supportsModel(modelName: string): boolean {
    return modelName.startsWith('mock-embedding');
  }

  getModelByAlias(alias: string): ModelDefinition | null {
    const models = this.getModels();
    return models.find(m => m.alias === alias) || null;
  }

  getMockAgent(): EmbeddingAgentMock {
    return this.mockAgent;
  }
}