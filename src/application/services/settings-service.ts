import { SettingsStore, SettingsConfig } from '../interfaces/settings-store.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

/**
 * Settings service implementation with global and workspace settings support
 */
export class SettingsService implements SettingsStore {
  private readonly globalSettingsPath: string;
  private readonly workspaceSettingsPath: string;
  private readonly workspaceSettingsDir: string;

  constructor(projectRoot: string = process.cwd()) {
    const homeDir = os.homedir();
    this.globalSettingsPath = path.join(homeDir, '.flowcode', 'settings.json');
    this.workspaceSettingsDir = path.join(projectRoot, '.flowcode');
    this.workspaceSettingsPath = path.join(this.workspaceSettingsDir, 'settings.json');
  }

  // SettingsReader implementation

  async getSettings(): Promise<SettingsConfig> {
    const defaultSettings: SettingsConfig = {
      permissions: {
        allow: [],
        deny: []
      }
    };

    try {
      // Read global settings
      let globalSettings: SettingsConfig;
      try {
        const globalContent = await fs.readFile(this.globalSettingsPath, 'utf-8');
        globalSettings = JSON.parse(globalContent);
      } catch {
        globalSettings = defaultSettings;
      }

      // Read workspace settings
      let workspaceSettings: SettingsConfig;
      try {
        const workspaceContent = await fs.readFile(this.workspaceSettingsPath, 'utf-8');
        workspaceSettings = JSON.parse(workspaceContent);
      } catch {
        workspaceSettings = defaultSettings;
      }

      // Merge settings: workspace overrides global
      const mergedSettings: SettingsConfig = {
        permissions: {
          allow: [...globalSettings.permissions.allow, ...workspaceSettings.permissions.allow],
          deny: [...globalSettings.permissions.deny, ...workspaceSettings.permissions.deny]
        }
      };

      // Apply workspace priority: workspace settings override global settings
      const finalAllow = mergedSettings.permissions.allow.filter(
        permission => !workspaceSettings.permissions.deny.includes(permission)
      );
      
      const finalDeny = mergedSettings.permissions.deny.filter(
        permission => !workspaceSettings.permissions.allow.includes(permission)
      );

      return {
        permissions: {
          allow: [...new Set(finalAllow)],
          deny: [...new Set(finalDeny)]
        }
      };
    } catch {
      return defaultSettings;
    }
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
    
    // Check explicit deny first (including wildcard matching)
    if (this.matchesAnyPattern(permissionPattern, settings.permissions.deny)) {
      return false;
    }
    
    // Check explicit allow (including wildcard matching)
    if (this.matchesAnyPattern(permissionPattern, settings.permissions.allow)) {
      return true;
    }
    
    // Default deny for patterns not explicitly allowed
    return false;
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

  getSettingsPath(): string {
    return this.workspaceSettingsPath;
  }

  async settingsExists(): Promise<boolean> {
    try {
      await fs.access(this.workspaceSettingsPath);
      return true;
    } catch {
      return false;
    }
  }

  // SettingsWriter implementation

  async writeSettings(settings: SettingsConfig): Promise<boolean> {
    try {
      await this.ensureSettingsDirectory();
      await fs.writeFile(this.workspaceSettingsPath, JSON.stringify(settings, null, 2));
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

  async initializeSettings(): Promise<boolean> {
    const dirCreated = await this.ensureSettingsDirectory();
    if (!dirCreated) return false;
    
    const defaultSettings: SettingsConfig = {
      permissions: {
        allow: [],
        deny: []
      }
    };
    
    return await this.writeSettings(defaultSettings);
  }
}