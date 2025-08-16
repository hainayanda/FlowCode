import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfigCommandHandler } from '../../../src/application/commands/config/config-command-handler.js';
import { ConfigStore, FlowCodeConfig, TaskmasterConfig, SummarizerConfig, EmbeddingConfig, WorkerConfig } from '../../../src/application/interfaces/config-store.js';
import { MessageWriter } from '../../../src/application/interfaces/message-store.js';
import { DomainMessage } from '../../../src/presentation/view-models/console/console-use-case.js';

/**
 * Mock ConfigReader for testing
 */
class MockConfigStore implements ConfigStore {
  public mockConfig: any = null;
  public readConfigCalled = false;

  async getConfig(): Promise<FlowCodeConfig> {
    this.readConfigCalled = true;
    if (this.mockConfig === null) {
      throw new Error('Configuration file not found');
    }
    return this.mockConfig;
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
    const workers = await this.getAllWorkers();
    const enabledWorkers: Record<string, WorkerConfig> = {};
    for (const [name, worker] of Object.entries(workers)) {
      if (worker.enabled) {
        enabledWorkers[name] = worker;
      }
    }
    return enabledWorkers;
  }

  async configExists(): Promise<boolean> {
    return this.mockConfig !== null;
  }

  getConfigPath(): string {
    return '/test/.flowcode/config.json';
  }

  // ConfigWriter methods
  async writeConfig(config: FlowCodeConfig): Promise<void> {
    this.mockConfig = config;
  }

  async updateTaskmasterConfig(taskmasterConfig: TaskmasterConfig): Promise<void> {
    if (this.mockConfig) {
      this.mockConfig.taskmaster = taskmasterConfig;
    }
  }

  async updateSummarizerConfig(summarizerConfig: SummarizerConfig): Promise<void> {
    if (this.mockConfig) {
      this.mockConfig.summarizer = summarizerConfig;
    }
  }

  async updateEmbeddingConfig(embeddingConfig: EmbeddingConfig): Promise<void> {
    if (this.mockConfig) {
      this.mockConfig.embedding = embeddingConfig;
    }
  }

  async updateWorkerConfig(workerName: string, workerConfig: WorkerConfig): Promise<void> {
    if (this.mockConfig) {
      this.mockConfig.workers[workerName] = workerConfig;
    }
  }

  async ensureConfigDirectory(): Promise<void> {
    // Mock implementation - no-op
  }

  // Test helpers
  setMockConfig(config: any): void {
    this.mockConfig = config;
  }

  reset(): void {
    this.mockConfig = null;
    this.readConfigCalled = false;
  }
}

/**
 * Mock MessageWriter for testing
 */
class MockMessageWriter implements MessageWriter {
  public storedMessages: DomainMessage[] = [];
  public storeMessageCalled = false;

  async storeMessage(message: DomainMessage): Promise<void> {
    this.storeMessageCalled = true;
    this.storedMessages.push(message);
  }

  async storeMessages(messages: DomainMessage[]): Promise<void> {
    for (const message of messages) {
      await this.storeMessage(message);
    }
  }

  async updateMessage(messageId: string, updates: Partial<DomainMessage>): Promise<void> {
    const index = this.storedMessages.findIndex(msg => msg.id === messageId);
    if (index >= 0) {
      this.storedMessages[index] = { ...this.storedMessages[index], ...updates } as DomainMessage;
    }
  }

  async clearHistory(): Promise<void> {
    this.storedMessages = [];
  }

  reset(): void {
    this.storedMessages = [];
    this.storeMessageCalled = false;
  }
}

describe('ConfigCommandHandler', () => {
  let handler: ConfigCommandHandler;
  let mockConfigStore: MockConfigStore;
  let mockMessageWriter: MockMessageWriter;

  beforeEach(() => {
    mockConfigStore = new MockConfigStore();
    mockMessageWriter = new MockMessageWriter();
    handler = new ConfigCommandHandler(mockConfigStore, mockMessageWriter);
  });

  describe('Basic functionality', () => {
    it('should support "config" command', () => {
      expect(handler.supports('config')).toBe(true);
      expect(handler.supports('other')).toBe(false);
    });

    it('should return config command definition', () => {
      const commands = handler.getCommands();
      expect(commands).toHaveLength(1);
      expect(commands[0].name).toBe('config');
      expect(commands[0].description).toBe('Configuration management operations');
    });

    it('should reject non-config commands', async () => {
      const result = await handler.execute('other', []);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Config command handler only supports "config" command');
    });

    it('should require subcommand for config command', async () => {
      const result = await handler.execute('config', []);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Config command requires a subcommand');
    });
  });

  describe('validate subcommand', () => {
    it('should require file path for validate', async () => {
      const result = await handler.execute('config', ['validate']);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Validate command requires a file path');
    });

    it('should validate a valid configuration', async () => {
      const validConfig = {
        version: '1.0.0',
        taskmaster: {
          model: 'claude-3-5-sonnet-20241022',
          provider: 'anthropic'
        },
        workers: {
          'code-worker': {
            model: 'claude-3-5-sonnet-20241022',
            provider: 'anthropic',
            description: 'General programming worker'
          }
        }
      };

      mockConfigStore.setMockConfig(validConfig);

      const result = await handler.execute('config', ['validate', '.flowcode/config.json']);
      expect(result.success).toBe(true);
      expect(result.message).toContain('Configuration file \'.flowcode/config.json\' is valid');
      expect(mockMessageWriter.storeMessageCalled).toBe(true);
      expect(mockMessageWriter.storedMessages[0].content).toContain('✅');
    });

    it('should fail validation for missing required fields', async () => {
      const invalidConfig = {
        version: '1.0.0'
        // missing taskmaster
      };

      mockConfigStore.setMockConfig(invalidConfig);

      const result = await handler.execute('config', ['validate', '.flowcode/config.json']);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required field: taskmaster');
      expect(mockMessageWriter.storeMessageCalled).toBe(true);
      expect(mockMessageWriter.storedMessages[0].content).toContain('❌');
    });

    it('should fail validation for missing taskmaster model', async () => {
      const invalidConfig = {
        version: '1.0.0',
        taskmaster: {
          provider: 'anthropic'
          // missing model
        }
      };

      mockConfigStore.setMockConfig(invalidConfig);

      const result = await handler.execute('config', ['validate', '.flowcode/config.json']);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required field: taskmaster.model');
    });

    it('should fail validation for invalid worker configuration', async () => {
      const invalidConfig = {
        version: '1.0.0',
        taskmaster: {
          model: 'claude-3-5-sonnet-20241022',
          provider: 'anthropic'
        },
        workers: {
          'invalid-worker': {
            provider: 'anthropic'
            // missing model and description
          }
        }
      };

      mockConfigStore.setMockConfig(invalidConfig);

      const result = await handler.execute('config', ['validate', '.flowcode/config.json']);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing model for worker: invalid-worker');
    });

    it('should handle config read errors', async () => {
      // mockConfigStore will throw by default when mockConfig is null

      const result = await handler.execute('config', ['validate', '.flowcode/config.json']);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Configuration validation failed');
      expect(mockMessageWriter.storeMessageCalled).toBe(true);
      expect(mockMessageWriter.storedMessages[0].content).toContain('❌');
    });
  });

  describe('unknown subcommands', () => {
    it('should reject unknown subcommands', async () => {
      const result = await handler.execute('config', ['unknown']);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown config subcommand: unknown');
    });
  });
});