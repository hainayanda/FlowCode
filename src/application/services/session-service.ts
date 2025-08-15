import { SessionManaging, SessionInfo } from '../interfaces/session-managing';
import { ConfigRepository } from '../stores/config-repository';
import { Result } from '../shared/result';
import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { createHash } from 'crypto';

interface SessionConfig {
  createdDate: string;
  lastActiveDate: string;
  vectorProvider: {
    provider: string;
    model: string;
  };
}

interface SessionPaths {
  sqlDbPath: string;
  vectorDbPath: string;
  configPath: string;
  sessionDir: string;
}

export class SessionService implements SessionManaging {
  private currentSession: string | null = null;
  private readonly configStore: ConfigRepository;
  private readonly baseSessionDir: string;

  constructor(configStore: ConfigRepository) {
    this.configStore = configStore;
    this.baseSessionDir = join(homedir(), '.flowcode', 'session');
  }

  async initializeSession(): Promise<Result<SessionInfo, string>> {
    try {
      // Get current vector provider config
      const vectorProvider = await this.configStore.getVectorProviderConfig();

      // Generate unique session name based on current date
      const sessionName = this.generateSessionName();
      const paths = this.getSessionPaths(sessionName);

      // Check if session already exists (extremely unlikely but safety check)
      if (existsSync(paths.sessionDir)) {
        return Result.failure(`Session '${sessionName}' already exists. Please try again.`);
      }

      // Create session directory
      await fs.mkdir(paths.sessionDir, { recursive: true });

      // Create session config
      const now = new Date().toISOString();
      const config: SessionConfig = {
        createdDate: now,
        lastActiveDate: now,
        vectorProvider: vectorProvider
      };

      await fs.writeFile(paths.configPath, JSON.stringify(config, null, 2));

      // Set as current session
      this.currentSession = sessionName;

      const sessionInfo: SessionInfo = {
        name: sessionName,
        createdDate: config.createdDate,
        lastActiveDate: config.lastActiveDate,
        vectorProvider: config.vectorProvider
      };

      return Result.success(sessionInfo);
    } catch (error) {
      return Result.failure(`Failed to initialize session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getCurrentSession(): Promise<Result<SessionInfo | null, string>> {
    try {
      if (!this.currentSession) {
        return Result.success(null);
      }

      const configResult = await this.getSessionConfig(this.currentSession);
      if (!configResult.isSuccess) {
        // Current session is invalid, clear it
        this.currentSession = null;
        return Result.success(null);
      }

      const sessionInfo: SessionInfo = {
        name: this.currentSession,
        createdDate: configResult.value.createdDate,
        lastActiveDate: configResult.value.lastActiveDate,
        vectorProvider: configResult.value.vectorProvider
      };

      return Result.success(sessionInfo);
    } catch (error) {
      return Result.failure(`Failed to get current session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getAllSession(): Promise<Result<SessionInfo[], string>> {
    try {
      if (!existsSync(this.baseSessionDir)) {
        return Result.success([]);
      }

      const entries = await fs.readdir(this.baseSessionDir, { withFileTypes: true });
      const sessionDirs = entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name);

      const sessionInfos: SessionInfo[] = [];
      
      for (const sessionName of sessionDirs) {
        const configResult = await this.getSessionConfig(sessionName);
        if (configResult.isSuccess) {
          sessionInfos.push({
            name: sessionName,
            createdDate: configResult.value.createdDate,
            lastActiveDate: configResult.value.lastActiveDate,
            vectorProvider: configResult.value.vectorProvider
          });
        }
      }

      // Sort by last active date (most recent first)
      sessionInfos.sort((a, b) => new Date(b.lastActiveDate).getTime() - new Date(a.lastActiveDate).getTime());

      return Result.success(sessionInfos);
    } catch (error) {
      return Result.failure(`Failed to get all sessions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async switchSessions(sessionName: string): Promise<Result<void, string>> {
    try {
      // Validate session exists and is valid
      const validation = await this.validateSession(sessionName);
      if (!validation.isSuccess) {
        return validation;
      }

      // Get current vector provider config
      const currentVectorProvider = await this.configStore.getVectorProviderConfig();

      // Validate vector provider matches
      const sessionConfigResult = await this.getSessionConfig(sessionName);
      if (!sessionConfigResult.isSuccess) {
        return Result.failure(sessionConfigResult.error);
      }

      const sessionProvider = sessionConfigResult.value.vectorProvider;
      const currentProvider = currentVectorProvider;

      if (sessionProvider.provider !== currentProvider.provider || sessionProvider.model !== currentProvider.model) {
        return Result.failure(`Cannot switch to session '${sessionName}': session was created with vector provider '${sessionProvider.provider}/${sessionProvider.model}' but current provider is '${currentProvider.provider}/${currentProvider.model}'. Vector provider mismatch detected.`);
      }

      // Update last active date
      const paths = this.getSessionPaths(sessionName);
      const config = sessionConfigResult.value;
      config.lastActiveDate = new Date().toISOString();
      await fs.writeFile(paths.configPath, JSON.stringify(config, null, 2));

      this.currentSession = sessionName;
      return Result.success(undefined);
    } catch (error) {
      return Result.failure(`Failed to switch to session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async validateSession(sessionName: string): Promise<Result<void, string>> {
    try {
      const paths = this.getSessionPaths(sessionName);

      if (!existsSync(paths.sessionDir)) {
        return Result.failure(`Session '${sessionName}' does not exist.`);
      }

      if (!existsSync(paths.configPath)) {
        return Result.failure(`Session '${sessionName}' is missing configuration file.`);
      }

      // Validate config file structure
      const configResult = await this.getSessionConfig(sessionName);
      if (!configResult.isSuccess) {
        return Result.failure(configResult.error);
      }

      return Result.success(undefined);
    } catch (error) {
      return Result.failure(`Failed to validate session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async getSessionConfig(sessionName: string): Promise<Result<SessionConfig, string>> {
    try {
      const paths = this.getSessionPaths(sessionName);
      const configContent = await fs.readFile(paths.configPath, 'utf-8');
      const config: SessionConfig = JSON.parse(configContent);

      if (!config.createdDate || !config.lastActiveDate || !config.vectorProvider || !config.vectorProvider.provider || !config.vectorProvider.model) {
        return Result.failure(`Session '${sessionName}' has invalid configuration.`);
      }

      return Result.success(config);
    } catch (error) {
      return Result.failure(`Failed to get session config: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private generateSessionName(): string {
    const now = new Date();
    const timestamp = now.toISOString();
    
    const hash = createHash('sha256')
      .update(timestamp)
      .digest('hex')
      .substring(0, 12);
    
    return hash;
  }

  private getSessionPaths(sessionName: string): SessionPaths {
    const sessionDir = join(this.baseSessionDir, sessionName);
    
    return {
      sessionDir,
      sqlDbPath: join(sessionDir, 'sql-messages.db'),
      vectorDbPath: join(sessionDir, 'vector-messages.db'),
      configPath: join(sessionDir, 'session-config.json')
    };
  }
}