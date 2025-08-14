import { EmbeddingAgent, EmbeddingAgentFactory, EmbeddingAgentConfig } from '../base-embedding-agent.js';
import { ModelDefinition } from '../../interfaces/agent.js';
import { CohereEmbeddingAgent } from './cohere-embedding-agent.js';

/**
 * Cohere embedding agent factory
 */
export class CohereEmbeddingFactory implements EmbeddingAgentFactory {
  private readonly models: ModelDefinition[] = [
    // Lightweight models only
    {
      provider: 'cohere',
      model: 'embed-english-light-v3.0',
      alias: 'cohere-embed-en-light',
      description: 'Cohere English Light v3.0 (384 dims, fast & efficient)'
    },
    {
      provider: 'cohere',
      model: 'embed-multilingual-light-v3.0',
      alias: 'cohere-embed-multi-light',
      description: 'Cohere Multilingual Light v3.0 (384 dims, 100+ languages)'
    }
  ];

  createEmbeddingAgent(config: EmbeddingAgentConfig): EmbeddingAgent {
    if (!this.supportsProvider(config.provider)) {
      throw new Error(`Provider '${config.provider}' not supported by Cohere embedding factory`);
    }

    if (!this.supportsModel(config.model)) {
      throw new Error(`Model '${config.model}' not supported by Cohere embedding factory`);
    }

    return new CohereEmbeddingAgent(config);
  }

  supportsProvider(provider: string): boolean {
    return provider === 'cohere';
  }

  getProviderName(): string {
    return 'cohere';
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