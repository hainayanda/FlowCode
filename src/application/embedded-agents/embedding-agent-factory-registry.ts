import { ModelDefinition } from '../interfaces/agent.js';
import { EmbeddingAgent, EmbeddingAgentFactory, EmbeddingAgentConfig } from './base-embedding-agent.js';

/**
 * Registry for embedding agent factories that implements EmbeddingAgentFactory interface
 */
export class EmbeddingAgentFactoryRegistry implements EmbeddingAgentFactory {
  private factories: Map<string, EmbeddingAgentFactory> = new Map();

  registerFactory(factory: EmbeddingAgentFactory): void {
    this.factories.set(factory.getProviderName(), factory);
  }

  // EmbeddingAgentFactory interface implementation
  
  createEmbeddingAgent(config: EmbeddingAgentConfig): EmbeddingAgent {
    const factory = this.factories.get(config.provider);
    if (!factory) {
      throw new Error(`No embedding agent factory registered for provider: ${config.provider}`);
    }

    if (!factory.supportsProvider(config.provider)) {
      throw new Error(`Factory does not support provider: ${config.provider}`);
    }

    return factory.createEmbeddingAgent(config);
  }

  supportsProvider(provider: string): boolean {
    return this.factories.has(provider);
  }

  getProviderName(): string {
    return 'embedding-registry';
  }

  getModels(): ModelDefinition[] {
    const allModels: ModelDefinition[] = [];
    for (const factory of this.factories.values()) {
      allModels.push(...factory.getModels());
    }
    return allModels;
  }

  supportsModel(modelName: string): boolean {
    for (const factory of this.factories.values()) {
      if (factory.supportsModel(modelName)) {
        return true;
      }
    }
    return false;
  }

  getModelByAlias(alias: string): ModelDefinition | null {
    for (const factory of this.factories.values()) {
      const model = factory.getModelByAlias(alias);
      if (model) {
        return model;
      }
    }
    return null;
  }

  // Additional registry-specific methods

  getSupportedProviders(): string[] {
    return Array.from(this.factories.keys());
  }

  hasProvider(provider: string): boolean {
    return this.factories.has(provider);
  }

  /**
   * Get models for a specific provider
   */
  getModelsByProvider(provider: string): ModelDefinition[] {
    const factory = this.factories.get(provider);
    return factory ? factory.getModels() : [];
  }

  /**
   * Get the provider for a given model name or alias
   */
  getProviderForModel(modelName: string): string | null {
    for (const factory of this.factories.values()) {
      if (factory.supportsModel(modelName)) {
        return factory.getProviderName();
      }
    }
    return null;
  }

  /**
   * Resolve alias to actual model name
   */
  resolveModelName(aliasOrModel: string): string | null {
    // First check if it's an alias
    const modelByAlias = this.getModelByAlias(aliasOrModel);
    if (modelByAlias) {
      return modelByAlias.model;
    }

    // Check if it's already a valid model name
    if (this.supportsModel(aliasOrModel)) {
      return aliasOrModel;
    }

    return null;
  }

  /**
   * Get all registered factories
   */
  getFactories(): EmbeddingAgentFactory[] {
    return Array.from(this.factories.values());
  }
}