import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createFlowcodeDirectoryIfNeeded } from '../../src/utils/flowcode-directory';

describe('createFlowcodeDirectoryIfNeeded', () => {
    const testWorkspaceRoot = path.join(__dirname, 'test-workspace');
    const flowcodeDir = path.join(testWorkspaceRoot, '.flowcode');

    afterEach(async () => {
        try {
            await fs.rm(testWorkspaceRoot, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    it('should create .flowcode directory when it does not exist', async () => {
        await createFlowcodeDirectoryIfNeeded(testWorkspaceRoot);

        const stats = await fs.stat(flowcodeDir);
        expect(stats.isDirectory()).toBe(true);
    });

    it('should not throw error when .flowcode directory already exists', async () => {
        await fs.mkdir(flowcodeDir, { recursive: true });

        await expect(
            createFlowcodeDirectoryIfNeeded(testWorkspaceRoot)
        ).resolves.not.toThrow();

        const stats = await fs.stat(flowcodeDir);
        expect(stats.isDirectory()).toBe(true);
    });

    it('should create parent directories if they do not exist', async () => {
        const nestedWorkspaceRoot = path.join(
            testWorkspaceRoot,
            'nested',
            'workspace'
        );

        await createFlowcodeDirectoryIfNeeded(nestedWorkspaceRoot);

        const nestedFlowcodeDir = path.join(nestedWorkspaceRoot, '.flowcode');
        const stats = await fs.stat(nestedFlowcodeDir);
        expect(stats.isDirectory()).toBe(true);
    });

    it('should handle permission errors gracefully', async () => {
        // Create parent directory but make it read-only
        await fs.mkdir(testWorkspaceRoot, { recursive: true });
        await fs.chmod(testWorkspaceRoot, 0o444);

        await expect(
            createFlowcodeDirectoryIfNeeded(testWorkspaceRoot)
        ).rejects.toThrow();

        // Restore permissions for cleanup
        await fs.chmod(testWorkspaceRoot, 0o755);
    });
});
