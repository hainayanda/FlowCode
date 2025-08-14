import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { CredentialStore, CredentialsConfig, ProviderCredential } from '../interfaces/credential-store.js';

/**
 * Credential service implementation for global FlowCode credentials.json management
 */
export class CredentialService implements CredentialStore {
  private readonly credentialsDir: string;
  private readonly credentialsFile: string;

  constructor() {
    // Credentials are always stored globally in user home directory
    this.credentialsDir = path.join(os.homedir(), '.flowcode');
    this.credentialsFile = path.join(this.credentialsDir, 'credentials.json');
  }

  // CredentialReader implementation

  async getCredentials(): Promise<CredentialsConfig> {
    try {
      const content = await fs.readFile(this.credentialsFile, 'utf-8');
      return JSON.parse(content);
    } catch {
      return this.getDefaultCredentials();
    }
  }

  async getProviderCredential(provider: string): Promise<ProviderCredential | null> {
    const credentials = await this.getCredentials();
    return credentials[provider as keyof CredentialsConfig] || null;
  }

  async getAllProviders(): Promise<string[]> {
    const credentials = await this.getCredentials();
    return Object.keys(credentials);
  }

  async hasCredential(provider: string): Promise<boolean> {
    const credentials = await this.getCredentials();
    return credentials[provider as keyof CredentialsConfig] !== undefined;
  }

  async credentialsExist(): Promise<boolean> {
    try {
      await fs.access(this.credentialsFile);
      return true;
    } catch {
      return false;
    }
  }

  getCredentialsPath(): string {
    return this.credentialsFile;
  }

  // CredentialWriter implementation

  async writeCredentials(credentials: CredentialsConfig): Promise<boolean> {
    try {
      await this.ensureCredentialsDirectory();
      await fs.writeFile(this.credentialsFile, JSON.stringify(credentials, null, 2));
      return true;
    } catch {
      return false;
    }
  }

  async initializeCredentials(): Promise<boolean> {
    try {
      await this.ensureCredentialsDirectory();
      const defaultCredentials = this.getDefaultCredentials();
      await fs.writeFile(this.credentialsFile, JSON.stringify(defaultCredentials, null, 2));
      return true;
    } catch {
      return false;
    }
  }

  async setProviderCredential(provider: string, credential: ProviderCredential): Promise<boolean> {
    try {
      const credentials = await this.getCredentials();
      credentials[provider as keyof CredentialsConfig] = credential;
      return await this.writeCredentials(credentials);
    } catch {
      return false;
    }
  }

  async updateLastUsed(provider: string): Promise<boolean> {
    try {
      const credentials = await this.getCredentials();
      const existingCredential = credentials[provider as keyof CredentialsConfig];
      
      if (!existingCredential) {
        return false;
      }

      existingCredential.lastUsed = new Date().toISOString();
      return await this.writeCredentials(credentials);
    } catch {
      return false;
    }
  }

  async removeProviderCredential(provider: string): Promise<boolean> {
    try {
      const credentials = await this.getCredentials();
      delete credentials[provider as keyof CredentialsConfig];
      return await this.writeCredentials(credentials);
    } catch {
      return false;
    }
  }

  async ensureCredentialsDirectory(): Promise<boolean> {
    try {
      await fs.mkdir(this.credentialsDir, { recursive: true });
      return true;
    } catch {
      return false;
    }
  }

  // Private helper methods

  private getDefaultCredentials(): CredentialsConfig {
    return {};
  }
}