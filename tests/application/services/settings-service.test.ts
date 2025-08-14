import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SettingsService } from '../../../src/application/services/settings-service.js';
import { SettingsConfig } from '../../../src/application/interfaces/settings-store.js';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

// Mock fs module
vi.mock('fs/promises');
vi.mock('os');
vi.mock('path');

const mockFs = vi.mocked(fs);
const mockOs = vi.mocked(os);
const mockPath = vi.mocked(path);

describe('SettingsService', () => {
  let settingsService: SettingsService;
  let mockProjectRoot: string;
  let mockHomeDir: string;
  let globalSettingsFile: string;
  let workspaceSettingsFile: string;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockProjectRoot = '/test/project';
    mockHomeDir = '/home/user';
    globalSettingsFile = '/home/user/.flowcode/settings.json';
    workspaceSettingsFile = '/test/project/.flowcode/settings.json';

    // Setup path mocks
    mockOs.homedir.mockReturnValue(mockHomeDir);
    mockPath.join.mockImplementation((...paths) => paths.join('/'));

    settingsService = new SettingsService(mockProjectRoot);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Reading Settings', () => {
    it('should return default settings when no files exist', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      const settings = await settingsService.getSettings();

      expect(settings).toEqual({
        permissions: {
          allow: [],
          deny: []
        }
      });
    });

    it('should read and merge global and workspace settings', async () => {
      const globalSettings: SettingsConfig = {
        permissions: {
          allow: ['global.tool(*)'],
          deny: ['global.dangerous(*)']
        }
      };

      const workspaceSettings: SettingsConfig = {
        permissions: {
          allow: ['workspace.tool(*)'],
          deny: ['workspace.dangerous(*)']
        }
      };

      mockFs.readFile.mockImplementation((filePath: string) => {
        if (filePath === globalSettingsFile) {
          return Promise.resolve(JSON.stringify(globalSettings));
        }
        if (filePath === workspaceSettingsFile) {
          return Promise.resolve(JSON.stringify(workspaceSettings));
        }
        return Promise.reject(new Error('File not found'));
      });

      const settings = await settingsService.getSettings();

      expect(settings.permissions.allow).toContain('global.tool(*)');
      expect(settings.permissions.allow).toContain('workspace.tool(*)');
      expect(settings.permissions.deny).toContain('global.dangerous(*)');
      expect(settings.permissions.deny).toContain('workspace.dangerous(*)');
    });

    it('should prioritize workspace settings over global settings', async () => {
      const globalSettings: SettingsConfig = {
        permissions: {
          allow: ['shared.tool(*)'],
          deny: []
        }
      };

      const workspaceSettings: SettingsConfig = {
        permissions: {
          allow: [],
          deny: ['shared.tool(*)'] // Workspace denies what global allows
        }
      };

      mockFs.readFile.mockImplementation((filePath: string) => {
        if (filePath === globalSettingsFile) {
          return Promise.resolve(JSON.stringify(globalSettings));
        }
        if (filePath === workspaceSettingsFile) {
          return Promise.resolve(JSON.stringify(workspaceSettings));
        }
        return Promise.reject(new Error('File not found'));
      });

      const settings = await settingsService.getSettings();

      // Workspace deny should override global allow
      expect(settings.permissions.allow).not.toContain('shared.tool(*)');
      expect(settings.permissions.deny).toContain('shared.tool(*)');
    });

    it('should handle workspace allowing what global denies', async () => {
      const globalSettings: SettingsConfig = {
        permissions: {
          allow: [],
          deny: ['shared.tool(*)']
        }
      };

      const workspaceSettings: SettingsConfig = {
        permissions: {
          allow: ['shared.tool(*)'], // Workspace allows what global denies
          deny: []
        }
      };

      mockFs.readFile.mockImplementation((filePath: string) => {
        if (filePath === globalSettingsFile) {
          return Promise.resolve(JSON.stringify(globalSettings));
        }
        if (filePath === workspaceSettingsFile) {
          return Promise.resolve(JSON.stringify(workspaceSettings));
        }
        return Promise.reject(new Error('File not found'));
      });

      const settings = await settingsService.getSettings();

      // Workspace allow should override global deny
      expect(settings.permissions.allow).toContain('shared.tool(*)');
      expect(settings.permissions.deny).not.toContain('shared.tool(*)');
    });
  });

  describe('Permission Checking', () => {
    it('should return true for explicitly allowed permissions', async () => {
      const settings: SettingsConfig = {
        permissions: {
          allow: ['file_tools.append_to_file(*)'],
          deny: []
        }
      };

      mockFs.readFile.mockImplementation((filePath: string) => {
        if (filePath === workspaceSettingsFile) {
          return Promise.resolve(JSON.stringify(settings));
        }
        return Promise.reject(new Error('File not found'));
      });

      const isAllowed = await settingsService.isPermissionAllowed('file_tools.append_to_file(filePath:/test/file.txt)');
      expect(isAllowed).toBe(true);
    });

    it('should return false for explicitly denied permissions', async () => {
      const settings: SettingsConfig = {
        permissions: {
          allow: [],
          deny: ['workspace_tools.delete_file_or_directory(*)']
        }
      };

      mockFs.readFile.mockImplementation((filePath: string) => {
        if (filePath === workspaceSettingsFile) {
          return Promise.resolve(JSON.stringify(settings));
        }
        return Promise.reject(new Error('File not found'));
      });

      const isAllowed = await settingsService.isPermissionAllowed('workspace_tools.delete_file_or_directory(path:/test/file.txt)');
      expect(isAllowed).toBe(false);
    });

    it('should return false for permissions not explicitly allowed', async () => {
      const settings: SettingsConfig = {
        permissions: {
          allow: [],
          deny: []
        }
      };

      mockFs.readFile.mockImplementation((filePath: string) => {
        if (filePath === workspaceSettingsFile) {
          return Promise.resolve(JSON.stringify(settings));
        }
        return Promise.reject(new Error('File not found'));
      });

      const isAllowed = await settingsService.isPermissionAllowed('bash_tools.execute_command(command:rm -rf /)');
      expect(isAllowed).toBe(false);
    });

    it('should prioritize deny over allow for same permission', async () => {
      const settings: SettingsConfig = {
        permissions: {
          allow: ['file_tools.append_to_file(*)'],
          deny: ['file_tools.append_to_file(filePath:/sensitive/file.txt)']
        }
      };

      mockFs.readFile.mockImplementation((filePath: string) => {
        if (filePath === workspaceSettingsFile) {
          return Promise.resolve(JSON.stringify(settings));
        }
        return Promise.reject(new Error('File not found'));
      });

      const isAllowedGeneral = await settingsService.isPermissionAllowed('file_tools.append_to_file(filePath:/normal/file.txt)');
      const isAllowedSensitive = await settingsService.isPermissionAllowed('file_tools.append_to_file(filePath:/sensitive/file.txt)');

      expect(isAllowedGeneral).toBe(true);
      expect(isAllowedSensitive).toBe(false);
    });
  });

  describe('Writing Settings', () => {
    it('should write settings to workspace file only', async () => {
      const settings: SettingsConfig = {
        permissions: {
          allow: ['new.permission(*)'],
          deny: []
        }
      };

      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      const result = await settingsService.writeSettings(settings);

      expect(result).toBe(true);
      expect(mockFs.mkdir).toHaveBeenCalledWith('/test/project/.flowcode', { recursive: true });
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        workspaceSettingsFile,
        JSON.stringify(settings, null, 2)
      );
    });

    it('should handle write errors gracefully', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockRejectedValue(new Error('Permission denied'));

      const settings: SettingsConfig = {
        permissions: { allow: [], deny: [] }
      };

      const result = await settingsService.writeSettings(settings);

      expect(result).toBe(false);
    });
  });

  describe('Settings File Management', () => {
    it('should return correct workspace settings path', () => {
      const path = settingsService.getSettingsPath();
      expect(path).toBe(workspaceSettingsFile);
    });

    it('should check if workspace settings exists', async () => {
      mockFs.access.mockResolvedValue(undefined);

      const exists = await settingsService.settingsExists();

      expect(exists).toBe(true);
      expect(mockFs.access).toHaveBeenCalledWith(workspaceSettingsFile);
    });

    it('should return false when workspace settings does not exist', async () => {
      mockFs.access.mockRejectedValue(new Error('File not found'));

      const exists = await settingsService.settingsExists();

      expect(exists).toBe(false);
    });

    it('should initialize workspace settings with defaults', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      const result = await settingsService.initializeSettings();

      expect(result).toBe(true);
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        workspaceSettingsFile,
        JSON.stringify({
          permissions: {
            allow: [],
            deny: []
          }
        }, null, 2)
      );
    });

    it('should ensure workspace settings directory exists', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);

      const result = await settingsService.ensureSettingsDirectory();

      expect(result).toBe(true);
      expect(mockFs.mkdir).toHaveBeenCalledWith('/test/project/.flowcode', { recursive: true });
    });
  });

  describe('Permission List Methods', () => {
    it('should return merged allowed permissions', async () => {
      const globalSettings: SettingsConfig = {
        permissions: {
          allow: ['global.tool(*)'],
          deny: []
        }
      };

      const workspaceSettings: SettingsConfig = {
        permissions: {
          allow: ['workspace.tool(*)'],
          deny: []
        }
      };

      mockFs.readFile.mockImplementation((filePath: string) => {
        if (filePath === globalSettingsFile) {
          return Promise.resolve(JSON.stringify(globalSettings));
        }
        if (filePath === workspaceSettingsFile) {
          return Promise.resolve(JSON.stringify(workspaceSettings));
        }
        return Promise.reject(new Error('File not found'));
      });

      const allowedPermissions = await settingsService.getAllowedPermissions();

      expect(allowedPermissions).toContain('global.tool(*)');
      expect(allowedPermissions).toContain('workspace.tool(*)');
    });

    it('should return merged denied permissions', async () => {
      const globalSettings: SettingsConfig = {
        permissions: {
          allow: [],
          deny: ['global.dangerous(*)']
        }
      };

      const workspaceSettings: SettingsConfig = {
        permissions: {
          allow: [],
          deny: ['workspace.dangerous(*)']
        }
      };

      mockFs.readFile.mockImplementation((filePath: string) => {
        if (filePath === globalSettingsFile) {
          return Promise.resolve(JSON.stringify(globalSettings));
        }
        if (filePath === workspaceSettingsFile) {
          return Promise.resolve(JSON.stringify(workspaceSettings));
        }
        return Promise.reject(new Error('File not found'));
      });

      const deniedPermissions = await settingsService.getDeniedPermissions();

      expect(deniedPermissions).toContain('global.dangerous(*)');
      expect(deniedPermissions).toContain('workspace.dangerous(*)');
    });
  });
});