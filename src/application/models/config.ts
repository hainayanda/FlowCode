/**
 * Base configuration interface for AI models.
 * Contains the essential identifiers needed to specify a model and its provider.
 */
export interface ModelConfig {
    /** The specific model identifier */
    model: string;

    /** The AI provider (e.g., 'openai', 'anthropic', 'google') */
    provider: string;
}

/**
 * Configuration for the task master component.
 *
 * Controls how conversation context is managed and built for processing,
 * including limits on message history and recency requirements.
 */
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

/**
 * Base configuration for agent models.
 *
 * Contains authentication and operational parameters needed
 * to interact with AI model providers.
 */
export interface AgentModelConfig extends ModelConfig {
    /** API key for authenticating with the provider */
    apiKey: string;

    /** Maximum tokens to generate in response */
    maxTokens?: number;

    /** Custom base URL for API requests */
    baseUrl?: string;

    /** Maximum number of iterations for tool calling */
    maxIterations?: number;
}

/**
 * Azure-specific agent model configuration.
 *
 * Extends base agent configuration with Azure OpenAI Service
 * specific parameters for deployment and API versioning.
 */
export interface AzureAgentModelConfig extends AgentModelConfig {
    /** Azure resource name for the OpenAI service */
    resourceName?: string;

    /** Deployment name within the Azure resource */
    deploymentName?: string;

    /** API version to use for Azure OpenAI calls */
    apiVersion?: string;
}

/**
 * OpenRouter-specific agent model configuration.
 *
 * Extends base agent configuration with OpenRouter gateway
 * specific parameters for routing and application identification.
 */
export interface OpenRouterAgentModelConfig extends AgentModelConfig {
    /** Referer header for OpenRouter requests */
    referer?: string;

    /** Application name for OpenRouter identification */
    appName?: string;
}

/**
 * Configuration for conversation summarization.
 *
 * Combines all provider-specific configurations to support
 * summarization through various AI providers with enable/disable control.
 */
export interface SummarizerConfig
    extends AgentModelConfig,
        AzureAgentModelConfig,
        OpenRouterAgentModelConfig {
    /** Whether summarization is enabled */
    enabled: boolean;
}

/**
 * Configuration for embedding operations.
 *
 * Controls whether vector embedding functionality is enabled
 * for semantic search and similarity operations.
 */
export interface EmbeddingConfig {
    /** Whether embedding functionality is enabled */
    enabled: boolean;
}

/**
 * Main FlowCode application configuration.
 *
 * Contains all component configurations needed to run the FlowCode system,
 * including task master, summarizer, and embedding settings.
 */
export interface FlowCodeConfig {
    /** Configuration format version */
    version: string;

    /** Task master component configuration */
    taskmaster?: TaskmasterConfig;

    /** Summarizer component configuration */
    summarizer?: SummarizerConfig;

    /** Embedding component configuration */
    embedding: EmbeddingConfig;

    /** Agent configurations */
    agents?: Record<string, AgentModelConfig>;
}
