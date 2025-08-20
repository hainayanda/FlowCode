import {
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
    taskMasterConfig: TaskmasterConfig;

    /** Configuration for conversation summarization */
    summarizerConfig: SummarizerConfig;

    /** Configuration for embedding/vector operations */
    embeddingConfig: EmbeddingConfig;

    /**
     * Fetches the latest configuration from storage.
     *
     * @returns Promise resolving to the current FlowCode configuration
     */
    fetchConfig(): Promise<FlowCodeConfig>;
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
}
