import { CommandProvider } from '../interfaces/command-provider.js';
import { MessageWriter } from '../interfaces/message-store.js';
import { ConfigStore } from '../interfaces/config-store.js';
import { SettingsWriter } from '../interfaces/settings-store.js';
import { CredentialWriter } from '../interfaces/credential-store.js';
import { InitializerStageFactory } from '../interfaces/initializer-stage.js';
import { CommandRegistry } from './command-registry.js';
import { InitializerCommandHandler } from './initializer/initializer-command-handler.js';
import { ConfigCommandHandler } from './config/config-command-handler.js';
import { WorkersCommandHandler } from './workers/workers-command-handler.js';

/**
 * Factory for creating and assembling all command providers into a command registry
 * Centralizes the dependency injection and wiring of command handlers
 */
export class CommandProviderFactory {
  
  constructor(
    private readonly rootDirectory: string,
    private readonly messageWriter: MessageWriter,
    private readonly configStore: ConfigStore,
    private readonly settingsWriter: SettingsWriter,
    private readonly credentialWriter: CredentialWriter,
    private readonly stageFactory: InitializerStageFactory
  ) {}

  /**
   * Creates a fully configured command registry with all available command providers
   */
  createCommandRegistry(): CommandRegistry {
    const commandProviders = this.createAllCommandProviders();
    return new CommandRegistry(commandProviders, this.messageWriter);
  }

  /**
   * Creates all available command providers
   */
  private createAllCommandProviders(): CommandProvider[] {
    return [
      this.createInitializerCommandHandler(),
      this.createConfigCommandHandler(),
      this.createWorkersCommandHandler()
    ];
  }

  /**
   * Creates the initializer command handler
   */
  private createInitializerCommandHandler(): InitializerCommandHandler {
    return new InitializerCommandHandler(
      this.rootDirectory,
      this.stageFactory,
      this.configStore,
      this.settingsWriter,
      this.credentialWriter
    );
  }

  /**
   * Creates the config command handler
   */
  private createConfigCommandHandler(): ConfigCommandHandler {
    return new ConfigCommandHandler(
      this.configStore,
      this.messageWriter
    );
  }

  /**
   * Creates the workers command handler
   */
  private createWorkersCommandHandler(): WorkersCommandHandler {
    return new WorkersCommandHandler(
      this.configStore,
      this.messageWriter
    );
  }
}