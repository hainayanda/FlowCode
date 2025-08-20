import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { SettingsRepository } from '../../../src/application/stores/settings-repository';
import { Settings } from '../../../src/application/models/settings';

describe('SettingsRepository', () => {
    const testWorkspaceRoot = path.join(__dirname, 'test-workspace-settings');
    const flowcodeDir = path.join(testWorkspaceRoot, '.flowcode');
    const settingsPath = path.join(flowcodeDir, 'settings.json');
    let repository: SettingsRepository;

    const mockSettings: Settings = {
        permissions: {
            allow: ['bash', 'read', 'write'],
            deny: ['delete', 'format'],
        },
    };

    const defaultSettings: Settings = {
        permissions: {
            allow: [],
            deny: [],
        },
    };

    beforeEach(() => {
        repository = new SettingsRepository(testWorkspaceRoot);
    });

    afterEach(async () => {
        try {
            await fs.rm(testWorkspaceRoot, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    describe('constructor', () => {
        it('should create repository with default workspace root', () => {
            const defaultRepo = new SettingsRepository();
            expect(defaultRepo).toBeInstanceOf(SettingsRepository);
        });

        it('should create repository with custom workspace root', () => {
            expect(repository).toBeInstanceOf(SettingsRepository);
        });
    });

    describe('fetchSettings', () => {
        it('should read and parse settings file successfully', async () => {
            await fs.mkdir(flowcodeDir, { recursive: true });
            await fs.writeFile(
                settingsPath,
                JSON.stringify(mockSettings, null, 2)
            );

            const result = await repository.fetchSettings();

            expect(result).toEqual(mockSettings);
            expect(repository.allowedTools).toEqual(
                mockSettings.permissions.allow
            );
            expect(repository.deniedTools).toEqual(
                mockSettings.permissions.deny
            );
        });

        it('should return default settings when settings file does not exist', async () => {
            const result = await repository.fetchSettings();

            expect(result).toEqual(defaultSettings);
            expect(repository.allowedTools).toEqual([]);
            expect(repository.deniedTools).toEqual([]);
        });

        it('should throw error when settings file contains invalid JSON', async () => {
            await fs.mkdir(flowcodeDir, { recursive: true });
            await fs.writeFile(settingsPath, 'invalid json');

            await expect(repository.fetchSettings()).rejects.toThrow(
                'Failed to read settings:'
            );
        });

        it('should create .flowcode directory if it does not exist', async () => {
            await fs.mkdir(flowcodeDir, { recursive: true });
            await fs.writeFile(
                settingsPath,
                JSON.stringify(mockSettings, null, 2)
            );

            await repository.fetchSettings();

            const stats = await fs.stat(flowcodeDir);
            expect(stats.isDirectory()).toBe(true);
        });
    });

    describe('settings getters', () => {
        it('should return default settings when not loaded', () => {
            expect(repository.allowedTools).toEqual([]);
            expect(repository.deniedTools).toEqual([]);
        });

        it('should return loaded settings after fetching', async () => {
            await fs.mkdir(flowcodeDir, { recursive: true });
            await fs.writeFile(
                settingsPath,
                JSON.stringify(mockSettings, null, 2)
            );
            await repository.fetchSettings();

            expect(repository.allowedTools).toEqual(
                mockSettings.permissions.allow
            );
            expect(repository.deniedTools).toEqual(
                mockSettings.permissions.deny
            );
        });
    });

    describe('fetchAllowedTools', () => {
        beforeEach(async () => {
            await fs.mkdir(flowcodeDir, { recursive: true });
            await fs.writeFile(
                settingsPath,
                JSON.stringify(mockSettings, null, 2)
            );
        });

        it('should fetch and return allowed tools from file', async () => {
            const result = await repository.fetchAllowedTools();
            expect(result).toEqual(mockSettings.permissions.allow);
        });
    });

    describe('fetchDeniedTools', () => {
        beforeEach(async () => {
            await fs.mkdir(flowcodeDir, { recursive: true });
            await fs.writeFile(
                settingsPath,
                JSON.stringify(mockSettings, null, 2)
            );
        });

        it('should fetch and return denied tools from file', async () => {
            const result = await repository.fetchDeniedTools();
            expect(result).toEqual(mockSettings.permissions.deny);
        });
    });

    describe('isToolAllowed', () => {
        beforeEach(async () => {
            await fs.mkdir(flowcodeDir, { recursive: true });
            await fs.writeFile(
                settingsPath,
                JSON.stringify(mockSettings, null, 2)
            );
        });

        it('should return true for allowed tools', async () => {
            const result = await repository.isToolAllowed('bash');
            expect(result).toBe(true);
        });

        it('should return false for non-allowed tools', async () => {
            const result = await repository.isToolAllowed('unknown');
            expect(result).toBe(false);
        });
    });

    describe('isToolDenied', () => {
        beforeEach(async () => {
            await fs.mkdir(flowcodeDir, { recursive: true });
            await fs.writeFile(
                settingsPath,
                JSON.stringify(mockSettings, null, 2)
            );
        });

        it('should return true for denied tools', async () => {
            const result = await repository.isToolDenied('delete');
            expect(result).toBe(true);
        });

        it('should return false for non-denied tools', async () => {
            const result = await repository.isToolDenied('unknown');
            expect(result).toBe(false);
        });
    });

    describe('writeSettings', () => {
        const newSettings: Settings = {
            permissions: {
                allow: ['git', 'npm'],
                deny: ['rm', 'mv'],
            },
        };

        it('should write settings to file and refresh cache', async () => {
            await repository.writeSettings(newSettings);

            const fileContent = await fs.readFile(settingsPath, 'utf-8');
            const parsedSettings = JSON.parse(fileContent);
            expect(parsedSettings).toEqual(newSettings);
            expect(repository.allowedTools).toEqual(
                newSettings.permissions.allow
            );
            expect(repository.deniedTools).toEqual(
                newSettings.permissions.deny
            );
        });

        it('should create directory if it does not exist', async () => {
            await repository.writeSettings(newSettings);

            const stats = await fs.stat(flowcodeDir);
            expect(stats.isDirectory()).toBe(true);
        });

        it('should format JSON with proper indentation', async () => {
            await repository.writeSettings(newSettings);

            const fileContent = await fs.readFile(settingsPath, 'utf-8');
            expect(fileContent).toContain('  "permissions"');
            expect(fileContent).toContain('    "allow"');
        });
    });

    describe('addAllowedTool', () => {
        beforeEach(async () => {
            await repository.writeSettings(mockSettings);
        });

        it('should add new tool to allowed list', async () => {
            await repository.addAllowedTool('git');

            expect(repository.allowedTools).toContain('git');
            expect(repository.allowedTools).toContain('bash'); // existing tool
            expect(repository.deniedTools).toEqual(
                mockSettings.permissions.deny
            );
        });

        it('should not add duplicate tool to allowed list', async () => {
            await repository.addAllowedTool('bash'); // already exists

            expect(
                repository.allowedTools.filter((tool) => tool === 'bash')
            ).toHaveLength(1);
        });

        it('should work when starting from default settings', async () => {
            const freshRepository = new SettingsRepository(testWorkspaceRoot);
            await freshRepository.addAllowedTool('test-tool');

            expect(freshRepository.allowedTools).toEqual(['test-tool']);
            expect(freshRepository.deniedTools).toEqual([]);
        });
    });

    describe('addDeniedTool', () => {
        beforeEach(async () => {
            await repository.writeSettings(mockSettings);
        });

        it('should add new tool to denied list', async () => {
            await repository.addDeniedTool('rm');

            expect(repository.deniedTools).toContain('rm');
            expect(repository.deniedTools).toContain('delete'); // existing tool
            expect(repository.allowedTools).toEqual(
                mockSettings.permissions.allow
            );
        });

        it('should not add duplicate tool to denied list', async () => {
            await repository.addDeniedTool('delete'); // already exists

            expect(
                repository.deniedTools.filter((tool) => tool === 'delete')
            ).toHaveLength(1);
        });

        it('should work when starting from default settings', async () => {
            const freshRepository = new SettingsRepository(testWorkspaceRoot);
            await freshRepository.addDeniedTool('dangerous-tool');

            expect(freshRepository.deniedTools).toEqual(['dangerous-tool']);
            expect(freshRepository.allowedTools).toEqual([]);
        });
    });

    describe('removeAllowedTool', () => {
        beforeEach(async () => {
            await repository.writeSettings(mockSettings);
        });

        it('should remove tool from allowed list', async () => {
            await repository.removeAllowedTool('bash');

            expect(repository.allowedTools).not.toContain('bash');
            expect(repository.allowedTools).toContain('read'); // other tools remain
            expect(repository.deniedTools).toEqual(
                mockSettings.permissions.deny
            );
        });

        it('should handle removing non-existent tool gracefully', async () => {
            await repository.removeAllowedTool('non-existent');

            expect(repository.allowedTools).toEqual(
                mockSettings.permissions.allow
            );
        });
    });

    describe('removeDeniedTool', () => {
        beforeEach(async () => {
            await repository.writeSettings(mockSettings);
        });

        it('should remove tool from denied list', async () => {
            await repository.removeDeniedTool('delete');

            expect(repository.deniedTools).not.toContain('delete');
            expect(repository.deniedTools).toContain('format'); // other tools remain
            expect(repository.allowedTools).toEqual(
                mockSettings.permissions.allow
            );
        });

        it('should handle removing non-existent tool gracefully', async () => {
            await repository.removeDeniedTool('non-existent');

            expect(repository.deniedTools).toEqual(
                mockSettings.permissions.deny
            );
        });
    });

    describe('tool permission integration', () => {
        beforeEach(async () => {
            await repository.writeSettings(mockSettings);
        });

        it('should correctly manage tool permissions across operations', async () => {
            // Add new allowed tool
            await repository.addAllowedTool('git');
            expect(await repository.isToolAllowed('git')).toBe(true);

            // Add new denied tool
            await repository.addDeniedTool('rm');
            expect(await repository.isToolDenied('rm')).toBe(true);

            // Remove existing allowed tool
            await repository.removeAllowedTool('bash');
            expect(await repository.isToolAllowed('bash')).toBe(false);

            // Remove existing denied tool
            await repository.removeDeniedTool('delete');
            expect(await repository.isToolDenied('delete')).toBe(false);

            // Verify final state
            expect(repository.allowedTools).toEqual(['read', 'write', 'git']);
            expect(repository.deniedTools).toEqual(['format', 'rm']);
        });
    });

    describe('error handling', () => {
        it('should handle file write permissions error', async () => {
            // Create a read-only directory to simulate permission error
            await fs.mkdir(flowcodeDir, { recursive: true });
            await fs.chmod(flowcodeDir, 0o444);

            const newSettings: Settings = {
                permissions: {
                    allow: ['test'],
                    deny: [],
                },
            };

            await expect(repository.writeSettings(newSettings)).rejects.toThrow(
                'Failed to write settings:'
            );

            // Restore permissions for cleanup
            await fs.chmod(flowcodeDir, 0o755);
        });
    });
});
