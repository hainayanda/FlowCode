import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CredentialService } from '../../../src/application/services/credential-service.js';
import { CredentialsConfig, ProviderCredential } from '../../../src/application/interfaces/credential-store.js';
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

describe('CredentialService', () => {
  let credentialService: CredentialService;
  let mockHomeDir: string;
  let credentialsFile: string;

  const mockCredentials: CredentialsConfig = {
    openai: {
      apiKey: 'openai-key',
      lastUsed: '2023-01-02T00:00:00.000Z'
    },
    anthropic: {
      apiKey: 'anthropic-key',
      lastUsed: '2023-01-03T00:00:00.000Z'
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockHomeDir = '/home/user';
    credentialsFile = '/home/user/.flowcode/credentials.json';

    // Setup path mocks
    mockOs.homedir.mockReturnValue(mockHomeDir);
    mockPath.join.mockImplementation((...paths) => paths.join('/'));

    credentialService = new CredentialService();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with correct paths', () => {
      expect(mockOs.homedir).toHaveBeenCalled();
      expect(mockPath.join).toHaveBeenCalledWith(mockHomeDir, '.flowcode');
      expect(mockPath.join).toHaveBeenCalledWith('/home/user/.flowcode', 'credentials.json');
    });
  });

  describe('getCredentials', () => {
    it('should read and parse credentials file', async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockCredentials));

      const result = await credentialService.getCredentials();

      expect(mockFs.readFile).toHaveBeenCalledWith(credentialsFile, 'utf-8');
      expect(result).toEqual(mockCredentials);
    });

    it('should throw error when file read fails', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      await expect(credentialService.getCredentials()).rejects.toThrow('Failed to read credentials file: File not found');
    });

    it('should throw error when JSON parsing fails', async () => {
      mockFs.readFile.mockResolvedValue('invalid json');

      await expect(credentialService.getCredentials()).rejects.toThrow('Failed to read credentials file:');
    });
  });

  describe('getProviderCredential', () => {
    it('should return credential for existing provider', async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockCredentials));

      const result = await credentialService.getProviderCredential('openai');

      expect(result).toEqual(mockCredentials.openai);
    });

    it('should return null for non-existing provider', async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockCredentials));

      const result = await credentialService.getProviderCredential('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getAllProviders', () => {
    it('should return all provider names', async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockCredentials));

      const result = await credentialService.getAllProviders();

      expect(result).toEqual(['openai', 'anthropic']);
    });
  });

  describe('hasCredential', () => {
    it('should return true for existing provider', async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockCredentials));

      const result = await credentialService.hasCredential('openai');

      expect(result).toBe(true);
    });

    it('should return false for non-existing provider', async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockCredentials));

      const result = await credentialService.hasCredential('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('credentialsExist', () => {
    it('should return true when file exists', async () => {
      mockFs.access.mockResolvedValue(undefined);

      const result = await credentialService.credentialsExist();

      expect(mockFs.access).toHaveBeenCalledWith(credentialsFile);
      expect(result).toBe(true);
    });

    it('should return false when file does not exist', async () => {
      mockFs.access.mockRejectedValue(new Error('File not found'));

      const result = await credentialService.credentialsExist();

      expect(result).toBe(false);
    });
  });

  describe('getCredentialsPath', () => {
    it('should return credentials file path', () => {
      const result = credentialService.getCredentialsPath();

      expect(result).toBe(credentialsFile);
    });
  });

  describe('writeCredentials', () => {
    it('should write credentials to file', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      await credentialService.writeCredentials(mockCredentials);

      expect(mockFs.mkdir).toHaveBeenCalledWith('/home/user/.flowcode', { recursive: true });
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        credentialsFile,
        JSON.stringify(mockCredentials, null, 2)
      );
    });

    it('should throw error when write fails', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockRejectedValue(new Error('Write error'));

      await expect(credentialService.writeCredentials(mockCredentials)).rejects.toThrow('Failed to write credentials file: Write error');
    });
  });

  describe('setProviderCredential', () => {
    it('should set credential for new provider', async () => {
      const newCredential: ProviderCredential = {
        apiKey: 'new-key',
        lastUsed: '2023-01-04T00:00:00.000Z'
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(mockCredentials));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      await credentialService.setProviderCredential('google', newCredential);

      const expectedCredentials = {
        ...mockCredentials,
        google: newCredential
      };

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        credentialsFile,
        JSON.stringify(expectedCredentials, null, 2)
      );
    });

    it('should update existing provider credential', async () => {
      const updatedCredential: ProviderCredential = {
        apiKey: 'updated-key',
        lastUsed: '2023-01-05T00:00:00.000Z'
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(mockCredentials));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      await credentialService.setProviderCredential('openai', updatedCredential);

      const expectedCredentials = {
        ...mockCredentials,
        openai: updatedCredential
      };

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        credentialsFile,
        JSON.stringify(expectedCredentials, null, 2)
      );
    });
  });

  describe('updateLastUsed', () => {
    it('should update lastUsed timestamp for existing provider', async () => {
      const mockDate = new Date('2023-01-10T00:00:00.000Z');
      vi.setSystemTime(mockDate);

      mockFs.readFile.mockResolvedValue(JSON.stringify(mockCredentials));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      await credentialService.updateLastUsed('openai');

      const expectedCredentials = {
        ...mockCredentials,
        openai: {
          ...mockCredentials.openai,
          lastUsed: '2023-01-10T00:00:00.000Z'
        }
      };

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        credentialsFile,
        JSON.stringify(expectedCredentials, null, 2)
      );

      vi.useRealTimers();
    });

    it('should throw error for non-existing provider', async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockCredentials));

      await expect(credentialService.updateLastUsed('nonexistent')).rejects.toThrow("Provider 'nonexistent' not found in credentials");
    });
  });

  describe('removeProviderCredential', () => {
    it('should remove provider credential', async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockCredentials));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      await credentialService.removeProviderCredential('openai');

      const expectedCredentials = {
        anthropic: mockCredentials.anthropic
      };

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        credentialsFile,
        JSON.stringify(expectedCredentials, null, 2)
      );
    });
  });

  describe('ensureCredentialsDirectory', () => {
    it('should create credentials directory', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);

      await credentialService.ensureCredentialsDirectory();

      expect(mockFs.mkdir).toHaveBeenCalledWith('/home/user/.flowcode', { recursive: true });
    });

    it('should throw error when directory creation fails', async () => {
      mockFs.mkdir.mockRejectedValue(new Error('Permission denied'));

      await expect(credentialService.ensureCredentialsDirectory()).rejects.toThrow('Failed to create credentials directory: Permission denied');
    });
  });
});