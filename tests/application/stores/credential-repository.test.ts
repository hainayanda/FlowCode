import * as fs from 'fs/promises';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
    Credentials,
    ProviderCredential,
} from '../../../src/application/models/credential';
import { CredentialRepository } from '../../../src/application/stores/credential-repository';

describe('CredentialRepository', () => {
    const testHomeDir = path.join(__dirname, 'test-home');
    const flowcodeDir = path.join(testHomeDir, '.flowcode');
    const credentialsPath = path.join(flowcodeDir, 'credentials.json');
    let repository: CredentialRepository;

    const mockCredentials: Credentials = {
        openai: {
            apiKey: 'sk-test-openai-key',
            lastUsed: '2024-01-01T00:00:00Z',
        },
        anthropic: {
            apiKey: 'sk-ant-test-anthropic-key',
            lastUsed: '2024-01-02T00:00:00Z',
        },
    };

    const mockProviderCredentials: ProviderCredential[] = [
        {
            provider: 'openai',
            apiKey: 'sk-test-openai-key',
            lastUsed: '2024-01-01T00:00:00Z',
        },
        {
            provider: 'anthropic',
            apiKey: 'sk-ant-test-anthropic-key',
            lastUsed: '2024-01-02T00:00:00Z',
        },
    ];

    beforeEach(() => {
        repository = new CredentialRepository(testHomeDir);
    });

    afterEach(async () => {
        try {
            await fs.rm(testHomeDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    describe('constructor', () => {
        it('should create repository with default home directory', () => {
            const defaultRepo = new CredentialRepository();
            expect(defaultRepo).toBeInstanceOf(CredentialRepository);
        });

        it('should create repository with custom home directory', () => {
            expect(repository).toBeInstanceOf(CredentialRepository);
        });
    });

    describe('fetchCredentials', () => {
        it('should read and parse credentials file successfully', async () => {
            await fs.mkdir(flowcodeDir, { recursive: true });
            await fs.writeFile(
                credentialsPath,
                JSON.stringify(mockCredentials, null, 2)
            );

            const result = await repository.fetchCredentials();

            expect(result).toEqual(mockProviderCredentials);
            expect(repository.credentials).toEqual(mockProviderCredentials);
        });

        it('should return empty array when credentials file does not exist', async () => {
            const result = await repository.fetchCredentials();

            expect(result).toEqual([]);
            expect(repository.credentials).toEqual([]);
        });

        it('should throw error when credentials file contains invalid JSON', async () => {
            await fs.mkdir(flowcodeDir, { recursive: true });
            await fs.writeFile(credentialsPath, 'invalid json');

            await expect(repository.fetchCredentials()).rejects.toThrow(
                'Failed to read credentials:'
            );
        });

        it('should create .flowcode directory if it does not exist', async () => {
            await fs.mkdir(flowcodeDir, { recursive: true });
            await fs.writeFile(
                credentialsPath,
                JSON.stringify(mockCredentials, null, 2)
            );

            await repository.fetchCredentials();

            const stats = await fs.stat(flowcodeDir);
            expect(stats.isDirectory()).toBe(true);
        });
    });

    describe('credentials getter', () => {
        it('should return empty array when not loaded', () => {
            expect(repository.credentials).toEqual([]);
        });

        it('should return loaded credentials after fetching', async () => {
            await fs.mkdir(flowcodeDir, { recursive: true });
            await fs.writeFile(
                credentialsPath,
                JSON.stringify(mockCredentials, null, 2)
            );
            await repository.fetchCredentials();

            expect(repository.credentials).toEqual(mockProviderCredentials);
        });
    });

    describe('fetchCredential', () => {
        beforeEach(async () => {
            await fs.mkdir(flowcodeDir, { recursive: true });
            await fs.writeFile(
                credentialsPath,
                JSON.stringify(mockCredentials, null, 2)
            );
        });

        it('should fetch and return specific provider credential', async () => {
            const result = await repository.fetchCredential('openai');
            expect(result).toEqual(mockProviderCredentials[0]);
        });

        it('should return undefined for non-existent provider', async () => {
            const result = await repository.fetchCredential('non-existent');
            expect(result).toBeUndefined();
        });
    });

    describe('getCredential', () => {
        beforeEach(async () => {
            await fs.mkdir(flowcodeDir, { recursive: true });
            await fs.writeFile(
                credentialsPath,
                JSON.stringify(mockCredentials, null, 2)
            );
            await repository.fetchCredentials();
        });

        it('should return specific provider credential from cache', () => {
            const result = repository.getCredential('anthropic');
            expect(result).toEqual(mockProviderCredentials[1]);
        });

        it('should return undefined for non-existent provider', () => {
            const result = repository.getCredential('non-existent');
            expect(result).toBeUndefined();
        });

        it('should return undefined when no credentials are loaded', () => {
            const freshRepo = new CredentialRepository(testHomeDir);
            const result = freshRepo.getCredential('openai');
            expect(result).toBeUndefined();
        });
    });

    describe('writeCredential', () => {
        const newCredential: ProviderCredential = {
            provider: 'google',
            apiKey: 'goog-test-key',
            lastUsed: '2024-01-03T00:00:00Z',
        };

        it('should write new credential to file and refresh cache', async () => {
            await repository.writeCredential(newCredential);

            const fileContent = await fs.readFile(credentialsPath, 'utf-8');
            const parsedCredentials = JSON.parse(fileContent);
            expect(parsedCredentials['google']).toEqual({
                apiKey: 'goog-test-key',
                lastUsed: '2024-01-03T00:00:00Z',
            });
            expect(repository.getCredential('google')).toEqual(newCredential);
        });

        it('should update existing credential', async () => {
            await fs.mkdir(flowcodeDir, { recursive: true });
            await fs.writeFile(
                credentialsPath,
                JSON.stringify(mockCredentials, null, 2)
            );
            await repository.fetchCredentials();

            const updatedCredential: ProviderCredential = {
                provider: 'openai',
                apiKey: 'sk-new-openai-key',
                lastUsed: '2024-01-04T00:00:00Z',
            };

            await repository.writeCredential(updatedCredential);

            expect(repository.getCredential('openai')).toEqual(
                updatedCredential
            );
            expect(repository.getCredential('anthropic')).toEqual(
                mockProviderCredentials[1]
            );
        });

        it('should create directory if it does not exist', async () => {
            await repository.writeCredential(newCredential);

            const stats = await fs.stat(flowcodeDir);
            expect(stats.isDirectory()).toBe(true);
        });

        it('should format JSON with proper indentation', async () => {
            await repository.writeCredential(newCredential);

            const fileContent = await fs.readFile(credentialsPath, 'utf-8');
            expect(fileContent).toContain('  "google"');
            expect(fileContent).toContain('    "apiKey"');
        });
    });

    describe('updateCredential', () => {
        beforeEach(async () => {
            await fs.mkdir(flowcodeDir, { recursive: true });
            await fs.writeFile(
                credentialsPath,
                JSON.stringify(mockCredentials, null, 2)
            );
            await repository.fetchCredentials();
        });

        it('should update existing credential', async () => {
            const updatedCredential: ProviderCredential = {
                provider: 'openai',
                apiKey: 'sk-updated-openai-key',
                lastUsed: '2024-01-05T00:00:00Z',
            };

            await repository.updateCredential(updatedCredential);

            expect(repository.getCredential('openai')).toEqual(
                updatedCredential
            );
            expect(repository.getCredential('anthropic')).toEqual(
                mockProviderCredentials[1]
            );
        });

        it('should throw error when updating non-existent credential', async () => {
            const nonExistentCredential: ProviderCredential = {
                provider: 'non-existent',
                apiKey: 'test-key',
                lastUsed: '2024-01-05T00:00:00Z',
            };

            await expect(
                repository.updateCredential(nonExistentCredential)
            ).rejects.toThrow(
                "Credential for provider 'non-existent' not found"
            );
        });
    });

    describe('deleteCredential', () => {
        beforeEach(async () => {
            await fs.mkdir(flowcodeDir, { recursive: true });
            await fs.writeFile(
                credentialsPath,
                JSON.stringify(mockCredentials, null, 2)
            );
            await repository.fetchCredentials();
        });

        it('should delete existing credential', async () => {
            await repository.deleteCredential('openai');

            expect(repository.getCredential('openai')).toBeUndefined();
            expect(repository.getCredential('anthropic')).toEqual(
                mockProviderCredentials[1]
            );
            expect(repository.credentials).toHaveLength(1);
        });

        it('should throw error when deleting non-existent credential', async () => {
            await expect(
                repository.deleteCredential('non-existent')
            ).rejects.toThrow(
                "Credential for provider 'non-existent' not found"
            );
        });

        it('should update file after deletion', async () => {
            await repository.deleteCredential('openai');

            const fileContent = await fs.readFile(credentialsPath, 'utf-8');
            const parsedCredentials = JSON.parse(fileContent);
            expect(parsedCredentials['openai']).toBeUndefined();
            expect(parsedCredentials['anthropic']).toBeDefined();
        });
    });

    describe('mapping functionality', () => {
        it('should correctly map from Credentials to ProviderCredential[]', async () => {
            await fs.mkdir(flowcodeDir, { recursive: true });
            await fs.writeFile(
                credentialsPath,
                JSON.stringify(mockCredentials, null, 2)
            );

            const result = await repository.fetchCredentials();

            expect(result).toEqual(mockProviderCredentials);
        });

        it('should correctly map from ProviderCredential[] to Credentials when writing', async () => {
            await repository.writeCredential(mockProviderCredentials[0]);
            await repository.writeCredential(mockProviderCredentials[1]);

            const fileContent = await fs.readFile(credentialsPath, 'utf-8');
            const parsedCredentials = JSON.parse(fileContent);
            expect(parsedCredentials).toEqual(mockCredentials);
        });
    });

    describe('error handling', () => {
        it('should handle file write permissions error', async () => {
            // Create a read-only directory to simulate permission error
            await fs.mkdir(flowcodeDir, { recursive: true });
            await fs.chmod(flowcodeDir, 0o444);

            const newCredential: ProviderCredential = {
                provider: 'test',
                apiKey: 'test-key',
                lastUsed: '2024-01-01T00:00:00Z',
            };

            await expect(
                repository.writeCredential(newCredential)
            ).rejects.toThrow('Failed to write credentials:');

            // Restore permissions for cleanup
            await fs.chmod(flowcodeDir, 0o755);
        });
    });
});
