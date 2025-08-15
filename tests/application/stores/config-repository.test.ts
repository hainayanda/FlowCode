import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConfigRepository } from '../../../src/application/stores/config-repository';

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

describe('ConfigStore', () => {
  let configStore: ConfigRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    configStore = new ConfigRepository('/test/project');
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getConfig', () => {
    it('should successfully read config file', async () => {
      const mockConfig = {
        version: '1.0.0',
        vectorProvider: {
          provider: 'openai',
          model: 'text-embedding-3-small'
        },
        taskmaster: {
          provider: 'openai',
          model: 'gpt-4',
          temperature: 0.7
        },
        summarizer: {
          provider: 'openai',
          model: 'gpt-4',
          summarize_threshold: 10,
          preserve_recent_messages: 5,
          enabled: true
        },
        embedding: {
          provider: 'openai',
          model: 'text-embedding-3-small',
          enabled: true
        },
        workers: {}
      };

      const fs = await import('fs/promises');
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConfig));

      const result = await configStore.getConfig();

      expect(result).toEqual(mockConfig);
    });

    it('should handle file read errors', async () => {
      const fs = await import('fs/promises');
      vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'));

      await expect(configStore.getConfig()).rejects.toThrow('Failed to read config file');
    });
  });

  describe('getVectorProviderConfig', () => {
    it('should return vector provider config', async () => {
      const mockConfig = {
        vectorProvider: {
          provider: 'openai',
          model: 'text-embedding-3-small'
        }
      };

      const fs = await import('fs/promises');
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConfig));

      const result = await configStore.getVectorProviderConfig();

      expect(result).toEqual({
        provider: 'openai',
        model: 'text-embedding-3-small'
      });
    });

    it('should fail if vector provider config is missing', async () => {
      const mockConfig = {
        version: '1.0.0',
        taskmaster: { provider: 'openai', model: 'gpt-4', temperature: 0.7 },
        summarizer: { provider: 'openai', model: 'gpt-4', summarize_threshold: 10, preserve_recent_messages: 5, enabled: true },
        embedding: { provider: 'openai', model: 'text-embedding-3-small', enabled: true },
        workers: {}
      };

      const fs = await import('fs/promises');
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConfig));

      await expect(configStore.getVectorProviderConfig()).rejects.toThrow('Vector provider configuration not found');
    });
  });


  describe('updateVectorProviderConfig', () => {
    it('should update only vector provider config', async () => {
      const existingConfig = {
        vectorProvider: {
          provider: 'openai',
          model: 'text-embedding-3-small'
        },
        project: { name: 'test' }
      };

      const newVectorProvider = {
        provider: 'cohere',
        model: 'embed-english-v3.0'
      };

      const fs = await import('fs/promises');
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(existingConfig));
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await configStore.updateVectorProviderConfig(newVectorProvider);

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('config.json'),
        expect.stringContaining('"provider": "cohere"')
      );
    });
  });
});