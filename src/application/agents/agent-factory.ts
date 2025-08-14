import { Agent, AgentFactory, AgentConfig, ModelDefinition } from '../interfaces/agent.js';
import { Toolbox } from '../interfaces/toolbox.js';

/**
 * Registry for agent factories that implements AgentFactory interface
 */
export class AgentFactoryRegistry implements AgentFactory {
  private factories: Map<string, AgentFactory> = new Map();

  registerFactory(factory: AgentFactory): void {
    this.factories.set(factory.getProviderName(), factory);
  }

  // AgentFactory interface implementation
  
  createAgent(config: AgentConfig, toolbox: Toolbox): Agent {
    const factory = this.factories.get(config.provider);
    if (!factory) {
      throw new Error(`No agent factory registered for provider: ${config.provider}`);
    }

    if (!factory.supportsProvider(config.provider)) {
      throw new Error(`Factory does not support provider: ${config.provider}`);
    }

    return factory.createAgent(config, toolbox);
  }

  supportsProvider(provider: string): boolean {
    return this.factories.has(provider);
  }

  getProviderName(): string {
    return 'agent-registry';
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
   * Get all available models from all registered factories
   * @deprecated Use getModels() instead to match AgentFactory interface
   */
  getAllModels(): ModelDefinition[] {
    return this.getModels();
  }

  /**
   * Get models for a specific provider
   */
  getModelsByProvider(provider: string): ModelDefinition[] {
    const factory = this.factories.get(provider);
    return factory ? factory.getModels() : [];
  }

  /**
   * Find a model by alias across all providers
   * @deprecated Use getModelByAlias() instead to match AgentFactory interface
   */


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
}