import { EmbeddingAgent, EmbeddingAgentFactory, EmbeddingAgentConfig } from '../base-embedding-agent.js';
import { ModelDefinition } from '../../interfaces/agent.js';
import { JinaEmbeddingAgent } from './jina-embedding-agent.js';

/**
 * Jina AI embedding agent factory
 */
export class JinaEmbeddingFactory implements EmbeddingAgentFactory {
  private readonly models: ModelDefinition[] = [
    // Lightweight models only
    {
      provider: 'jina',
      model: 'jina-clip-v2',
      alias: 'jina-clip',
      description: 'Jina CLIP v2 (768 dims, multimodal text/image)'
    },
    {
      provider: 'jina',
      model: 'jina-embeddings-v3',
      alias: 'jina-embed-v3',
      description: 'Jina Embeddings v3 (1024 dims, multilingual)'
    }
  ];

  createEmbeddingAgent(config: EmbeddingAgentConfig): EmbeddingAgent {
    if (!this.supportsProvider(config.provider)) {
      throw new Error(`Provider '${config.provider}' not supported by Jina embedding factory`);
    }

    if (!this.supportsModel(config.model)) {
      throw new Error(`Model '${config.model}' not supported by Jina embedding factory`);
    }

    return new JinaEmbeddingAgent(config);
  }

  supportsProvider(provider: string): boolean {
    return provider === 'jina';
  }

  getProviderName(): string {
    return 'jina';
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