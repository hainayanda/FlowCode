import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { Observable, Subject } from 'rxjs';
import { ToolDefinition, ToolCall, ToolResult, Toolbox } from '../interfaces/toolbox.js';
import { EmbeddingService } from '../interfaces/embedding-service.js';
import { DomainMessage, PlainMessage } from '../../presentation/view-models/console/console-use-case.js';

const execAsync = promisify(exec);

/**
 * Bash command execution result
 */
export interface BashCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  success: boolean;
  duration: number;
}

/**
 * Bash command options
 */
export interface BashCommandOptions {
  workingDirectory?: string;
  timeout?: number;
  environment?: Record<string, string>;
  shell?: string;
}

/**
 * Bash tools implementation
 */
export class BashTools implements Toolbox {

  readonly id = 'bash_tools';
  readonly description = 'Bash command execution toolbox for running shell commands';

  private readonly domainMessagesSubject = new Subject<DomainMessage>();
  
  /**
   * Observable stream of domain messages for rich UI updates
   */
  readonly domainMessages$: Observable<DomainMessage> = this.domainMessagesSubject.asObservable();

  constructor(public readonly embeddingService: EmbeddingService) {}

  getTools(): ToolDefinition[] {
    return [
      {
        name: 'execute_command',
        description: 'Execute bash command',
        parameters: [
          { name: 'command', type: 'string', description: 'Command to execute', required: true },
          { name: 'workingDirectory', type: 'string', description: 'Working directory for command', required: false },
          { name: 'timeout', type: 'number', description: 'Timeout in milliseconds', required: false, default: 30000 },
          { name: 'environment', type: 'object', description: 'Environment variables', required: false },
          { name: 'shell', type: 'string', description: 'Shell to use', required: false, default: '/bin/bash' }
        ],
        permission: 'strict'
      },
      {
        name: 'execute_command_with_streaming',
        description: 'Execute command with real-time output streaming',
        parameters: [
          { name: 'command', type: 'string', description: 'Command to execute', required: true },
          { name: 'workingDirectory', type: 'string', description: 'Working directory for command', required: false },
          { name: 'timeout', type: 'number', description: 'Timeout in milliseconds', required: false, default: 30000 },
          { name: 'environment', type: 'object', description: 'Environment variables', required: false },
          { name: 'shell', type: 'string', description: 'Shell to use', required: false, default: '/bin/bash' }
        ],
        permission: 'strict'
      },
      {
        name: 'is_command_available',
        description: 'Check if command is available in PATH',
        parameters: [
          { name: 'command', type: 'string', description: 'Command to check', required: true }
        ],
        permission: 'none'
      }
    ];
  }

  supportsTool(toolName: string): boolean {
    return this.getTools().some(tool => tool.name === toolName);
  }

  async executeTool(toolCall: ToolCall): Promise<ToolResult> {
    try {
      switch (toolCall.name) {
        case 'execute_command':
          const result = await this.executeCommand(toolCall.parameters.command, {
            workingDirectory: toolCall.parameters.workingDirectory,
            timeout: toolCall.parameters.timeout,
            environment: toolCall.parameters.environment,
            shell: toolCall.parameters.shell
          });
          
          this.publishCommandMessage(toolCall.parameters.command, result);
          
          return { success: result.success, data: result };

        case 'execute_command_with_streaming':
          // For toolbox execution, we'll collect output and return it
          // Real streaming would need callback support in the interface
          const streamResult = await this.executeCommandWithStreaming(
            toolCall.parameters.command,
            undefined, // onStdout callback
            undefined, // onStderr callback
            {
              workingDirectory: toolCall.parameters.workingDirectory,
              timeout: toolCall.parameters.timeout,
              environment: toolCall.parameters.environment,
              shell: toolCall.parameters.shell
            }
          );
          
          this.publishCommandMessage(toolCall.parameters.command, streamResult);
          
          return { success: streamResult.success, data: streamResult };

        case 'is_command_available':
          const isAvailable = await this.isCommandAvailable(toolCall.parameters.command);
          
          const message: PlainMessage = {
            id: this.generateMessageId(),
            type: 'system',
            content: `Command '${toolCall.parameters.command}' is ${isAvailable ? 'available' : 'not available'}`,
            timestamp: new Date()
          };
          
          this.domainMessagesSubject.next(message);
          
          return { success: true, data: { available: isAvailable } };

        default:
          return { success: false, error: `Unknown tool: ${toolCall.name}` };
      }
    } catch (error) {
      return { 
        success: false, 
        error: `Tool execution failed: ${error instanceof Error ? error.message : String(error)}` 
      };
    }
  }

  async executeCommand(command: string, options: BashCommandOptions = {}): Promise<BashCommandResult> {
    const startTime = Date.now();
    
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: options.workingDirectory,
        timeout: options.timeout || 30000,
        env: { ...process.env, ...options.environment },
        shell: options.shell || '/bin/bash'
      });

      const duration = Date.now() - startTime;
      
      return {
        stdout: stdout || '',
        stderr: stderr || '',
        exitCode: 0,
        success: true,
        duration
      };
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      const execError = error as { stdout?: string; stderr?: string; code?: number };
      
      return {
        stdout: execError.stdout || '',
        stderr: execError.stderr || '',
        exitCode: execError.code || 1,
        success: false,
        duration
      };
    }
  }

  async executeCommandWithStreaming(
    command: string,
    onStdout?: (data: string) => void,
    onStderr?: (data: string) => void,
    options: BashCommandOptions = {}
  ): Promise<BashCommandResult> {
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      
      const child = spawn(options.shell || '/bin/bash', ['-c', command], {
        cwd: options.workingDirectory,
        env: { ...process.env, ...options.environment }
      });

      // Set up timeout
      const timeout = options.timeout || 30000;
      const timeoutId = setTimeout(() => {
        child.kill('SIGTERM');
      }, timeout);

      child.stdout?.on('data', (data: Buffer) => {
        const text = data.toString();
        stdout += text;
        onStdout?.(text);
      });

      child.stderr?.on('data', (data: Buffer) => {
        const text = data.toString();
        stderr += text;
        onStderr?.(text);
      });

      child.on('close', (exitCode) => {
        clearTimeout(timeoutId);
        const duration = Date.now() - startTime;
        
        resolve({
          stdout,
          stderr,
          exitCode: exitCode || 0,
          success: exitCode === 0,
          duration
        });
      });

      child.on('error', (error) => {
        clearTimeout(timeoutId);
        const duration = Date.now() - startTime;
        
        resolve({
          stdout,
          stderr: stderr + error.message,
          exitCode: 1,
          success: false,
          duration
        });
      });
    });
  }

  async isCommandAvailable(command: string): Promise<boolean> {
    try {
      const result = await this.executeCommand(`command -v ${command}`);
      return result.success && result.stdout.trim().length > 0;
    } catch {
      return false;
    }
  }

  private publishCommandMessage(command: string, result: BashCommandResult): void {
    const isSuccess = result.success;
    const outputPreview = result.stdout.length > 0 
      ? result.stdout.substring(0, 100) + (result.stdout.length > 100 ? '...' : '')
      : result.stderr.substring(0, 100) + (result.stderr.length > 100 ? '...' : '');

    const message: PlainMessage = {
      id: this.generateMessageId(),
      type: 'system',
      content: `${isSuccess ? '✓' : '✗'} Command executed: ${command}${outputPreview ? `\n${outputPreview}` : ''}`,
      timestamp: new Date()
    };
    
    this.domainMessagesSubject.next(message);
  }

  private generateMessageId(): string {
    return `bash_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}