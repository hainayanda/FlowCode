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
  writeCredentials(credentials: CredentialsConfig): Promise<void>;
  setProviderCredential(provider: string, credential: ProviderCredential): Promise<void>;
  updateLastUsed(provider: string): Promise<void>;
  removeProviderCredential(provider: string): Promise<void>;
  ensureCredentialsDirectory(): Promise<void>;
}

/**
 * Combined store interface for credential management
 */
export interface CredentialStore extends CredentialReader, CredentialWriter {
  // Combines both reader and writer interfaces
}