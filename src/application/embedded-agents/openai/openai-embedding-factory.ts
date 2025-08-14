import { EmbeddingAgent, EmbeddingAgentFactory, EmbeddingAgentConfig } from '../base-embedding-agent.js';
import { ModelDefinition } from '../../interfaces/agent.js';
import { OpenAIEmbeddingAgent } from './openai-embedding-agent.js';

/**
 * OpenAI embedding agent factory
 */
export class OpenAIEmbeddingFactory implements EmbeddingAgentFactory {
  private readonly models: ModelDefinition[] = [
    // Only lightweight embedding models
    {
      provider: 'openai',
      model: 'text-embedding-3-small',
      alias: 'openai-embed-small',
      description: 'OpenAI text-embedding-3-small (1536 dims, cost-effective)'
    },
    {
      provider: 'openai',
      model: 'text-embedding-ada-002',
      alias: 'openai-embed-ada',
      description: 'OpenAI text-embedding-ada-002 (1536 dims, legacy)'
    }
  ];

  createEmbeddingAgent(config: EmbeddingAgentConfig): EmbeddingAgent {
    if (!this.supportsProvider(config.provider)) {
      throw new Error(`Provider '${config.provider}' not supported by OpenAI embedding factory`);
    }

    if (!this.supportsModel(config.model)) {
      throw new Error(`Model '${config.model}' not supported by OpenAI embedding factory`);
    }

    return new OpenAIEmbeddingAgent(config);
  }

  supportsProvider(provider: string): boolean {
    return provider === 'openai';
  }

  getProviderName(): string {
    return 'openai';
  }

  getModels(): ModelDefinition[] {
    return [...this.models];
  }

  supportsModel(modelName: string): boolean {
    return this.models.some(model => model.model === modelName || model.alias === modelName);
  }

  getModelByAlias(alias: string): ModelDefinition | null {
    return this.models.find(model => model.alias === alias) || null;
  }
}