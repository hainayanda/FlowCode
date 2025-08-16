import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorkersCommandHandler } from '../../../src/application/commands/workers/workers-command-handler.js';
import { ConfigStore, FlowCodeConfig, TaskmasterConfig, SummarizerConfig, EmbeddingConfig, WorkerConfig } from '../../../src/application/interfaces/config-store.js';
import { MessageWriter } from '../../../src/application/interfaces/message-store.js';
import { DomainMessage } from '../../../src/presentation/view-models/console/console-use-case.js';

/**
 * Mock ConfigStore for testing
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
    return config.workers?.[workerName] || null;
  }

  async getAllWorkers(): Promise<Record<string, WorkerConfig>> {
    const config = await this.getConfig();
    return config.workers || {};
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

describe('WorkersCommandHandler', () => {
  let handler: WorkersCommandHandler;
  let mockConfigStore: MockConfigStore;
  let mockMessageWriter: MockMessageWriter;

  beforeEach(() => {
    mockConfigStore = new MockConfigStore();
    mockMessageWriter = new MockMessageWriter();
    handler = new WorkersCommandHandler(mockConfigStore, mockMessageWriter);
  });

  describe('Basic functionality', () => {
    it('should support "workers" command', () => {
      expect(handler.supports('workers')).toBe(true);
      expect(handler.supports('other')).toBe(false);
    });

    it('should return workers command definition', () => {
      const commands = handler.getCommands();
      expect(commands).toHaveLength(1);
      expect(commands[0].name).toBe('workers');
      expect(commands[0].description).toBe('Worker management operations');
    });

    it('should reject non-workers commands', async () => {
      const result = await handler.execute('other', []);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Workers command handler only supports "workers" command');
    });

    it('should require subcommand for workers command', async () => {
      const result = await handler.execute('workers', []);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Workers command requires a subcommand');
    });
  });

  describe('list subcommand', () => {
    it('should handle empty workers configuration', async () => {
      mockConfigStore.setMockConfig({});

      const result = await handler.execute('workers', ['list']);
      expect(result.success).toBe(true);
      expect(result.message).toBe('No workers configured in this project');
      expect(mockMessageWriter.storeMessageCalled).toBe(true);
    });

    it('should list configured workers', async () => {
      const config = {
        workers: {
          'code-worker': {
            enabled: true,
            model: 'claude-3-5-sonnet-20241022',
            description: 'General programming worker'
          },
          'ui-worker': {
            enabled: false,
            model: 'claude-3-5-haiku-20241022',
            description: 'Frontend development worker'
          }
        }
      };

      mockConfigStore.setMockConfig(config);

      const result = await handler.execute('workers', ['list']);
      expect(result.success).toBe(true);
      expect(result.message).toContain('Available workers:');
      expect(result.message).toContain('✅ code-worker');
      expect(result.message).toContain('❌ ui-worker');
      expect(result.message).toContain('Total: 2 worker(s)');
      expect(mockMessageWriter.storeMessageCalled).toBe(true);
    });

    it('should handle config read errors', async () => {
      // mockConfigStore will throw by default when mockConfig is null

      const result = await handler.execute('workers', ['list']);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Error listing workers');
      expect(mockMessageWriter.storeMessageCalled).toBe(true);
      expect(mockMessageWriter.storedMessages[0].content).toContain('❌');
    });
  });

  describe('info subcommand', () => {
    it('should require worker name for info', async () => {
      const result = await handler.execute('workers', ['info']);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Info command requires a worker name');
    });

    it('should handle missing workers configuration', async () => {
      mockConfigStore.setMockConfig({});

      const result = await handler.execute('workers', ['info', 'code-worker']);
      expect(result.success).toBe(false);
      expect(result.error).toBe('No workers configured in this project');
    });

    it('should handle non-existent worker', async () => {
      const config = {
        workers: {
          'code-worker': {
            enabled: true,
            model: 'claude-3-5-sonnet-20241022',
            description: 'General programming worker'
          }
        }
      };

      mockConfigStore.setMockConfig(config);

      const result = await handler.execute('workers', ['info', 'non-existent-worker']);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Worker \'non-existent-worker\' not found');
      expect(result.error).toContain('Available workers: code-worker');
    });

    it('should show detailed worker information', async () => {
      const config = {
        workers: {
          'code-worker': {
            enabled: true,
            model: 'claude-3-5-sonnet-20241022',
            provider: 'anthropic',
            temperature: 0.7,
            description: 'General programming worker',
            customField: 'custom value'
          }
        }
      };

      mockConfigStore.setMockConfig(config);

      const result = await handler.execute('workers', ['info', 'code-worker']);
      expect(result.success).toBe(true);
      expect(result.message).toContain('Worker: code-worker');
      expect(result.message).toContain('Status: ✅ Enabled');
      expect(result.message).toContain('Model: claude-3-5-sonnet-20241022');
      expect(result.message).toContain('Provider: anthropic');
      expect(result.message).toContain('Temperature: 0.7');
      expect(result.message).toContain('Description: General programming worker');
      expect(result.message).toContain('Additional Configuration:');
      expect(result.message).toContain('customField: custom value');
      expect(mockMessageWriter.storeMessageCalled).toBe(true);
    });

    it('should handle disabled worker', async () => {
      const config = {
        workers: {
          'disabled-worker': {
            enabled: false,
            model: 'claude-3-5-haiku-20241022',
            description: 'Disabled worker'
          }
        }
      };

      mockConfigStore.setMockConfig(config);

      const result = await handler.execute('workers', ['info', 'disabled-worker']);
      expect(result.success).toBe(true);
      expect(result.message).toContain('Status: ❌ Disabled');
    });

    it('should handle config read errors', async () => {
      // mockConfigStore will throw by default when mockConfig is null

      const result = await handler.execute('workers', ['info', 'code-worker']);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Error getting worker info');
      expect(mockMessageWriter.storeMessageCalled).toBe(true);
      expect(mockMessageWriter.storedMessages[0].content).toContain('❌');
    });
  });

  describe('unknown subcommands', () => {
    it('should reject unknown subcommands', async () => {
      const result = await handler.execute('workers', ['unknown']);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown workers subcommand: unknown');
    });
  });
});