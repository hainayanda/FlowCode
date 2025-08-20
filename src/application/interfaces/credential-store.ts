import { ProviderCredential } from '../models/credential';

/**
 * Interface for reading credential data.
 *
 * Provides access to provider credentials and methods to fetch
 * the latest credentials from persistent storage.
 */
export interface CredentialReader {
    /** Array of all provider credentials */
    credentials: ProviderCredential[];

    /**
     * Fetches the latest credentials from storage.
     *
     * @returns Promise resolving to array of provider credentials
     */
    fetchCredentials(): Promise<ProviderCredential[]>;

    /**
     * Fetches the latest credential for a specific provider from storage.
     *
     * @param provider - Name of the provider to fetch
     * @returns Promise resolving to the provider credential
     */
    fetchCredential(provider: string): Promise<ProviderCredential | undefined>;

    /**
     * Gets a credential for a specific provider from the current cached credentials.
     *
     * @param provider - Name of the provider to get
     * @returns Provider credential or undefined if not found
     */
    getCredential(provider: string): ProviderCredential | undefined;
}

/**
 * Interface for writing credential data.
 *
 * Provides methods to persist provider credentials to storage,
 * allowing for runtime credential management.
 */
export interface CredentialWriter {
    /**
     * Writes a credential to storage.
     *
     * @param credential - Provider credential to persist
     */
    writeCredential(credential: ProviderCredential): Promise<void>;

    /**
     * Updates an existing credential in storage.
     *
     * @param credential - Provider credential to update
     */
    updateCredential(credential: ProviderCredential): Promise<void>;

    /**
     * Deletes a credential from storage.
     *
     * @param provider - Name of the provider to delete
     */
    deleteCredential(provider: string): Promise<void>;
}

/**
 * Combined interface for reading and writing credential data.
 */
export interface CredentialStore extends CredentialReader, CredentialWriter {}
