import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { SettingsStore, SettingsConfig } from '../interfaces/settings-store.js';

/**
 * Settings service implementation with global and workspace settings support
 */
export class SettingsService implements SettingsStore {
  private readonly globalSettingsDir: string;
  private readonly globalSettingsFile: string;
  private readonly workspaceSettingsDir: string;
  private readonly workspaceSettingsFile: string;

  constructor(projectRoot: string = process.cwd()) {
    // Global settings in user home directory
    this.globalSettingsDir = path.join(os.homedir(), '.flowcode');
    this.globalSettingsFile = path.join(this.globalSettingsDir, 'settings.json');
    
    // Workspace settings in project directory
    this.workspaceSettingsDir = path.join(projectRoot, '.flowcode');
    this.workspaceSettingsFile = path.join(this.workspaceSettingsDir, 'settings.json');
  }

  // SettingsReader implementation

  async getSettings(): Promise<SettingsConfig> {
    const globalSettings = await this.loadSettingsFile(this.globalSettingsFile);
    const workspaceSettings = await this.loadSettingsFile(this.workspaceSettingsFile);
    
    return this.mergeSettings(globalSettings, workspaceSettings);
  }

  async getAllowedPermissions(): Promise<string[]> {
    const settings = await this.getSettings();
    return settings.permissions.allow;
  }

  async getDeniedPermissions(): Promise<string[]> {
    const settings = await this.getSettings();
    return settings.permissions.deny;
  }

  async isPermissionAllowed(permissionPattern: string): Promise<boolean> {
    const settings = await this.getSettings();
    
    // Check if explicitly denied first
    if (this.matchesAnyPattern(permissionPattern, settings.permissions.deny)) {
      return false;
    }

    // Check if explicitly allowed
    if (this.matchesAnyPattern(permissionPattern, settings.permissions.allow)) {
      return true;
    }

    // Default to denied if not explicitly allowed
    return false;
  }

  getSettingsPath(): string {
    return this.workspaceSettingsFile;
  }

  async settingsExists(): Promise<boolean> {
    try {
      await fs.access(this.workspaceSettingsFile);
      return true;
    } catch {
      return false;
    }
  }

  // SettingsWriter implementation

  async writeSettings(settings: SettingsConfig): Promise<boolean> {
    try {
      await this.ensureSettingsDirectory();
      await fs.writeFile(this.workspaceSettingsFile, JSON.stringify(settings, null, 2));
      return true;
    } catch {
      return false;
    }
  }

  async initializeSettings(): Promise<boolean> {
    try {
      await this.ensureSettingsDirectory();
      const defaultSettings = this.getDefaultSettings();
      await fs.writeFile(this.workspaceSettingsFile, JSON.stringify(defaultSettings, null, 2));
      return true;
    } catch {
      return false;
    }
  }

  async ensureSettingsDirectory(): Promise<boolean> {
    try {
      await fs.mkdir(this.workspaceSettingsDir, { recursive: true });
      return true;
    } catch {
      return false;
    }
  }

  // Private helper methods

  private async loadSettingsFile(filePath: string): Promise<SettingsConfig> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return this.getDefaultSettings();
    }
  }

  private mergeSettings(globalSettings: SettingsConfig, workspaceSettings: SettingsConfig): SettingsConfig {
    // Workspace settings have priority
    // If workspace denies something, it's denied regardless of global
    // If workspace allows something, it's allowed regardless of global
    
    const merged: SettingsConfig = {
      permissions: {
        allow: [...globalSettings.permissions.allow],
        deny: [...globalSettings.permissions.deny]
      }
    };

    // Add workspace permissions (workspace has priority)
    for (const permission of workspaceSettings.permissions.allow) {
      if (!merged.permissions.allow.includes(permission)) {
        merged.permissions.allow.push(permission);
      }
      // Remove from deny list if it exists there
      merged.permissions.deny = merged.permissions.deny.filter(p => p !== permission);
    }

    for (const permission of workspaceSettings.permissions.deny) {
      if (!merged.permissions.deny.includes(permission)) {
        merged.permissions.deny.push(permission);
      }
      // Remove from allow list if it exists there
      merged.permissions.allow = merged.permissions.allow.filter(p => p !== permission);
    }

    // Merge other settings (workspace overrides global)
    const { permissions: _, ...otherGlobalSettings } = globalSettings;
    const { permissions: __, ...otherWorkspaceSettings } = workspaceSettings;

    return {
      ...otherGlobalSettings,
      ...otherWorkspaceSettings,
      permissions: merged.permissions
    };
  }

  private getDefaultSettings(): SettingsConfig {
    return {
      permissions: {
        allow: [],
        deny: []
      }
    };
  }

  private matchesAnyPattern(permissionPattern: string, patterns: string[]): boolean {
    return patterns.some(pattern => this.matchesPattern(permissionPattern, pattern));
  }

  private matchesPattern(permissionPattern: string, pattern: string): boolean {
    // Exact match
    if (permissionPattern === pattern) {
      return true;
    }

    // Wildcard matching for parameters
    // Example: "file_tools.append_to_file(*)" matches "file_tools.append_to_file(filePath:/some/path)"
    const patternRegex = pattern
      .replace(/\*/g, '.*')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/\.\*/g, '.*');

    const regex = new RegExp(`^${patternRegex}$`);
    return regex.test(permissionPattern);
  }
}