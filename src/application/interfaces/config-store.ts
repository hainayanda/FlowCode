/**
 * Configuration interfaces for FlowCode config.json management
 */

export interface ModelConfig {
  model: string;
  temperature: number;
  provider: string;
}

export interface TaskmasterConfig extends ModelConfig {
  // Inherits model, temperature, provider
}

export interface SummarizerConfig extends ModelConfig {
  enabled: boolean;
}

export interface EmbeddingConfig {
  provider: string;
  model: string;
  enabled: boolean;
}

export interface WorkerConfig extends ModelConfig {
  description: string;
  enabled: boolean;
}

export interface FlowCodeConfig {
  version: string;
  taskmaster: TaskmasterConfig;
  summarizer: SummarizerConfig;
  embedding: EmbeddingConfig;
  workers: Record<string, WorkerConfig>;
}

/**
 * Reader interface for configuration operations
 */
export interface ConfigReader {
  getConfig(): Promise<FlowCodeConfig>;
  getTaskmasterConfig(): Promise<TaskmasterConfig>;
  getSummarizerConfig(): Promise<SummarizerConfig>;
  getEmbeddingConfig(): Promise<EmbeddingConfig>;
  getWorkerConfig(workerName: string): Promise<WorkerConfig | null>;
  getAllWorkers(): Promise<Record<string, WorkerConfig>>;
  getEnabledWorkers(): Promise<Record<string, WorkerConfig>>;
  configExists(): Promise<boolean>;
  getConfigPath(): string;
  getTaskmasterPrompt(): Promise<string | null>;
  getWorkerPrompt(workerName: string): Promise<string | null>;
}

/**
 * Writer interface for configuration operations
 */
export interface ConfigWriter {
  writeConfig(config: FlowCodeConfig): Promise<void>;
  updateTaskmasterConfig(taskmasterConfig: TaskmasterConfig): Promise<void>;
  updateSummarizerConfig(summarizerConfig: SummarizerConfig): Promise<void>;
  updateEmbeddingConfig(embeddingConfig: EmbeddingConfig): Promise<void>;
  updateWorkerConfig(workerName: string, workerConfig: WorkerConfig): Promise<void>;
  ensureConfigDirectory(): Promise<void>;
}

/**
 * Combined store interface for configuration management
 */
export interface ConfigStore extends ConfigReader, ConfigWriter {
  // Combines both reader and writer interfaces
}