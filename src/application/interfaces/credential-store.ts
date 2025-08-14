/**
 * Credential interfaces for FlowCode credentials.json management
 */

export interface ProviderCredential {
  apiKey: string;
  lastUsed: string;
}

export interface CredentialsConfig {
  openai?: ProviderCredential;
  anthropic?: ProviderCredential;
  moonshot?: ProviderCredential;
}

/**
 * Reader interface for credential operations
 */
export interface CredentialReader {
  getCredentials(): Promise<CredentialsConfig>;
  getProviderCredential(provider: string): Promise<ProviderCredential | null>;
  getAllProviders(): Promise<string[]>;
  hasCredential(provider: string): Promise<boolean>;
  credentialsExist(): Promise<boolean>;
  getCredentialsPath(): string;
}

/**
 * Writer interface for credential operations
 */
export interface CredentialWriter {
  writeCredentials(credentials: CredentialsConfig): Promise<boolean>;
  initializeCredentials(): Promise<boolean>;
  setProviderCredential(provider: string, credential: ProviderCredential): Promise<boolean>;
  updateLastUsed(provider: string): Promise<boolean>;
  removeProviderCredential(provider: string): Promise<boolean>;
  ensureCredentialsDirectory(): Promise<boolean>;
}

/**
 * Combined store interface for credential management
 */
export interface CredentialStore extends CredentialReader, CredentialWriter {
  // Combines both reader and writer interfaces
}