import { CommandProvider, CommandResult } from '../../interfaces/command-provider.js';
import { CommandDefinition } from '../../../presentation/view-models/console/console-use-case.js';
import { ConfigStore } from '../../interfaces/config-store.js';
import { MessageWriter } from '../../interfaces/message-store.js';

/**
 * Command handler for worker management operations
 * Supports listing workers and getting detailed worker information
 */
export class WorkersCommandHandler implements CommandProvider {
  constructor(
    private readonly configStore: ConfigStore,
    private readonly messageWriter: MessageWriter
  ) {}

  async execute(command: string, args: string[]): Promise<CommandResult> {
    if (command !== 'workers') {
      return {
        success: false,
        error: 'Workers command handler only supports "workers" command'
      };
    }

    if (args.length === 0) {
      return {
        success: false,
        error: 'Workers command requires a subcommand. Use: workers list | workers info <worker-name>'
      };
    }

    const subcommand = args[0];

    switch (subcommand) {
      case 'list':
        return this.handleListCommand();
      case 'info':
        return this.handleInfoCommand(args.slice(1));
      default:
        return {
          success: false,
          error: `Unknown workers subcommand: ${subcommand}. Available: list, info`
        };
    }
  }

  getCommands(): CommandDefinition[] {
    return [
      {
        name: 'workers',
        description: 'Worker management operations'
      }
    ];
  }

  supports(command: string): boolean {
    return command === 'workers';
  }

  private async handleListCommand(): Promise<CommandResult> {
    try {
      const workers = await this.configStore.getAllWorkers();
      
      if (!workers || Object.keys(workers).length === 0) {
        const message = 'No workers configured in this project';
        await this.messageWriter.storeMessage({
          id: Date.now().toString(),
          type: 'system',
          content: message,
          timestamp: new Date()
        });

        return {
          success: true,
          message
        };
      }

      const workerEntries = Object.entries(workers);
      const lines = ['Available workers:', ''];
      
      for (const [name, worker] of workerEntries) {
        const status = worker.enabled ? '✅' : '❌';
        const model = worker.model || 'unknown';
        const description = worker.description || 'No description';
        
        lines.push(`  ${status} ${name}`);
        lines.push(`    Model: ${model}`);
        lines.push(`    Description: ${description}`);
        lines.push('');
      }

      lines.push(`Total: ${workerEntries.length} worker(s)`);
      lines.push('');
      lines.push('Use "workers info <worker-name>" for detailed information.');

      const output = lines.join('\n');
      await this.messageWriter.storeMessage({
        id: Date.now().toString(),
        type: 'system',
        content: output,
        timestamp: new Date()
      });

      return {
        success: true,
        message: output
      };
    } catch (error) {
      const errorMessage = `Error listing workers: ${error instanceof Error ? error.message : String(error)}`;
      
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

  private async handleInfoCommand(args: string[]): Promise<CommandResult> {
    if (args.length === 0) {
      return {
        success: false,
        error: 'Info command requires a worker name. Use: workers info <worker-name>'
      };
    }

    const workerName = args[0];

    try {
      const worker = await this.configStore.getWorkerConfig(workerName);
      
      if (!worker) {
        const allWorkers = await this.configStore.getAllWorkers();
        if (!allWorkers || Object.keys(allWorkers).length === 0) {
          return {
            success: false,
            error: 'No workers configured in this project'
          };
        }
        
        const availableWorkers = Object.keys(allWorkers).join(', ');
        return {
          success: false,
          error: `Worker '${workerName}' not found. Available workers: ${availableWorkers}`
        };
      }

      const lines = [
        `Worker: ${workerName}`,
        `Status: ${worker.enabled ? '✅ Enabled' : '❌ Disabled'}`,
        `Model: ${worker.model || 'Not specified'}`,
        `Provider: ${worker.provider || 'Not specified'}`,
        `Temperature: ${worker.temperature || 'Not specified'}`,
        `Description: ${worker.description || 'No description available'}`,
        ''
      ];

      // Add additional configuration if present
      const workerAsRecord = worker as unknown as Record<string, unknown>;
      const additionalConfig = Object.entries(workerAsRecord)
        .filter(([key]) => !['enabled', 'model', 'provider', 'temperature', 'description'].includes(key))
        .map(([key, value]) => `${key}: ${value}`);

      if (additionalConfig.length > 0) {
        lines.push('Additional Configuration:');
        additionalConfig.forEach(config => lines.push(`  ${config}`));
        lines.push('');
      }

      const output = lines.join('\n');
      await this.messageWriter.storeMessage({
        id: Date.now().toString(),
        type: 'system',
        content: output,
        timestamp: new Date()
      });

      return {
        success: true,
        message: output
      };
    } catch (error) {
      const errorMessage = `Error getting worker info: ${error instanceof Error ? error.message : String(error)}`;
      
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
}