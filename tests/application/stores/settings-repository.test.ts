import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SettingsRepository } from '../../../src/application/stores/settings-repository';

// Mock fs/promises module directly  
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  access: vi.fn()
}));

// Mock path module
vi.mock('path', () => ({
  join: vi.fn((...paths) => paths.join('/'))
}));

// Mock os module
vi.mock('os', () => ({
  homedir: vi.fn(() => '/home/user')
}));

describe('SettingsStore', () => {
  let settingsStore: SettingsRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    settingsStore = new SettingsRepository('/test/project');
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getSettings', () => {
    it('should merge global and workspace settings', async () => {
      const globalSettings = {
        permissions: {
          allow: ['global_action'],
          deny: []
        }
      };

      const workspaceSettings = {
        permissions: {
          allow: ['workspace_action'],
          deny: []
        }
      };

      const fs = await import('fs/promises');
      vi.mocked(fs.readFile)
        .mockResolvedValueOnce(JSON.stringify(globalSettings))
        .mockResolvedValueOnce(JSON.stringify(workspaceSettings));

      const result = await settingsStore.getSettings();

      expect(result).toEqual({
        permissions: {
          allow: ['global_action', 'workspace_action'],
          deny: []
        }
      });
    });

    it('should return default settings when files do not exist', async () => {
      const fs = await import('fs/promises');
      vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'));

      const result = await settingsStore.getSettings();

      expect(result).toEqual({
        permissions: {
          allow: [],
          deny: []
        }
      });
    });
  });

  describe('getSetting', () => {
    it('should return specific setting value', async () => {
      const settings = {
        testKey: 'testValue',
        permissions: {
          allow: [],
          deny: []
        }
      };

      const fs = await import('fs/promises');
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(settings));

      const result = await settingsStore.getSetting<string>('testKey');

      expect(result).toBe('testValue');
    });

    it('should return null for non-existent setting', async () => {
      const settings = {
        permissions: {
          allow: [],
          deny: []
        }
      };

      const fs = await import('fs/promises');
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(settings));

      const result = await settingsStore.getSetting<string>('nonExistent');

      expect(result).toBe(null);
    });
  });

  describe('updateSettings', () => {
    it('should successfully update settings', async () => {
      const existingSettings = {
        permissions: {
          allow: ['action1'],
          deny: []
        }
      };

      const updateData = {
        newKey: 'newValue'
      };

      const fs = await import('fs/promises');
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(existingSettings));
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await settingsStore.updateSettings(updateData);

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('settings.json'),
        expect.stringContaining('"newKey": "newValue"')
      );
    });

    it('should handle write errors', async () => {
      const existingSettings = { permissions: { allow: [], deny: [] } };

      const fs = await import('fs/promises');
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(existingSettings));
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockRejectedValue(new Error('Permission denied'));

      await expect(settingsStore.updateSettings({ newKey: 'value' })).rejects.toThrow('Permission denied');
    });
  });

  describe('updateSetting', () => {
    it('should update a single setting', async () => {
      const existingSettings = {
        permissions: {
          allow: [],
          deny: []
        }
      };

      const fs = await import('fs/promises');
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(existingSettings));
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await settingsStore.updateSetting('testKey', 'testValue');

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('settings.json'),
        expect.stringContaining('"testKey": "testValue"')
      );
    });
  });
});