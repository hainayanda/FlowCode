import * as fs from 'fs/promises';
import * as path from 'path';
import { ConfigWriter, ConfigReader, FlowCodeConfig } from '../interfaces/config-store';

export interface VectorProviderConfig {
  provider: string;
  model: string;
}

export class ConfigRepository implements ConfigReader, ConfigWriter {
  private readonly configDir: string;
  private readonly configFile: string;

  constructor(projectRoot: string = process.cwd()) {
    this.configDir = path.join(projectRoot, '.flowcode');
    this.configFile = path.join(this.configDir, 'config.json');
  }

  // ConfigReader methods
  async getConfig(): Promise<FlowCodeConfig> {
    try {
      const content = await fs.readFile(this.configFile, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to read config file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getTaskmasterConfig(): Promise<any> {
    const config = await this.getConfig();
    return config.taskmaster;
  }

  async getSummarizerConfig(): Promise<any> {
    const config = await this.getConfig();
    return config.summarizer;
  }

  async getEmbeddingConfig(): Promise<any> {
    const config = await this.getConfig();
    return config.embedding;
  }

  async getWorkerConfig(workerName: string): Promise<any> {
    const config = await this.getConfig();
    return config.workers[workerName] || null;
  }

  async getAllWorkers(): Promise<Record<string, any>> {
    const config = await this.getConfig();
    return config.workers;
  }

  async getEnabledWorkers(): Promise<Record<string, any>> {
    const config = await this.getConfig();
    const enabledWorkers: Record<string, any> = {};
    
    for (const [name, worker] of Object.entries(config.workers)) {
      if ((worker as any).enabled) {
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

  // ConfigWriter methods
  async writeConfig(config: FlowCodeConfig): Promise<void> {
    try {
      await this.ensureConfigDirectory();
      await fs.writeFile(this.configFile, JSON.stringify(config, null, 2));
    } catch (error) {
      throw new Error(`Failed to write config file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }


  async updateTaskmasterConfig(taskmasterConfig: any): Promise<void> {
    try {
      const config = await this.getConfig();
      config.taskmaster = taskmasterConfig;
      await this.writeConfig(config);
    } catch (error) {
      throw new Error(`Failed to update taskmaster config: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async updateSummarizerConfig(summarizerConfig: any): Promise<void> {
    try {
      const config = await this.getConfig();
      config.summarizer = summarizerConfig;
      await this.writeConfig(config);
    } catch (error) {
      throw new Error(`Failed to update summarizer config: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async updateEmbeddingConfig(embeddingConfig: any): Promise<void> {
    try {
      const config = await this.getConfig();
      config.embedding = embeddingConfig;
      await this.writeConfig(config);
    } catch (error) {
      throw new Error(`Failed to update embedding config: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async updateWorkerConfig(workerName: string, workerConfig: any): Promise<void> {
    try {
      const config = await this.getConfig();
      config.workers[workerName] = workerConfig;
      await this.writeConfig(config);
    } catch (error) {
      throw new Error(`Failed to update worker config for '${workerName}': ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async ensureConfigDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.configDir, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to create config directory: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Vector provider methods
  async getVectorProviderConfig(): Promise<VectorProviderConfig> {
    const config = await this.getConfig();
    if (!(config as any).vectorProvider) {
      throw new Error('Vector provider configuration not found in config');
    }
    return (config as any).vectorProvider;
  }

  async updateVectorProviderConfig(vectorProvider: VectorProviderConfig): Promise<void> {
    const config = await this.getConfig();
    (config as any).vectorProvider = vectorProvider;
    await this.writeConfig(config);
  }

}