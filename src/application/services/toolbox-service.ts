import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { Toolbox, ToolDefinition, ToolCall, ToolResult, PermissionLevel, ToolboxMessage } from '../interfaces/toolbox.js';
import { SettingsStore } from '../interfaces/settings-store.js';
import { DomainOption } from '../../presentation/view-models/console/console-use-case.js';
import { EmbeddingService } from '../interfaces/embedding-service.js';

/**
 * Permission request result
 */
interface PermissionRequest {
  toolboxId: string;
  toolName: string;
  parameters: Record<string, any>;
  permissionLevel: PermissionLevel;
}

/**
 * Toolbox service that aggregates multiple toolboxes and handles permissions
 */
export class ToolboxService implements Toolbox {
  
  readonly id = 'toolbox_service';
  readonly description = 'Aggregates multiple toolboxes with unified permission handling';
  
  private readonly optionsSubject = new BehaviorSubject<DomainOption | null>(null);
  private readonly messagesSubject = new Subject<ToolboxMessage>();
  private pendingPermissionRequest: PermissionRequest | null = null;
  private permissionResolver: ((granted: boolean) => void) | null = null;

  constructor(
    private readonly toolboxes: Toolbox[],
    private readonly settingsStore: SettingsStore,
    public readonly embeddingService: EmbeddingService
  ) {}

  /**
   * Observable for permission requests (options)
   */
  get options$(): Observable<DomainOption | null> {
    return this.optionsSubject.asObservable();
  }

  /**
   * Observable stream of toolbox status messages
   */
  get messages$(): Observable<ToolboxMessage> {
    return this.messagesSubject.asObservable();
  }

  getTools(): ToolDefinition[] {
    const allTools: ToolDefinition[] = [];
    
    for (const toolbox of this.toolboxes) {
      const tools = toolbox.getTools().map(tool => ({
        ...tool,
        // Prefix tool name with toolbox id for uniqueness
        name: `${toolbox.id}.${tool.name}`
      }));
      allTools.push(...tools);
    }
    
    return allTools;
  }

  supportsTool(toolName: string): boolean {
    const [toolboxId, actualToolName] = this.parseToolName(toolName);
    const toolbox = this.findToolbox(toolboxId);
    return toolbox ? toolbox.supportsTool(actualToolName) : false;
  }

  async executeTool(toolCall: ToolCall): Promise<ToolResult> {
    const operationId = this.generateOperationId();
    
    // Emit executing status
    this.emitToolboxMessage(operationId, toolCall, 'executing', 'Executing tool...');
    
    const [toolboxId, actualToolName] = this.parseToolName(toolCall.name);
    const toolbox = this.findToolbox(toolboxId);
    
    if (!toolbox) {
      const error = `Toolbox not found: ${toolboxId}`;
      this.emitToolboxMessage(operationId, toolCall, 'failing', error);
      return {
        success: false,
        error
      };
    }

    const tool = toolbox.getTools().find(t => t.name === actualToolName);
    if (!tool) {
      const error = `Tool not found: ${actualToolName} in toolbox ${toolboxId}`;
      this.emitToolboxMessage(operationId, toolCall, 'failing', error);
      return {
        success: false,
        error
      };
    }

    // Check permissions before execution
    try {
      const permissionGranted = await this.checkPermission({
        toolboxId,
        toolName: actualToolName,
        parameters: toolCall.parameters,
        permissionLevel: tool.permission
      });

      if (!permissionGranted) {
        const error = 'Permission denied';
        this.emitToolboxMessage(operationId, toolCall, 'failing', error);
        return {
          success: false,
          error
        };
      }

      // Execute the tool call with the original tool name
      const originalToolCall = {
        ...toolCall,
        name: actualToolName
      };

      const result = await toolbox.executeTool(originalToolCall);
      
      if (result.success) {
        this.emitToolboxMessage(operationId, toolCall, 'succeed', result.message || 'Tool executed successfully', result.data);
      } else {
        this.emitToolboxMessage(operationId, toolCall, 'failing', result.error || 'Tool execution failed', undefined, result.error);
      }
      
      return result;
    } catch (error) {
      const errorMessage = `Tool execution error: ${error}`;
      this.emitToolboxMessage(operationId, toolCall, 'failing', errorMessage, undefined, String(error));
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Respond to user permission choice
   */
  async respondToPermissionChoice(selectedIndex: number): Promise<void> {
    if (!this.pendingPermissionRequest || !this.permissionResolver) {
      return;
    }

    const granted = selectedIndex === 0; // Assuming first option is "Allow"
    
    if (granted) {
      // Save permission to settings
      await this.savePermission(this.pendingPermissionRequest);
    }

    // Clear the options display
    this.optionsSubject.next(null);
    
    // Resolve the permission promise
    this.permissionResolver(granted);
    this.pendingPermissionRequest = null;
    this.permissionResolver = null;
  }

  // Private methods

  private parseToolName(toolName: string): [string, string] {
    const parts = toolName.split('.');
    if (parts.length < 2) {
      throw new Error(`Invalid tool name format: ${toolName}. Expected: {toolbox_id}.{tool_name}`);
    }
    
    const toolboxId = parts[0];
    const actualToolName = parts.slice(1).join('.');
    return [toolboxId, actualToolName];
  }

  private findToolbox(toolboxId: string): Toolbox | undefined {
    return this.toolboxes.find(toolbox => toolbox.id === toolboxId);
  }

  private async checkPermission(request: PermissionRequest): Promise<boolean> {
    const { toolboxId, toolName, parameters, permissionLevel } = request;

    // No permission needed
    if (permissionLevel === 'none') {
      return true;
    }

    // Generate permission pattern based on permission level
    const permissionPattern = this.generatePermissionPattern(toolboxId, toolName, parameters, permissionLevel);
    
    // Check if permission already exists (except for 'always')
    if (permissionLevel !== 'always') {
      const isAllowed = await this.settingsStore.isPermissionAllowed(permissionPattern);
      if (isAllowed) {
        return true;
      }
    }

    // Request permission from user
    return await this.requestPermission(request);
  }

  private generatePermissionPattern(
    toolboxId: string, 
    toolName: string, 
    parameters: Record<string, any>, 
    permissionLevel: PermissionLevel
  ): string {
    const basePattern = `${toolboxId}.${toolName}`;
    
    switch (permissionLevel) {
      case 'none':
        return basePattern;
      
      case 'loose':
        return `${basePattern}(*)`;
      
      case 'strict':
      case 'always':
        // Create specific parameter pattern
        const paramPairs = Object.entries(parameters).map(([key, value]) => `${key}:${value}`);
        return `${basePattern}(${paramPairs.join(', ')})`;
      
      default:
        return basePattern;
    }
  }

  private async requestPermission(request: PermissionRequest): Promise<boolean> {
    const { toolboxId, toolName, parameters, permissionLevel } = request;
    
    // Create permission message
    const message = this.createPermissionMessage(toolboxId, toolName, parameters, permissionLevel);
    
    const domainOption: DomainOption = {
      message,
      choices: ['Allow', 'Deny'],
      defaultIndex: 1 // Default to "Deny" for security
    };

    this.pendingPermissionRequest = request;
    this.optionsSubject.next(domainOption);

    // Wait for user response
    return new Promise<boolean>((resolve) => {
      this.permissionResolver = resolve;
    });
  }

  private createPermissionMessage(
    toolboxId: string, 
    toolName: string, 
    parameters: Record<string, any>, 
    permissionLevel: PermissionLevel
  ): string {
    const paramStr = Object.entries(parameters)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');

    let scope = '';
    switch (permissionLevel) {
      case 'loose':
        scope = ' (for all future calls)';
        break;
      case 'strict':
        scope = ' (for this specific call)';
        break;
      case 'always':
        scope = ' (asking every time)';
        break;
    }

    return `Allow tool execution?\n\nTool: ${toolboxId}.${toolName}\nParameters: ${paramStr}${scope}`;
  }

  private async savePermission(request: PermissionRequest): Promise<void> {
    const { toolboxId, toolName, parameters, permissionLevel } = request;
    
    // Don't save 'always' permissions since they should always ask
    if (permissionLevel === 'always') {
      return;
    }

    const permissionPattern = this.generatePermissionPattern(toolboxId, toolName, parameters, permissionLevel);
    
    try {
      const settings = await this.settingsStore.getSettings();
      
      // Add to allow list if not already present
      if (!settings.permissions.allow.includes(permissionPattern)) {
        settings.permissions.allow.push(permissionPattern);
        await this.settingsStore.writeSettings(settings);
      }
    } catch (error) {
      // Log error but don't fail the operation
      console.error('Failed to save permission:', error);
    }
  }

  private generateOperationId(): string {
    return `tool_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private emitToolboxMessage(
    id: string,
    toolCall: ToolCall,
    status: 'executing' | 'failing' | 'succeed',
    message: string,
    result?: any,
    error?: string
  ): void {
    const toolboxMessage: ToolboxMessage = {
      id,
      toolCall,
      status,
      message,
      timestamp: new Date(),
      result,
      error
    };
    
    this.messagesSubject.next(toolboxMessage);
  }
}