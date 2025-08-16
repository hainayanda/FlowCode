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

  describe('getTaskmasterPrompt', () => {
    it('should return taskmaster prompt from markdown file', async () => {
      const mockPrompt = '# Taskmaster Prompt\n\nYou are a task master...';
      
      const fs = await import('fs/promises');
      vi.mocked(fs.readFile).mockResolvedValue(mockPrompt);

      const result = await configStore.getTaskmasterPrompt();

      expect(result).toBe('# Taskmaster Prompt\n\nYou are a task master...');
      expect(fs.readFile).toHaveBeenCalledWith('/test/project/.flowcode/taskmaster.md', 'utf-8');
    });

    it('should return null when taskmaster prompt file does not exist', async () => {
      const fs = await import('fs/promises');
      vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'));

      const result = await configStore.getTaskmasterPrompt();

      expect(result).toBeNull();
    });
  });

  describe('getWorkerPrompt', () => {
    it('should return worker prompt from markdown file', async () => {
      const mockPrompt = '# Code Worker\n\nYou are a code generation worker...';
      
      const fs = await import('fs/promises');
      vi.mocked(fs.readFile).mockResolvedValue(mockPrompt);

      const result = await configStore.getWorkerPrompt('code-worker');

      expect(result).toBe('# Code Worker\n\nYou are a code generation worker...');
      expect(fs.readFile).toHaveBeenCalledWith('/test/project/.flowcode/code-worker.md', 'utf-8');
    });

    it('should return null when worker prompt file does not exist', async () => {
      const fs = await import('fs/promises');
      vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'));

      const result = await configStore.getWorkerPrompt('nonexistent-worker');

      expect(result).toBeNull();
    });

    it('should trim whitespace from prompt content', async () => {
      const mockPrompt = '\n\n  # Code Worker\n\nYou are a code worker...  \n\n';
      
      const fs = await import('fs/promises');
      vi.mocked(fs.readFile).mockResolvedValue(mockPrompt);

      const result = await configStore.getWorkerPrompt('code-worker');

      expect(result).toBe('# Code Worker\n\nYou are a code worker...');
    });
  });
});