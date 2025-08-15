import { SettingsStore, SettingsConfig } from '../../../src/application/interfaces/settings-store.js';

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