import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CommandProviderFactory } from '../../../src/application/commands/command-provider-factory.js';
import { MessageWriter } from '../../../src/application/interfaces/message-store.js';
import { ConfigStore, FlowCodeConfig, TaskmasterConfig, SummarizerConfig, EmbeddingConfig, WorkerConfig } from '../../../src/application/interfaces/config-store.js';
import { SettingsWriter, SettingsConfig } from '../../../src/application/interfaces/settings-store.js';
import { CredentialWriter, CredentialsConfig, ProviderCredential } from '../../../src/application/interfaces/credential-store.js';
import { InitializerStageFactory, InitializerStageType, InitializerStage } from '../../../src/application/interfaces/initializer-stage.js';
import { DomainMessage } from '../../../src/presentation/view-models/console/console-use-case.js';
import { Result } from '../../../src/application/shared/result.js';

/**
 * Mock implementations for testing
 */
class MockMessageWriter implements MessageWriter {
  async storeMessage(message: DomainMessage): Promise<void> {}
  async storeMessages(messages: DomainMessage[]): Promise<void> {}
  async updateMessage(messageId: string, updates: Partial<DomainMessage>): Promise<void> {}
  async clearHistory(): Promise<void> {}
}

class MockConfigStore implements ConfigStore {
  async getConfig(): Promise<FlowCodeConfig> {
    return {
      version: '1.0.0',
      taskmaster: { model: 'test', temperature: 0.7, provider: 'test' },
      summarizer: { model: 'test', temperature: 0.7, provider: 'test', enabled: true },
      embedding: { provider: 'test', model: 'test', enabled: true },
      workers: {}
    };
  }
  async getTaskmasterConfig(): Promise<TaskmasterConfig> {
    return { model: 'test', temperature: 0.7, provider: 'test' };
  }
  async getSummarizerConfig(): Promise<SummarizerConfig> {
    return { model: 'test', temperature: 0.7, provider: 'test', enabled: true };
  }
  async getEmbeddingConfig(): Promise<EmbeddingConfig> {
    return { provider: 'test', model: 'test', enabled: true };
  }
  async getWorkerConfig(workerName: string): Promise<WorkerConfig | null> {
    return null;
  }
  async getAllWorkers(): Promise<Record<string, WorkerConfig>> {
    return {};
  }
  async getEnabledWorkers(): Promise<Record<string, WorkerConfig>> {
    return {};
  }
  async configExists(): Promise<boolean> {
    return true;
  }
  getConfigPath(): string {
    return '/test/config.json';
  }
  async writeConfig(config: FlowCodeConfig): Promise<void> {}
  async updateTaskmasterConfig(taskmasterConfig: TaskmasterConfig): Promise<void> {}
  async updateSummarizerConfig(summarizerConfig: SummarizerConfig): Promise<void> {}
  async updateEmbeddingConfig(embeddingConfig: EmbeddingConfig): Promise<void> {}
  async updateWorkerConfig(workerName: string, workerConfig: WorkerConfig): Promise<void> {}
  async ensureConfigDirectory(): Promise<void> {}
}

class MockSettingsWriter implements SettingsWriter {
  async writeSettings(settings: SettingsConfig): Promise<boolean> {
    return true;
  }
  async ensureSettingsDirectory(): Promise<boolean> {
    return true;
  }
}

class MockCredentialWriter implements CredentialWriter {
  async writeCredentials(credentials: CredentialsConfig): Promise<void> {}
  async setProviderCredential(provider: string, credential: ProviderCredential): Promise<void> {}
  async updateLastUsed(provider: string): Promise<void> {}
  async removeProviderCredential(provider: string): Promise<void> {}
  async ensureCredentialsDirectory(): Promise<void> {}
}

class MockInitializerStageFactory implements InitializerStageFactory {
  createStage(stageType: InitializerStageType): Result<InitializerStage, string> {
    return Result.failure('Mock stage factory');
  }
  getSupportedStages(): InitializerStageType[] {
    return [];
  }
}

describe('CommandProviderFactory', () => {
  let factory: CommandProviderFactory;
  let mockMessageWriter: MockMessageWriter;
  let mockConfigStore: MockConfigStore;
  let mockSettingsWriter: MockSettingsWriter;
  let mockCredentialWriter: MockCredentialWriter;
  let mockStageFactory: MockInitializerStageFactory;

  beforeEach(() => {
    mockMessageWriter = new MockMessageWriter();
    mockConfigStore = new MockConfigStore();
    mockSettingsWriter = new MockSettingsWriter();
    mockCredentialWriter = new MockCredentialWriter();
    mockStageFactory = new MockInitializerStageFactory();

    factory = new CommandProviderFactory(
      '/test/root',
      mockMessageWriter,
      mockConfigStore,
      mockSettingsWriter,
      mockCredentialWriter,
      mockStageFactory
    );
  });

  describe('createCommandRegistry', () => {
    it('should create a command registry with all command providers', () => {
      const registry = factory.createCommandRegistry();
      
      expect(registry).toBeDefined();
      expect(registry.supports('init')).toBe(true);
      expect(registry.supports('config')).toBe(true);
      expect(registry.supports('workers')).toBe(true);
      expect(registry.supports('help')).toBe(true); // Built-in help command
    });

    it('should include all expected commands in registry', () => {
      const registry = factory.createCommandRegistry();
      const commands = registry.getCommands();
      
      const commandNames = commands.map(cmd => cmd.name);
      expect(commandNames).toContain('help'); // Built-in
      expect(commandNames).toContain('init'); // Initializer
      expect(commandNames).toContain('config'); // Config
      expect(commandNames).toContain('workers'); // Workers
    });

    it('should reject unsupported commands', () => {
      const registry = factory.createCommandRegistry();
      
      expect(registry.supports('unknown')).toBe(false);
      expect(registry.supports('invalid')).toBe(false);
    });
  });

  describe('command provider creation', () => {
    it('should create command providers with correct dependencies', () => {
      const registry = factory.createCommandRegistry();
      
      // Test that all providers are properly wired by checking command support
      expect(registry.supports('init')).toBe(true);
      expect(registry.supports('config')).toBe(true);
      expect(registry.supports('workers')).toBe(true);
    });
  });
});