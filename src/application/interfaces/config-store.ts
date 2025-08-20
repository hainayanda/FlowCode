import {
    AgentModelConfig,
    EmbeddingConfig,
    FlowCodeConfig,
    SummarizerConfig,
    TaskmasterConfig,
} from '../models/config';

/**
 * Interface for reading configuration data.
 *
 * Provides access to various configuration objects and methods to fetch
 * the latest configuration from persistent storage.
 */
export interface ConfigReader {
    /** Main FlowCode application configuration */
    config: FlowCodeConfig;

    /** Configuration for the task master component */
    taskMasterConfig: TaskmasterConfig | undefined;

    /** Configuration for conversation summarization */
    summarizerConfig: SummarizerConfig | undefined;

    /** Configuration for embedding/vector operations */
    embeddingConfig: EmbeddingConfig;

    /** Agent configurations */
    agentConfig: Record<string, AgentModelConfig>;

    /** Whether the configuration has been initialized */
    isInitialized: boolean;

    /**
     * Fetches the latest configuration from storage.
     *
     * @returns Promise resolving to the current FlowCode configuration
     */
    fetchConfig(): Promise<FlowCodeConfig>;

    /**
     * Fetches the latest taskmaster configuration from storage.
     *
     * @returns Promise resolving to the current taskmaster configuration
     */
    fetchTaskmasterConfig(): Promise<TaskmasterConfig | undefined>;

    /**
     * Fetches the latest summarizer configuration from storage.
     *
     * @returns Promise resolving to the current summarizer configuration
     */
    fetchSummarizerConfig(): Promise<SummarizerConfig | undefined>;

    /**
     * Fetches the latest embedding configuration from storage.
     *
     * @returns Promise resolving to the current embedding configuration
     */
    fetchEmbeddingConfig(): Promise<EmbeddingConfig>;

    /**
     * Fetches the latest agent configuration from storage.
     *
     * @param name - Name of the agent to fetch
     * @returns Promise resolving to the agent configuration
     */
    fetchAgentConfig(name: string): Promise<AgentModelConfig | undefined>;

    /**
     * Gets an agent configuration by name from the current cached config.
     *
     * @param name - Name of the agent to get
     * @returns Agent configuration or undefined if not found
     */
    getAgentConfig(name: string): AgentModelConfig | undefined;
}

/**
 * Interface for writing configuration data.
 *
 * Provides methods to persist various configuration objects to storage,
 * allowing for runtime configuration updates.
 */
export interface ConfigWriter {
    /**
     * Writes the main FlowCode configuration to storage.
     *
     * @param config - Complete FlowCode configuration to persist
     */
    writeConfig(config: FlowCodeConfig): Promise<void>;

    /**
     * Writes task master configuration to storage.
     *
     * @param config - Task master configuration to persist
     */
    writeTaskmasterConfig(config: TaskmasterConfig): Promise<void>;

    /**
     * Writes summarizer configuration to storage.
     *
     * @param config - Summarizer configuration to persist
     */
    writeSummarizerConfig(config: SummarizerConfig): Promise<void>;

    /**
     * Writes embedding configuration to storage.
     *
     * @param config - Embedding configuration to persist
     */
    writeEmbeddingConfig(config: EmbeddingConfig): Promise<void>;

    /**
     * Writes agent configuration to storage.
     *
     * @param name - Name of the agent
     * @param config - Agent configuration to persist
     */
    writeAgentConfig(name: string, config: AgentModelConfig): Promise<void>;
}

/**
 * Combined interface for reading and writing configuration data.
 */
export interface ConfigStore extends ConfigReader, ConfigWriter {}
