import { EmbeddingAgent, EmbeddingAgentFactory, EmbeddingAgentConfig } from '../base-embedding-agent.js';
import { ModelDefinition } from '../../interfaces/agent.js';
import { VoyageEmbeddingAgent } from './voyage-embedding-agent.js';

/**
 * Voyage AI embedding agent factory
 */
export class VoyageEmbeddingFactory implements EmbeddingAgentFactory {
  private readonly models: ModelDefinition[] = [
    // Lightweight models only
    {
      provider: 'voyage',
      model: 'voyage-3-lite',
      alias: 'voyage-lite',
      description: 'Voyage 3 Lite (512 dims, optimized for retrieval)'
    },
    {
      provider: 'voyage',
      model: 'voyage-lite-02-instruct',
      alias: 'voyage-lite-instruct',
      description: 'Voyage Lite 02 Instruct (1024 dims, instruction-tuned)'
    }
  ];

  createEmbeddingAgent(config: EmbeddingAgentConfig): EmbeddingAgent {
    if (!this.supportsProvider(config.provider)) {
      throw new Error(`Provider '${config.provider}' not supported by Voyage embedding factory`);
    }

    if (!this.supportsModel(config.model)) {
      throw new Error(`Model '${config.model}' not supported by Voyage embedding factory`);
    }

    return new VoyageEmbeddingAgent(config);
  }

  supportsProvider(provider: string): boolean {
    return provider === 'voyage';
  }

  getProviderName(): string {
    return 'voyage';
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