import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { CredentialStore } from '../interfaces/credential-store';
import { Credentials, ProviderCredential } from '../models/credential';
import { createFlowcodeDirectoryIfNeeded } from '../../utils/flowcode-directory';

/**
 * File-based credential repository.
 *
 * Manages credential persistence through credentials.json in the ~/.flowcode directory.
 * Provides caching for efficient access and maps between Credentials and ProviderCredential
 * formats for easier usage.
 */
export class CredentialRepository implements CredentialStore {
    private _credentials: ProviderCredential[] = [];
    private readonly credentialsPath: string;
    private readonly flowcodeRoot: string;

    /**
     * Creates a new CredentialRepository instance.
     *
     * @param homeDirectory - The home directory path (defaults to os.homedir())
     */
    constructor(homeDirectory: string = os.homedir()) {
        this.flowcodeRoot = path.join(homeDirectory, '.flowcode');
        this.credentialsPath = path.join(this.flowcodeRoot, 'credentials.json');
    }

    /** Array of all provider credentials */
    get credentials(): ProviderCredential[] {
        return this._credentials;
    }

    /**
     * Fetches the latest credentials from storage.
     *
     * @returns Promise resolving to array of provider credentials
     * @throws Error if credentials file cannot be read or is invalid
     */
    async fetchCredentials(): Promise<ProviderCredential[]> {
        try {
            await createFlowcodeDirectoryIfNeeded(this.flowcodeRoot);
            const credentialsData = await fs.readFile(
                this.credentialsPath,
                'utf-8'
            );
            const credentials: Credentials = JSON.parse(credentialsData);
            this._credentials = this.mapToProviderCredentials(credentials);
            return this._credentials;
        } catch (error) {
            if (
                error instanceof Error &&
                'code' in error &&
                error.code === 'ENOENT'
            ) {
                // File doesn't exist, return empty array
                this._credentials = [];
                return this._credentials;
            }
            throw new Error(
                `Failed to read credentials: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * Fetches the latest credential for a specific provider from storage.
     *
     * @param provider - Name of the provider to fetch
     * @returns Promise resolving to the provider credential
     */
    async fetchCredential(
        provider: string
    ): Promise<ProviderCredential | undefined> {
        await this.fetchCredentials();
        return this.getCredential(provider);
    }

    /**
     * Gets a credential for a specific provider from the current cached credentials.
     *
     * @param provider - Name of the provider to get
     * @returns Provider credential or undefined if not found
     */
    getCredential(provider: string): ProviderCredential | undefined {
        return this._credentials.find((cred) => cred.provider === provider);
    }

    /**
     * Writes a credential to storage.
     *
     * @param credential - Provider credential to persist
     */
    async writeCredential(credential: ProviderCredential): Promise<void> {
        // Add or update the credential in our array
        const existingIndex = this._credentials.findIndex(
            (cred) => cred.provider === credential.provider
        );
        if (existingIndex >= 0) {
            this._credentials[existingIndex] = credential;
        } else {
            this._credentials.push(credential);
        }

        await this.writeToFile();
        await this.fetchCredentials(); // Refresh cache
    }

    /**
     * Updates an existing credential in storage.
     *
     * @param credential - Provider credential to update
     * @throws Error if credential doesn't exist
     */
    async updateCredential(credential: ProviderCredential): Promise<void> {
        const existingIndex = this._credentials.findIndex(
            (cred) => cred.provider === credential.provider
        );
        if (existingIndex < 0) {
            throw new Error(
                `Credential for provider '${credential.provider}' not found`
            );
        }

        this._credentials[existingIndex] = credential;
        await this.writeToFile();
        await this.fetchCredentials(); // Refresh cache
    }

    /**
     * Deletes a credential from storage.
     *
     * @param provider - Name of the provider to delete
     * @throws Error if credential doesn't exist
     */
    async deleteCredential(provider: string): Promise<void> {
        const existingIndex = this._credentials.findIndex(
            (cred) => cred.provider === provider
        );
        if (existingIndex < 0) {
            throw new Error(`Credential for provider '${provider}' not found`);
        }

        this._credentials.splice(existingIndex, 1);
        await this.writeToFile();
        await this.fetchCredentials(); // Refresh cache
    }

    /**
     * Maps Credentials object to ProviderCredential array.
     *
     * @param credentials - Credentials object from file
     * @returns Array of provider credentials
     */
    private mapToProviderCredentials(
        credentials: Credentials
    ): ProviderCredential[] {
        return Object.entries(credentials).map(([provider, credential]) => ({
            provider,
            ...credential,
        }));
    }

    /**
     * Maps ProviderCredential array to Credentials object.
     *
     * @returns Credentials object for file storage
     */
    private mapToCredentials(): Credentials {
        const credentials: Credentials = {};
        for (const providerCredential of this._credentials) {
            const { provider, ...credential } = providerCredential;
            credentials[provider] = credential;
        }
        return credentials;
    }

    /**
     * Writes credentials data to the credentials file.
     */
    private async writeToFile(): Promise<void> {
        try {
            await createFlowcodeDirectoryIfNeeded(this.flowcodeRoot);
            const credentials = this.mapToCredentials();
            const credentialsData = JSON.stringify(credentials, null, 2);
            await fs.writeFile(this.credentialsPath, credentialsData, 'utf-8');
        } catch (error) {
            throw new Error(
                `Failed to write credentials: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }
}
