import { Observable, EMPTY } from 'rxjs';
import { Toolbox, ToolDefinition, ToolCall, ToolResult, PermissionLevel, ToolboxMessage } from '../../../src/application/interfaces/toolbox.js';
import { SettingsStore, SettingsConfig } from '../../../src/application/interfaces/settings-store.js';

/**
 * Mock Toolbox for testing
 */
export class MockToolbox implements Toolbox {
  public executeToolCalled = false;
  public lastToolCall: ToolCall | null = null;
  public mockResult: ToolResult = { success: true, message: 'Mock tool executed' };
  public mockTools: ToolDefinition[] = [];

  constructor(
    public readonly id: string,
    public readonly description: string
  ) {}

  /**
   * Mock toolboxes don't emit messages - this is handled by ToolboxService
   */
  readonly messages$: Observable<ToolboxMessage> = EMPTY;

  getTools(): ToolDefinition[] {
    return this.mockTools;
  }

  supportsTool(toolName: string): boolean {
    return this.mockTools.some(tool => tool.name === toolName);
  }

  async executeTool(toolCall: ToolCall): Promise<ToolResult> {
    this.executeToolCalled = true;
    this.lastToolCall = toolCall;
    return this.mockResult;
  }

  // Test helpers
  setTools(tools: ToolDefinition[]): void {
    this.mockTools = tools;
  }

  setResult(result: ToolResult): void {
    this.mockResult = result;
  }

  reset(): void {
    this.executeToolCalled = false;
    this.lastToolCall = null;
    this.mockResult = { success: true, message: 'Mock tool executed' };
  }
}

/**
 * Mock SettingsStore for testing
 */
export class MockSettingsStore implements SettingsStore {
  public writeSettingsCalled = false;
  public lastWrittenSettings: SettingsConfig | null = null;
  public isPermissionAllowedCalled = false;
  public lastCheckedPermission: string | null = null;
  public mockSettings: SettingsConfig = {
    permissions: {
      allow: [],
      deny: []
    }
  };
  public mockPermissionResult = false;

  // SettingsReader implementation
  async getSettings(): Promise<SettingsConfig> {
    return { ...this.mockSettings };
  }

  async getAllowedPermissions(): Promise<string[]> {
    return [...this.mockSettings.permissions.allow];
  }

  async getDeniedPermissions(): Promise<string[]> {
    return [...this.mockSettings.permissions.deny];
  }

  async isPermissionAllowed(permissionPattern: string): Promise<boolean> {
    this.isPermissionAllowedCalled = true;
    this.lastCheckedPermission = permissionPattern;
    return this.mockPermissionResult;
  }

  getSettingsPath(): string {
    return '/test/.flowcode/settings.json';
  }

  async settingsExists(): Promise<boolean> {
    return true;
  }

  // SettingsWriter implementation
  async writeSettings(settings: SettingsConfig): Promise<boolean> {
    this.writeSettingsCalled = true;
    this.lastWrittenSettings = { ...settings };
    return true;
  }

  async initializeSettings(): Promise<boolean> {
    return true;
  }

  async ensureSettingsDirectory(): Promise<boolean> {
    return true;
  }

  // Test helpers
  setSettings(settings: SettingsConfig): void {
    this.mockSettings = { ...settings };
  }

  setPermissionResult(allowed: boolean): void {
    this.mockPermissionResult = allowed;
  }

  reset(): void {
    this.writeSettingsCalled = false;
    this.lastWrittenSettings = null;
    this.isPermissionAllowedCalled = false;
    this.lastCheckedPermission = null;
    this.mockSettings = {
      permissions: {
        allow: [],
        deny: []
      }
    };
    this.mockPermissionResult = false;
  }
}

/**
 * Helper function to create test tool definitions
 */
export function createTestToolDefinition(
  name: string,
  permission: PermissionLevel = 'none',
  description = 'Test tool'
): ToolDefinition {
  return {
    name,
    description,
    parameters: [
      { name: 'testParam', type: 'string', description: 'Test parameter', required: true }
    ],
    permission
  };
}

/**
 * Helper function to create test tool calls
 */
export function createTestToolCall(
  name: string,
  parameters: Record<string, any> = { testParam: 'testValue' }
): ToolCall {
  return {
    name,
    parameters
  };
}