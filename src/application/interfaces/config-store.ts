/**
 * Configuration interfaces for FlowCode config.json management
 */

export interface ProjectConfig {
  name: string;
  description: string;
}

export interface ModelConfig {
  model: string;
  temperature: number;
  provider: string;
}

export interface TaskmasterConfig extends ModelConfig {
  // Inherits model, temperature, provider
}

export interface SummarizerConfig extends ModelConfig {
  summarize_threshold: number;
  preserve_recent_messages: number;
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
  project: ProjectConfig;
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
  getProjectConfig(): Promise<ProjectConfig>;
  getTaskmasterConfig(): Promise<TaskmasterConfig>;
  getSummarizerConfig(): Promise<SummarizerConfig>;
  getEmbeddingConfig(): Promise<EmbeddingConfig>;
  getWorkerConfig(workerName: string): Promise<WorkerConfig | null>;
  getAllWorkers(): Promise<Record<string, WorkerConfig>>;
  getEnabledWorkers(): Promise<Record<string, WorkerConfig>>;
  configExists(): Promise<boolean>;
  getConfigPath(): string;
}

/**
 * Writer interface for configuration operations
 */
export interface ConfigWriter {
  writeConfig(config: FlowCodeConfig): Promise<boolean>;
  initializeConfig(): Promise<boolean>;
  updateProjectConfig(projectConfig: ProjectConfig): Promise<boolean>;
  updateTaskmasterConfig(taskmasterConfig: TaskmasterConfig): Promise<boolean>;
  updateSummarizerConfig(summarizerConfig: SummarizerConfig): Promise<boolean>;
  updateEmbeddingConfig(embeddingConfig: EmbeddingConfig): Promise<boolean>;
  updateWorkerConfig(workerName: string, workerConfig: WorkerConfig): Promise<boolean>;
  ensureConfigDirectory(): Promise<boolean>;
}

/**
 * Combined store interface for configuration management
 */
export interface ConfigStore extends ConfigReader, ConfigWriter {
  // Combines both reader and writer interfaces
}