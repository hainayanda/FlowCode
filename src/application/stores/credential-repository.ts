import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { CredentialStore, CredentialsConfig, ProviderCredential } from '../interfaces/credential-store.js';

/**
 * Credential repository implementation for global FlowCode credentials.json management
 */
export class CredentialRepository implements CredentialStore {
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
    } catch (error) {
      throw new Error(`Failed to read credentials file: ${error instanceof Error ? error.message : String(error)}`);
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

  async writeCredentials(credentials: CredentialsConfig): Promise<void> {
    try {
      await this.ensureCredentialsDirectory();
      await fs.writeFile(this.credentialsFile, JSON.stringify(credentials, null, 2));
    } catch (error) {
      throw new Error(`Failed to write credentials file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async setProviderCredential(provider: string, credential: ProviderCredential): Promise<void> {
    try {
      const credentials = await this.getCredentials();
      credentials[provider as keyof CredentialsConfig] = credential;
      await this.writeCredentials(credentials);
    } catch (error) {
      throw new Error(`Failed to set credential for provider '${provider}': ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async updateLastUsed(provider: string): Promise<void> {
    try {
      const credentials = await this.getCredentials();
      const existingCredential = credentials[provider as keyof CredentialsConfig];
      
      if (!existingCredential) {
        throw new Error(`Provider '${provider}' not found in credentials`);
      }

      existingCredential.lastUsed = new Date().toISOString();
      await this.writeCredentials(credentials);
    } catch (error) {
      throw new Error(`Failed to update last used for provider '${provider}': ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async removeProviderCredential(provider: string): Promise<void> {
    try {
      const credentials = await this.getCredentials();
      delete credentials[provider as keyof CredentialsConfig];
      await this.writeCredentials(credentials);
    } catch (error) {
      throw new Error(`Failed to remove credential for provider '${provider}': ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async ensureCredentialsDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.credentialsDir, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to create credentials directory: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

}