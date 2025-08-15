import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConfigService } from '../../../src/application/services/config-service.js';
import { FlowCodeConfig, TaskmasterConfig, WorkerConfig } from '../../../src/application/interfaces/config-store.js';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock fs module
vi.mock('fs/promises');
vi.mock('path');

const mockFs = vi.mocked(fs);
const mockPath = vi.mocked(path);

describe('ConfigService', () => {
  let configService: ConfigService;
  let mockProjectRoot: string;
  let configFile: string;

  const mockConfig: FlowCodeConfig = {
    version: '1.0.0',
    taskmaster: {
      provider: 'openai',
      model: 'gpt-4',
      temperature: 0.7,
    },
    summarizer: {
      provider: 'openai',
      model: 'gpt-4',
      enabled: true,
      temperature: 0.7,
    },
    embedding: {
      provider: 'openai',
      model: 'text-embedding-3-small',
      enabled: true
    },
    workers: {
      'code-worker': {
        provider: 'openai',
        model: 'gpt-4',
        temperature: 0.5,
        enabled: true,
        description: 'Code generation worker'
      },
      'test-worker': {
        provider: 'anthropic',
        model: 'claude-3',
        temperature: 0.3,
        enabled: false,
        description: 'Test generation worker'
      }
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockProjectRoot = '/test/project';
    configFile = '/test/project/.flowcode/config.json';

    // Setup path mocks
    mockPath.join.mockImplementation((...paths) => paths.join('/'));

    configService = new ConfigService(mockProjectRoot);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with correct paths', () => {
      expect(mockPath.join).toHaveBeenCalledWith(mockProjectRoot, '.flowcode');
      expect(mockPath.join).toHaveBeenCalledWith('/test/project/.flowcode', 'config.json');
    });

    it('should use current working directory when no project root provided', () => {
      const originalCwd = process.cwd;
      process.cwd = vi.fn().mockReturnValue('/current/working/dir');

      new ConfigService();

      expect(mockPath.join).toHaveBeenCalledWith('/current/working/dir', '.flowcode');

      process.cwd = originalCwd;
    });
  });

  describe('getConfig', () => {
    it('should read and parse config file', async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockConfig));

      const result = await configService.getConfig();

      expect(mockFs.readFile).toHaveBeenCalledWith(configFile, 'utf-8');
      expect(result).toEqual(mockConfig);
    });

    it('should throw error when file read fails', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      await expect(configService.getConfig()).rejects.toThrow('Failed to read config file: File not found');
    });
  });

  describe('getTaskmasterConfig', () => {
    it('should return taskmaster config section', async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockConfig));

      const result = await configService.getTaskmasterConfig();

      expect(result).toEqual(mockConfig.taskmaster);
    });
  });

  describe('getSummarizerConfig', () => {
    it('should return summarizer config section', async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockConfig));

      const result = await configService.getSummarizerConfig();

      expect(result).toEqual(mockConfig.summarizer);
    });
  });

  describe('getEmbeddingConfig', () => {
    it('should return embedding config section', async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockConfig));

      const result = await configService.getEmbeddingConfig();

      expect(result).toEqual(mockConfig.embedding);
    });
  });

  describe('getWorkerConfig', () => {
    it('should return worker config for existing worker', async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockConfig));

      const result = await configService.getWorkerConfig('code-worker');

      expect(result).toEqual(mockConfig.workers['code-worker']);
    });

    it('should return null for non-existing worker', async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockConfig));

      const result = await configService.getWorkerConfig('nonexistent-worker');

      expect(result).toBeNull();
    });
  });

  describe('getAllWorkers', () => {
    it('should return all workers', async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockConfig));

      const result = await configService.getAllWorkers();

      expect(result).toEqual(mockConfig.workers);
    });
  });

  describe('getEnabledWorkers', () => {
    it('should return only enabled workers', async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockConfig));

      const result = await configService.getEnabledWorkers();

      expect(result).toEqual({
        'code-worker': mockConfig.workers['code-worker']
      });
    });
  });

  describe('configExists', () => {
    it('should return true when file exists', async () => {
      mockFs.access.mockResolvedValue(undefined);

      const result = await configService.configExists();

      expect(mockFs.access).toHaveBeenCalledWith(configFile);
      expect(result).toBe(true);
    });

    it('should return false when file does not exist', async () => {
      mockFs.access.mockRejectedValue(new Error('File not found'));

      const result = await configService.configExists();

      expect(result).toBe(false);
      expect(mockFs.access).toHaveBeenCalledWith(expect.stringContaining('config.json'));
    });
  });

  describe('getConfigPath', () => {
    it('should return config file path', () => {
      const result = configService.getConfigPath();

      expect(result).toBe(configFile);
    });
  });

  describe('writeConfig', () => {
    it('should write config to file', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      await configService.writeConfig(mockConfig);

      expect(mockFs.mkdir).toHaveBeenCalledWith('/test/project/.flowcode', { recursive: true });
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        configFile,
        JSON.stringify(mockConfig, null, 2)
      );
    });

    it('should throw error when write fails', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockRejectedValue(new Error('Write error'));

      await expect(configService.writeConfig(mockConfig)).rejects.toThrow('Failed to write config file: Write error');
    });
  });

  describe('updateTaskmasterConfig', () => {
    it('should update taskmaster config section', async () => {
      const updatedTaskmasterConfig: TaskmasterConfig = {
        provider: 'anthropic',
        model: 'claude-3',
        temperature: 0.5,
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(mockConfig));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      await configService.updateTaskmasterConfig(updatedTaskmasterConfig);

      const expectedConfig = {
        ...mockConfig,
        taskmaster: updatedTaskmasterConfig
      };

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        configFile,
        JSON.stringify(expectedConfig, null, 2)
      );
    });
  });

  describe('updateWorkerConfig', () => {
    it('should update worker config', async () => {
      const updatedWorkerConfig: WorkerConfig = {
        provider: 'google',
        model: 'gemini-pro',
        temperature: 0.8,
        enabled: true,
        description: ''
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(mockConfig));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      await configService.updateWorkerConfig('code-worker', updatedWorkerConfig);

      const expectedConfig = {
        ...mockConfig,
        workers: {
          ...mockConfig.workers,
          'code-worker': updatedWorkerConfig
        }
      };

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        configFile,
        JSON.stringify(expectedConfig, null, 2)
      );
    });
  });

  describe('ensureConfigDirectory', () => {
    it('should create config directory', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);

      await configService.ensureConfigDirectory();

      expect(mockFs.mkdir).toHaveBeenCalledWith('/test/project/.flowcode', { recursive: true });
    });

    it('should throw error when directory creation fails', async () => {
      mockFs.mkdir.mockRejectedValue(new Error('Permission denied'));

      await expect(configService.ensureConfigDirectory()).rejects.toThrow('Failed to create config directory: Permission denied');
    });
  });
});