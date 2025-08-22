import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createFlowcodeDirectoryIfNeeded } from '../../common/utils/flowcode-directory';
import { ConfigStore } from './interfaces/config-store';
import {
    AgentModelConfig,
    EmbeddingConfig,
    FlowCodeConfig,
    SummarizerConfig,
    TaskmasterConfig,
} from './models/config';

/**
 * File-based configuration repository.
 *
 * Manages configuration persistence through config.json in the .flowcode directory
 * at the workspace root. Provides caching for efficient access and ensures data
 * consistency through read-after-write operations. Emits events when configurations change.
 */
export class ConfigRepository extends EventEmitter implements ConfigStore {
    private _config: FlowCodeConfig = {
        version: '1.0.0',
        embedding: {
            enabled: true,
        },
    };
    private readonly configPath: string;
    private readonly workspaceRoot: string;

    /**
     * Creates a new ConfigRepository instance.
     *
     * @param workspaceRoot - The root directory of the workspace (process.cwd())
     */
    constructor(workspaceRoot: string = process.cwd()) {
        super();
        this.workspaceRoot = workspaceRoot;
        this.configPath = path.join(workspaceRoot, '.flowcode', 'config.json');
    }

    get config(): FlowCodeConfig {
        return this._config;
    }

    /** Configuration for the task master component */
    get taskMasterConfig(): TaskmasterConfig | undefined {
        return this.config.taskmaster;
    }

    /** Configuration for conversation summarization */
    get summarizerConfig(): SummarizerConfig | undefined {
        return this.config.summarizer;
    }

    /** Configuration for embedding/vector operations */
    get embeddingConfig(): EmbeddingConfig {
        return this.config.embedding;
    }

    /** Agent configurations */
    get agentConfig(): Record<string, AgentModelConfig> {
        return this.config.agents ?? {};
    }

    /** Whether the configuration has been initialized */
    get isInitialized(): boolean {
        return !!(
            this.config.taskmaster &&
            this.config.agents &&
            Object.keys(this.config.agents).length > 0
        );
    }

    /**
     * Fetches the latest configuration from storage.
     *
     * @returns Promise resolving to the current FlowCode configuration
     * @throws Error if configuration file cannot be read or is invalid
     */
    async fetchConfig(): Promise<FlowCodeConfig> {
        try {
            await createFlowcodeDirectoryIfNeeded(this.workspaceRoot);
            const configData = await fs.readFile(this.configPath, 'utf-8');
            this._config = JSON.parse(configData) as FlowCodeConfig;
            return this._config;
        } catch (error) {
            if (
                error instanceof Error &&
                'code' in error &&
                error.code === 'ENOENT'
            ) {
                throw new Error(
                    `Configuration file not found at ${this.configPath}`
                );
            }
            throw new Error(
                `Failed to read configuration: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * Fetches the latest taskmaster configuration from storage.
     *
     * @returns Promise resolving to the current taskmaster configuration
     */
    async fetchTaskmasterConfig(): Promise<TaskmasterConfig | undefined> {
        await this.fetchConfig();
        return this.taskMasterConfig;
    }

    /**
     * Fetches the latest summarizer configuration from storage.
     *
     * @returns Promise resolving to the current summarizer configuration
     */
    async fetchSummarizerConfig(): Promise<SummarizerConfig | undefined> {
        await this.fetchConfig();
        return this.summarizerConfig;
    }

    /**
     * Fetches the latest embedding configuration from storage.
     *
     * @returns Promise resolving to the current embedding configuration
     */
    async fetchEmbeddingConfig(): Promise<EmbeddingConfig> {
        await this.fetchConfig();
        return this.embeddingConfig;
    }

    /**
     * Fetches the latest agent configuration from storage.
     *
     * @param name - Name of the agent to fetch
     * @returns Promise resolving to the agent configuration
     */
    async fetchAgentConfig(
        name: string
    ): Promise<AgentModelConfig | undefined> {
        await this.fetchConfig();
        return this.getAgentConfig(name);
    }

    /**
     * Gets an agent configuration by name from the current cached config.
     *
     * @param name - Name of the agent to get
     * @returns Agent configuration or undefined if not found
     */
    getAgentConfig(name: string): AgentModelConfig | undefined {
        return this.agentConfig[name];
    }

    /**
     * Writes the main FlowCode configuration to storage.
     *
     * @param config - Complete FlowCode configuration to persist
     */
    async writeConfig(config: FlowCodeConfig): Promise<void> {
        await this.writeToFile(config);
        await this.fetchConfig(); // Refresh local cache
    }

    /**
     * Writes task master configuration to storage.
     *
     * @param config - Task master configuration to persist
     */
    async writeTaskmasterConfig(config: TaskmasterConfig): Promise<void> {
        const currentConfig = this.config;
        const updatedConfig: FlowCodeConfig = {
            ...currentConfig,
            taskmaster: config,
        };
        await this.writeConfig(updatedConfig);
    }

    /**
     * Writes summarizer configuration to storage.
     *
     * @param config - Summarizer configuration to persist
     */
    async writeSummarizerConfig(config: SummarizerConfig): Promise<void> {
        const currentConfig = this.config;
        const updatedConfig: FlowCodeConfig = {
            ...currentConfig,
            summarizer: config,
        };
        await this.writeConfig(updatedConfig);
    }

    /**
     * Writes embedding configuration to storage.
     *
     * @param config - Embedding configuration to persist
     */
    async writeEmbeddingConfig(config: EmbeddingConfig): Promise<void> {
        const currentConfig = this.config;
        const updatedConfig: FlowCodeConfig = {
            ...currentConfig,
            embedding: config,
        };
        await this.writeConfig(updatedConfig);
        this.emit('embedding-config-changed');
    }

    /**
     * Writes agent configuration to storage.
     *
     * @param name - Name of the agent
     * @param config - Agent configuration to persist
     */
    async writeAgentConfig(
        name: string,
        config: AgentModelConfig
    ): Promise<void> {
        const currentConfig = this.config;
        const updatedConfig: FlowCodeConfig = {
            ...currentConfig,
            agents: {
                ...currentConfig.agents,
                [name]: config,
            },
        };
        await this.writeConfig(updatedConfig);
    }

    private async writeToFile(config: FlowCodeConfig): Promise<void> {
        try {
            await createFlowcodeDirectoryIfNeeded(this.workspaceRoot);
            const configData = JSON.stringify(config, null, 2);
            await fs.writeFile(this.configPath, configData, 'utf-8');
        } catch (error) {
            throw new Error(
                `Failed to write configuration: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }
}
