import { EmbeddingService } from '../interfaces/embedding-service.js';
import { EmbeddingConfig } from '../interfaces/config-store.js';
import { ModelDefinition } from '../interfaces/agent.js';

/**
 * Embedding agent configuration extending base embedding config
 */
export interface EmbeddingAgentConfig extends EmbeddingConfig {
  apiKey: string;
  baseUrl?: string;
}

/**
 * Base embedding agent interface following the agent pattern
 */
export interface EmbeddingAgent extends EmbeddingService {
  /**
   * Validate embedding agent configuration
   */
  validateConfig(): Promise<boolean>;

  /**
   * Get provider name
   */
  getProvider(): string;

  /**
   * Get model name
   */
  getModel(): string;
}

/**
 * Abstract base embedding agent implementation
 */
export abstract class BaseEmbeddingAgent implements EmbeddingAgent {
  protected config: EmbeddingAgentConfig;

  constructor(config: EmbeddingAgentConfig) {
    this.config = config;
  }

  abstract generateEmbedding(text: string): Promise<number[]>;
  abstract isAvailable(): Promise<boolean>;
  abstract getEmbeddingDimension(): number;

  async validateConfig(): Promise<boolean> {
    return !!(this.config.apiKey && this.config.model && this.config.provider);
  }

  getProvider(): string {
    return this.config.provider;
  }

  getModel(): string {
    return this.config.model;
  }
}

/**
 * Embedding agent factory interface following agent factory pattern
 */
export interface EmbeddingAgentFactory {
  createEmbeddingAgent(config: EmbeddingAgentConfig): EmbeddingAgent;
  supportsProvider(provider: string): boolean;
  getProviderName(): string;
  getModels(): ModelDefinition[];
  supportsModel(modelName: string): boolean;
  getModelByAlias(alias: string): ModelDefinition | null;
}