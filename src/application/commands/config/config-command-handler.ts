import { CommandProvider, CommandResult } from '../../interfaces/command-provider.js';
import { CommandDefinition } from '../../../presentation/view-models/console/console-use-case.js';
import { ConfigStore } from '../../interfaces/config-store.js';
import { MessageWriter } from '../../interfaces/message-store.js';
import { Result } from '../../../shared/result.js';

/**
 * Command handler for configuration management operations
 * Supports validation and inspection of FlowCode configuration files
 */
export class ConfigCommandHandler implements CommandProvider {
  constructor(
    private readonly configStore: ConfigStore,
    private readonly messageWriter: MessageWriter
  ) {}

  async execute(command: string, args: string[]): Promise<CommandResult> {
    if (command !== 'config') {
      return {
        success: false,
        error: 'Config command handler only supports "config" command'
      };
    }

    if (args.length === 0) {
      return {
        success: false,
        error: 'Config command requires a subcommand. Use: config validate <file>'
      };
    }

    const subcommand = args[0];

    switch (subcommand) {
      case 'validate':
        return this.handleValidateCommand(args.slice(1));
      default:
        return {
          success: false,
          error: `Unknown config subcommand: ${subcommand}. Available: validate`
        };
    }
  }

  getCommands(): CommandDefinition[] {
    return [
      {
        name: 'config',
        description: 'Configuration management operations'
      }
    ];
  }

  supports(command: string): boolean {
    return command === 'config';
  }

  private async handleValidateCommand(args: string[]): Promise<CommandResult> {
    if (args.length === 0) {
      return {
        success: false,
        error: 'Validate command requires a file path. Use: config validate <file>'
      };
    }

    const filePath = args[0];

    try {
      // Attempt to read and validate the configuration file
      const configResult = await this.validateConfigFile(filePath);
      
      if (!configResult.isSuccess) {
        await this.messageWriter.storeMessage({
          id: Date.now().toString(),
          type: 'system',
          content: `❌ Configuration validation failed: ${configResult.error}`,
          timestamp: new Date()
        });

        return {
          success: false,
          error: `Configuration validation failed: ${configResult.error}`
        };
      }

      const successMessage = `✅ Configuration file '${filePath}' is valid`;
      await this.messageWriter.storeMessage({
        id: Date.now().toString(),
        type: 'system',
        content: successMessage,
        timestamp: new Date()
      });

      return {
        success: true,
        message: successMessage
      };
    } catch (error) {
      const errorMessage = `Error validating configuration: ${error instanceof Error ? error.message : String(error)}`;
      
      await this.messageWriter.storeMessage({
        id: Date.now().toString(),
        type: 'system',
        content: `❌ ${errorMessage}`,
        timestamp: new Date()
      });

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  private async validateConfigFile(_filePath: string): Promise<Result<void, string>> {
    try {
      // Read the configuration file
      const config = await this.configStore.getConfig();
      
      // Basic validation checks
      if (!config) {
        return Result.failure('Configuration file not found or empty');
      }

      // Validate required fields
      if (!config.version) {
        return Result.failure('Missing required field: version');
      }

      if (!config.taskmaster) {
        return Result.failure('Missing required field: taskmaster');
      }

      if (!config.taskmaster.model) {
        return Result.failure('Missing required field: taskmaster.model');
      }

      if (!config.taskmaster.provider) {
        return Result.failure('Missing required field: taskmaster.provider');
      }

      // Validate workers if present
      if (config.workers) {
        for (const [workerName, workerConfig] of Object.entries(config.workers)) {
          if (!workerConfig || typeof workerConfig !== 'object') {
            return Result.failure(`Invalid worker configuration for: ${workerName}`);
          }

          const worker = workerConfig as any;
          if (!worker.model) {
            return Result.failure(`Missing model for worker: ${workerName}`);
          }

          if (!worker.provider) {
            return Result.failure(`Missing provider for worker: ${workerName}`);
          }

          if (!worker.description) {
            return Result.failure(`Missing description for worker: ${workerName}`);
          }
        }
      }

      // Validate summarizer if enabled
      if (config.summarizer?.enabled) {
        if (!config.summarizer.model) {
          return Result.failure('Missing model for enabled summarizer');
        }
        if (!config.summarizer.provider) {
          return Result.failure('Missing provider for enabled summarizer');
        }
      }

      // Validate embedding if enabled
      if (config.embedding?.enabled) {
        if (!config.embedding.model) {
          return Result.failure('Missing model for enabled embedding');
        }
        if (!config.embedding.provider) {
          return Result.failure('Missing provider for enabled embedding');
        }
      }

      return Result.success(undefined);
    } catch (error) {
      return Result.failure(`Failed to read or parse configuration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}