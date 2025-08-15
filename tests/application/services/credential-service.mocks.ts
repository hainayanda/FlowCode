import { CredentialStore, CredentialsConfig, ProviderCredential } from '../../../src/application/interfaces/credential-store.js';

export class MockCredentialStore implements CredentialStore {
  public writeCredentialsCalled = false;
  public lastWrittenCredentials: CredentialsConfig | null = null;
  public getProviderCredentialCallCount = 0;
  public mockCredentials: CredentialsConfig = {};

  // CredentialReader implementation
  async getCredentials(): Promise<CredentialsConfig> {
    return { ...this.mockCredentials };
  }

  async getProviderCredential(provider: string): Promise<ProviderCredential | null> {
    this.getProviderCredentialCallCount++;
    return this.mockCredentials[provider as keyof CredentialsConfig] || null;
  }

  async getAllProviders(): Promise<string[]> {
    return Object.keys(this.mockCredentials);
  }

  async hasCredential(provider: string): Promise<boolean> {
    return provider in this.mockCredentials;
  }

  async credentialsExist(): Promise<boolean> {
    return true;
  }

  getCredentialsPath(): string {
    return '/test/.flowcode/credentials.json';
  }

  // CredentialWriter implementation
  async writeCredentials(credentials: CredentialsConfig): Promise<void> {
    this.writeCredentialsCalled = true;
    this.lastWrittenCredentials = { ...credentials };
  }

  async setProviderCredential(provider: string, credential: ProviderCredential): Promise<void> {
    this.mockCredentials[provider as keyof CredentialsConfig] = { ...credential };
  }

  async updateLastUsed(provider: string): Promise<void> {
    const existing = this.mockCredentials[provider as keyof CredentialsConfig];
    if (existing) {
      existing.lastUsed = new Date().toISOString();
    }
  }

  async removeProviderCredential(provider: string): Promise<void> {
    delete this.mockCredentials[provider as keyof CredentialsConfig];
  }

  async ensureCredentialsDirectory(): Promise<void> {
    // Mock implementation
  }

  // Test helpers
  setHasCredential(hasCredential: boolean): void {
    if (hasCredential) {
      this.mockCredentials['test'] = {
        apiKey: 'test-api-key',
        lastUsed: new Date().toISOString()
      };
    } else {
      this.mockCredentials = {};
    }
  }

  setCredential(credential: ProviderCredential): void {
    this.mockCredentials['test'] = credential;
  }

  reset(): void {
    this.writeCredentialsCalled = false;
    this.lastWrittenCredentials = null;
    this.getProviderCredentialCallCount = 0;
    this.mockCredentials = {};
  }
}