import * as fs from 'fs/promises';
import * as path from 'path';
import { ConfigStore, FlowCodeConfig, ProjectConfig, TaskmasterConfig, SummarizerConfig, EmbeddingConfig, WorkerConfig } from '../interfaces/config-store.js';

/**
 * Configuration service implementation for FlowCode config.json management
 */
export class ConfigService implements ConfigStore {
  private readonly configDir: string;
  private readonly configFile: string;

  constructor(projectRoot: string = process.cwd()) {
    this.configDir = path.join(projectRoot, '.flowcode');
    this.configFile = path.join(this.configDir, 'config.json');
  }

  // ConfigReader implementation

  async getConfig(): Promise<FlowCodeConfig> {
    try {
      const content = await fs.readFile(this.configFile, 'utf-8');
      return JSON.parse(content);
    } catch {
      return this.getDefaultConfig();
    }
  }

  async getProjectConfig(): Promise<ProjectConfig> {
    const config = await this.getConfig();
    return config.project;
  }

  async getTaskmasterConfig(): Promise<TaskmasterConfig> {
    const config = await this.getConfig();
    return config.taskmaster;
  }

  async getSummarizerConfig(): Promise<SummarizerConfig> {
    const config = await this.getConfig();
    return config.summarizer;
  }

  async getEmbeddingConfig(): Promise<EmbeddingConfig> {
    const config = await this.getConfig();
    return config.embedding;
  }

  async getWorkerConfig(workerName: string): Promise<WorkerConfig | null> {
    const config = await this.getConfig();
    return config.workers[workerName] || null;
  }

  async getAllWorkers(): Promise<Record<string, WorkerConfig>> {
    const config = await this.getConfig();
    return config.workers;
  }

  async getEnabledWorkers(): Promise<Record<string, WorkerConfig>> {
    const config = await this.getConfig();
    const enabledWorkers: Record<string, WorkerConfig> = {};
    
    for (const [name, worker] of Object.entries(config.workers)) {
      if (worker.enabled) {
        enabledWorkers[name] = worker;
      }
    }
    
    return enabledWorkers;
  }

  async configExists(): Promise<boolean> {
    try {
      await fs.access(this.configFile);
      return true;
    } catch {
      return false;
    }
  }

  getConfigPath(): string {
    return this.configFile;
  }

  // ConfigWriter implementation

  async writeConfig(config: FlowCodeConfig): Promise<boolean> {
    try {
      await this.ensureConfigDirectory();
      await fs.writeFile(this.configFile, JSON.stringify(config, null, 2));
      return true;
    } catch {
      return false;
    }
  }

  async initializeConfig(): Promise<boolean> {
    try {
      await this.ensureConfigDirectory();
      const defaultConfig = this.getDefaultConfig();
      await fs.writeFile(this.configFile, JSON.stringify(defaultConfig, null, 2));
      return true;
    } catch {
      return false;
    }
  }

  async updateProjectConfig(projectConfig: ProjectConfig): Promise<boolean> {
    try {
      const config = await this.getConfig();
      config.project = projectConfig;
      return await this.writeConfig(config);
    } catch {
      return false;
    }
  }

  async updateTaskmasterConfig(taskmasterConfig: TaskmasterConfig): Promise<boolean> {
    try {
      const config = await this.getConfig();
      config.taskmaster = taskmasterConfig;
      return await this.writeConfig(config);
    } catch {
      return false;
    }
  }

  async updateSummarizerConfig(summarizerConfig: SummarizerConfig): Promise<boolean> {
    try {
      const config = await this.getConfig();
      config.summarizer = summarizerConfig;
      return await this.writeConfig(config);
    } catch {
      return false;
    }
  }

  async updateEmbeddingConfig(embeddingConfig: EmbeddingConfig): Promise<boolean> {
    try {
      const config = await this.getConfig();
      config.embedding = embeddingConfig;
      return await this.writeConfig(config);
    } catch {
      return false;
    }
  }

  async updateWorkerConfig(workerName: string, workerConfig: WorkerConfig): Promise<boolean> {
    try {
      const config = await this.getConfig();
      config.workers[workerName] = workerConfig;
      return await this.writeConfig(config);
    } catch {
      return false;
    }
  }

  async ensureConfigDirectory(): Promise<boolean> {
    try {
      await fs.mkdir(this.configDir, { recursive: true });
      return true;
    } catch {
      return false;
    }
  }

  // Private helper methods

  private getDefaultConfig(): FlowCodeConfig {
    return {
      version: "1.0",
      project: {
        name: "FlowCode Project",
        description: "A FlowCode project with intelligent task routing"
      },
      taskmaster: {
        model: "claude-3-5-sonnet-20241022",
        temperature: 0.2,
        provider: "anthropic"
      },
      summarizer: {
        model: "claude-3-5-haiku-20241022",
        temperature: 0.1,
        summarize_threshold: 15,
        preserve_recent_messages: 5,
        enabled: true,
        provider: "anthropic"
      },
      embedding: {
        provider: "openai",
        model: "text-embedding-3-small",
        enabled: true
      },
      workers: {
        "code-worker": {
          description: "General programming and business logic",
          model: "claude-3-5-sonnet-20241022",
          provider: "anthropic",
          enabled: true
        },
        "test-worker": {
          description: "Testing and quality assurance",
          model: "claude-3-5-sonnet-20241022",
          provider: "anthropic",
          enabled: true
        },
        "ui-worker": {
          description: "Frontend components and user interfaces",
          model: "claude-3-5-haiku-20241022",
          provider: "anthropic",
          enabled: true
        },
        "security-worker": {
          description: "Security analysis and compliance",
          model: "claude-3-5-haiku-20241022",
          provider: "anthropic",
          enabled: true
        }
      }
    };
  }
}