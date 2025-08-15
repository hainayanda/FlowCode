import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionService } from '../../../src/application/services/session-service';
import { ConfigRepository } from '../../../src/application/stores/config-repository';
import { promises as fs } from 'fs';
import { existsSync } from 'fs';

// Mock file system
vi.mock('fs', () => ({
  promises: {
    mkdir: vi.fn(),
    writeFile: vi.fn(),
    readFile: vi.fn(),
    readdir: vi.fn()
  },
  existsSync: vi.fn()
}));

// Mock os module to control home directory
vi.mock('os', () => ({
  homedir: vi.fn(() => '/home/user')
}));

// Mock path module
vi.mock('path', () => ({
  join: vi.fn((...paths) => paths.join('/'))
}));

// Mock crypto to have deterministic session names for testing
vi.mock('crypto', () => ({
  createHash: vi.fn(() => ({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn(() => 'abcd1234efghijklmnop'),
  }))
}));

describe('SessionService', () => {
  let service: SessionService;
  let mockConfigStore: ConfigRepository;

  const mockSessionPaths = {
    sessionDir: '/home/user/.flowcode/session/abcd1234efgh',
    sqlDbPath: '/home/user/.flowcode/session/abcd1234efgh/sql-messages.db',
    vectorDbPath: '/home/user/.flowcode/session/abcd1234efgh/vector-messages.db',
    configPath: '/home/user/.flowcode/session/abcd1234efgh/session-config.json'
  };

  const mockVectorProvider = {
    provider: 'openai',
    model: 'text-embedding-3-small'
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockConfigStore = {
      getVectorProviderConfig: vi.fn(),
      updateVectorProviderConfig: vi.fn()
    } as any;

    service = new SessionService(mockConfigStore);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('initializeSession', () => {
    it('should successfully initialize a new session', async () => {
      vi.mocked(mockConfigStore.getVectorProviderConfig).mockResolvedValue(mockVectorProvider);
      vi.mocked(existsSync).mockReturnValue(false);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const result = await service.initializeSession();

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe('abcd1234efgh');
      expect(fs.mkdir).toHaveBeenCalledWith(mockSessionPaths.sessionDir, { recursive: true });
      expect(fs.writeFile).toHaveBeenCalledWith(
        mockSessionPaths.configPath,
        expect.stringContaining('"provider": "openai"')
      );
    });

    it('should fail if vector provider config cannot be retrieved', async () => {
      vi.mocked(mockConfigStore.getVectorProviderConfig).mockRejectedValue(new Error('Config not found'));

      const result = await service.initializeSession();

      expect(result.isSuccess).toBe(false);
      expect(result.error).toContain('Config not found');
    });

    it('should fail if generated session already exists', async () => {
      vi.mocked(mockConfigStore.getVectorProviderConfig).mockResolvedValue(mockVectorProvider);
      vi.mocked(existsSync).mockReturnValue(true);

      const result = await service.initializeSession();

      expect(result.isSuccess).toBe(false);
      expect(result.error).toContain('already exists');
    });
  });

  describe('getCurrentSession', () => {
    it('should return null when no session is active', async () => {
      const result = await service.getCurrentSession();

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(null);
    });

    it('should return current session info when session is active', async () => {
      const mockConfig = {
        createdDate: '2023-01-01T00:00:00.000Z',
        lastActiveDate: '2023-01-01T00:00:00.000Z',
        vectorProvider: mockVectorProvider
      };

      // First initialize a session
      vi.mocked(mockConfigStore.getVectorProviderConfig).mockResolvedValue(mockVectorProvider);
      vi.mocked(existsSync).mockReturnValue(false);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await service.initializeSession();

      // Mock reading the config
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConfig));

      const result = await service.getCurrentSession();

      expect(result.isSuccess).toBe(true);
      expect(result.value).toEqual({
        name: 'abcd1234efgh',
        createdDate: '2023-01-01T00:00:00.000Z',
        lastActiveDate: '2023-01-01T00:00:00.000Z',
        vectorProvider: mockVectorProvider
      });
    });
  });

  describe('getAllSession', () => {
    it('should return empty array if base directory does not exist', async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = await service.getAllSession();

      expect(result.isSuccess).toBe(true);
      expect(result.value).toEqual([]);
    });

    it('should return list of valid sessions sorted by last active date', async () => {
      const mockConfig1 = {
        createdDate: '2023-01-01T00:00:00.000Z',
        lastActiveDate: '2023-01-02T00:00:00.000Z',
        vectorProvider: mockVectorProvider
      };
      const mockConfig2 = {
        createdDate: '2023-01-03T00:00:00.000Z',
        lastActiveDate: '2023-01-04T00:00:00.000Z',
        vectorProvider: mockVectorProvider
      };

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(fs.readdir).mockResolvedValue([
        { name: 'session1', isDirectory: () => true },
        { name: 'session2', isDirectory: () => true },
        { name: 'file.txt', isDirectory: () => false }
      ] as any);
      
      vi.mocked(fs.readFile)
        .mockResolvedValueOnce(JSON.stringify(mockConfig1))
        .mockResolvedValueOnce(JSON.stringify(mockConfig2));

      const result = await service.getAllSession();

      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(2);
      // Should be sorted by last active date (most recent first)
      expect(result.value[0].name).toBe('session2');
      expect(result.value[1].name).toBe('session1');
    });
  });

  describe('switchSessions', () => {
    it('should successfully switch to a session with matching vector provider', async () => {
      const mockConfig = {
        createdDate: '2023-01-01T00:00:00.000Z',
        lastActiveDate: '2023-01-01T00:00:00.000Z',
        vectorProvider: mockVectorProvider
      };

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConfig));
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(mockConfigStore.getVectorProviderConfig).mockResolvedValue(mockVectorProvider);

      const result = await service.switchSessions('abcd1234efgh');

      expect(result.isSuccess).toBe(true);
      expect(fs.writeFile).toHaveBeenCalledWith(
        mockSessionPaths.configPath,
        expect.stringContaining('"lastActiveDate"')
      );
    });

    it('should fail when vector providers do not match', async () => {
      const mockConfig = {
        createdDate: '2023-01-01T00:00:00.000Z',
        lastActiveDate: '2023-01-01T00:00:00.000Z',
        vectorProvider: mockVectorProvider
      };

      const differentProvider = {
        provider: 'cohere',
        model: 'embed-english-v3.0'
      };

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConfig));
      vi.mocked(mockConfigStore.getVectorProviderConfig).mockResolvedValue(differentProvider);

      const result = await service.switchSessions('test-session');

      expect(result.isSuccess).toBe(false);
      expect(result.error).toContain('Vector provider mismatch');
      expect(result.error).toContain('openai/text-embedding-3-small');
      expect(result.error).toContain('cohere/embed-english-v3.0');
    });

    it('should fail if session does not exist', async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = await service.switchSessions('non-existent');

      expect(result.isSuccess).toBe(false);
      expect(result.error).toContain('does not exist');
    });
  });
});