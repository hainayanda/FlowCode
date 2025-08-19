export interface AgentModelConfig {
  model: string;
  provider: string;
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
