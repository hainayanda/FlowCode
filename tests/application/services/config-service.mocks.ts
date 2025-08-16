import { ConfigStore, FlowCodeConfig, TaskmasterConfig, SummarizerConfig, EmbeddingConfig, WorkerConfig } from '../../../src/application/interfaces/config-store.js';

export class MockConfigStore implements ConfigStore {
  public writeConfigCalled = false;
  public lastWrittenConfig: FlowCodeConfig | null = null;
  public writeConfigResult = true;
  public getWorkerPromptCalled = false;
  public getTaskmasterPromptCalled = false;
  public lastWorkerName: string | null = null;
  public getWorkerPromptReturn: string | null = null;
  public getTaskmasterPromptReturn: string | null = null;
  public mockConfig: FlowCodeConfig = {
    version: '1.0.0',
    taskmaster: {
      model: 'claude-3-5-sonnet-20241022',
      provider: 'anthropic',
      temperature: 0.7
    },
    summarizer: {
      model: 'claude-3-haiku-20240307',
      provider: 'anthropic',
      temperature: 0.3,
      enabled: true
    },
    embedding: {
      provider: 'openai',
      model: 'text-embedding-3-small',
      enabled: true
    },
    workers: {}
  };

  // ConfigReader implementation
  async getConfig(): Promise<FlowCodeConfig> {
    return { ...this.mockConfig };
  }

  async getTaskmasterConfig(): Promise<TaskmasterConfig> {
    return { ...this.mockConfig.taskmaster };
  }

  async getSummarizerConfig(): Promise<SummarizerConfig> {
    return { ...this.mockConfig.summarizer };
  }

  async getEmbeddingConfig(): Promise<EmbeddingConfig> {
    return { ...this.mockConfig.embedding };
  }

  async getWorkerConfig(workerName: string): Promise<WorkerConfig | null> {
    return this.mockConfig.workers[workerName] || null;
  }

  async getAllWorkers(): Promise<Record<string, WorkerConfig>> {
    return { ...this.mockConfig.workers };
  }

  async getEnabledWorkers(): Promise<Record<string, WorkerConfig>> {
    const enabled: Record<string, WorkerConfig> = {};
    for (const [name, worker] of Object.entries(this.mockConfig.workers)) {
      if (worker.enabled) {
        enabled[name] = worker;
      }
    }
    return enabled;
  }

  async configExists(): Promise<boolean> {
    return true;
  }

  getConfigPath(): string {
    return '/test/.flowcode/config.json';
  }

  async getTaskmasterPrompt(): Promise<string | null> {
    this.getTaskmasterPromptCalled = true;
    return this.getTaskmasterPromptReturn;
  }

  async getWorkerPrompt(workerName: string): Promise<string | null> {
    this.getWorkerPromptCalled = true;
    this.lastWorkerName = workerName;
    return this.getWorkerPromptReturn;
  }

  // ConfigWriter implementation
  async writeConfig(config: FlowCodeConfig): Promise<void> {
    this.writeConfigCalled = true;
    this.lastWrittenConfig = { ...config };
    if (!this.writeConfigResult) {
      throw new Error('Write failed');
    }
  }

  async updateTaskmasterConfig(taskmasterConfig: TaskmasterConfig): Promise<void> {
    this.mockConfig.taskmaster = { ...taskmasterConfig };
  }

  async updateSummarizerConfig(summarizerConfig: SummarizerConfig): Promise<void> {
    this.mockConfig.summarizer = { ...summarizerConfig };
  }

  async updateEmbeddingConfig(embeddingConfig: EmbeddingConfig): Promise<void> {
    this.mockConfig.embedding = { ...embeddingConfig };
  }

  async updateWorkerConfig(workerName: string, workerConfig: WorkerConfig): Promise<void> {
    this.mockConfig.workers[workerName] = { ...workerConfig };
  }

  async ensureConfigDirectory(): Promise<void> {
    // Mock implementation
  }

  reset(): void {
    this.writeConfigCalled = false;
    this.lastWrittenConfig = null;
    this.writeConfigResult = true;
    this.getWorkerPromptCalled = false;
    this.getTaskmasterPromptCalled = false;
    this.lastWorkerName = null;
    this.getWorkerPromptReturn = null;
    this.getTaskmasterPromptReturn = null;
    this.mockConfig = {
      version: '1.0.0',
      taskmaster: {
        model: 'claude-3-5-sonnet-20241022',
        provider: 'anthropic',
        temperature: 0.7
      },
      summarizer: {
        model: 'claude-3-haiku-20240307',
        provider: 'anthropic',
        temperature: 0.3,
        enabled: true
      },
      embedding: {
        provider: 'openai',
        model: 'text-embedding-3-small',
        enabled: true
      },
      workers: {}
    };
  }
}