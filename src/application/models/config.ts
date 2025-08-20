export interface ModelConfig {
  model: string;
  provider: string;
}

export interface TaskmasterConfig extends ModelConfig {
  // Inherits model, provider
  /**
   * Maximum number of messages to include in context building
   * Defaults to 100 if not specified
   */
  maxContext?: number;
  /**
   * Minimum recent tail messages to always include (recency tail)
   * Defaults to 5 if not specified
   */
  minContext?: number;
}

export interface AgentModelConfig extends ModelConfig {
  apiKey: string;
  maxTokens?: number;
  baseUrl?: string;
  maxIterations?: number;
}

export interface AzureAgentModelConfig extends AgentModelConfig {
  resourceName?: string;
  deploymentName?: string;
  apiVersion?: string;
}

export interface OpenRouterAgentModelConfig extends AgentModelConfig {
  referer?: string;
  appName?: string;
}

export interface SummarizerConfig extends AgentModelConfig, AzureAgentModelConfig, OpenRouterAgentModelConfig {
  enabled: boolean;
}

export interface EmbeddingConfig {
  enabled: boolean;
}

export interface FlowCodeConfig {
  version: string;
  taskmaster: TaskmasterConfig;
  summarizer: SummarizerConfig;
  embedding: EmbeddingConfig;
}