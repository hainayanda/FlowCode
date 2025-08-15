import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { SettingsReader, SettingsWriter, SettingsConfig } from '../interfaces/settings-store';

export class SettingsRepository implements SettingsReader, SettingsWriter {
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
  async getAllowedPermissions(): Promise<string[]> {
    try {
      const settings = await this.getSettings();
      return settings.permissions?.allow || [];
    } catch {
      return [];
    }
  }

  async getDeniedPermissions(): Promise<string[]> {
    try {
      const settings = await this.getSettings();
      return settings.permissions?.deny || [];
    } catch {
      return [];
    }
  }

  async isPermissionAllowed(permissionPattern: string): Promise<boolean> {
    try {
      const settings = await this.getSettings();
      
      // Check if explicitly denied first
      if (this.matchesAnyPattern(permissionPattern, settings.permissions?.deny || [])) {
        return false;
      }

      // Check if explicitly allowed
      if (this.matchesAnyPattern(permissionPattern, settings.permissions?.allow || [])) {
        return true;
      }

      // Default to denied if not explicitly allowed
      return false;
    } catch {
      return false;
    }
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
      await this.updateSettings(settings);
      return true;
    } catch {
      return false;
    }
  }

  async ensureSettingsDirectory(): Promise<boolean> {
    try {
      await this.ensureSettingsDirectoryInternal();
      return true;
    } catch {
      return false;
    }
  }

  async initializeSettings(): Promise<boolean> {
    try {
      await this.ensureSettingsDirectoryInternal();
      const defaultSettings = this.getDefaultSettings();
      await fs.writeFile(this.workspaceSettingsFile, JSON.stringify(defaultSettings, null, 2));
      return true;
    } catch {
      return false;
    }
  }

  // Core settings methods
  async getSettings(): Promise<SettingsConfig> {
    try {
      const globalSettings = await this.loadSettingsFile(this.globalSettingsFile);
      const workspaceSettings = await this.loadSettingsFile(this.workspaceSettingsFile);
      
      return this.mergeSettings(globalSettings, workspaceSettings);
    } catch (error) {
      throw new Error(`Failed to get settings: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async updateSettings(settings: Partial<SettingsConfig>): Promise<void> {
    try {
      const currentSettings = await this.getSettings();
      const updatedSettings = { ...currentSettings, ...settings };
      await this.ensureSettingsDirectoryInternal();
      await fs.writeFile(this.workspaceSettingsFile, JSON.stringify(updatedSettings, null, 2));
    } catch (error) {
      throw new Error(`Failed to update settings: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getSetting<T>(key: string): Promise<T | null> {
    try {
      const settings = await this.getSettings();
      const value = settings[key] as T;
      return value || null;
    } catch (error) {
      throw new Error(`Failed to get setting '${key}': ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async updateSetting<T>(key: string, value: T): Promise<void> {
    await this.updateSettings({ [key]: value });
  }

  private async loadSettingsFile(filePath: string): Promise<SettingsConfig> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return this.getDefaultSettings();
    }
  }

  private mergeSettings(globalSettings: SettingsConfig, workspaceSettings: SettingsConfig): SettingsConfig {
    // Deep merge permissions arrays
    const mergedPermissions = {
      allow: [
        ...(globalSettings.permissions?.allow || []),
        ...(workspaceSettings.permissions?.allow || [])
      ],
      deny: [
        ...(globalSettings.permissions?.deny || []),
        ...(workspaceSettings.permissions?.deny || [])
      ]
    };

    return {
      ...globalSettings,
      ...workspaceSettings,
      permissions: mergedPermissions
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

  private async ensureSettingsDirectoryInternal(): Promise<void> {
    try {
      await fs.mkdir(this.workspaceSettingsDir, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to create settings directory: ${error instanceof Error ? error.message : String(error)}`);
    }
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