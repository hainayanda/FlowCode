import { beforeEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'fs';
import { WorkspaceTools } from '../../../../src/application/tools/workspace/workspace-tools';
import { AsyncControl } from '../../../../src/application/models/async-control';

// Mock the fs module
vi.mock('fs', async () => {
    const actual = await vi.importActual('fs');
    return {
        ...actual,
        promises: {
            readdir: vi.fn(),
            writeFile: vi.fn(),
            mkdir: vi.fn(),
            stat: vi.fn(),
        },
    };
});

// Mock path resolution
vi.mock('path', async () => {
    const actual = await vi.importActual('path');
    return {
        ...actual,
        resolve: vi
            .fn()
            .mockImplementation((path: string) => `/resolved${path}`),
        join: vi
            .fn()
            .mockImplementation(
                (base: string, name: string) => `${base}/${name}`
            ),
    };
});

// Mock process.cwd
const mockCwd = vi.fn().mockReturnValue('/mock/workspace');
Object.defineProperty(process, 'cwd', { value: mockCwd });

describe('WorkspaceTools', () => {
    let workspaceTools: WorkspaceTools;
    const mockFs = fs as any;

    beforeEach(() => {
        workspaceTools = new WorkspaceTools();
        vi.clearAllMocks();
    });

    describe('listDirectory', () => {
        it('should successfully list directory contents', async () => {
            const mockEntries = [
                { name: 'file1.txt', isDirectory: () => false },
                { name: 'folder1', isDirectory: () => true },
                { name: '.hidden', isDirectory: () => false },
            ];

            mockFs.readdir.mockResolvedValue(mockEntries);

            const generator = workspaceTools.listDirectory({
                path: '/test/path',
                includeHidden: false,
            });
            const control: AsyncControl = { type: 'continue' };

            const messages = [];
            let result = await generator.next(control);

            while (!result.done) {
                messages.push(result.value);
                result = await generator.next(control);
            }

            expect(mockFs.readdir).toHaveBeenCalledWith('/resolved/test/path', {
                withFileTypes: true,
            });
            expect(messages).toHaveLength(1);
            expect(messages[0].type).toBe('tool');
            expect(messages[0].content).toContain(
                'Successfully listed 2 items'
            );
            expect(messages[0].metadata?.result).toBeDefined();

            const parsedResult = JSON.parse(messages[0].metadata.result);
            expect(parsedResult).toHaveLength(2); // Should exclude .hidden file
            expect(
                parsedResult.find((r: any) => r.name === '.hidden')
            ).toBeUndefined();

            expect(result.value.completedReason).toBe('completed');
            expect(result.value.usage.toolsUsed).toBe(1);
        });

        it('should include hidden files when includeHidden is true', async () => {
            const mockEntries = [
                { name: 'file1.txt', isDirectory: () => false },
                { name: '.hidden', isDirectory: () => false },
            ];

            mockFs.readdir.mockResolvedValue(mockEntries);

            const generator = workspaceTools.listDirectory({
                path: '/test/path',
                includeHidden: true,
            });
            const control: AsyncControl = { type: 'continue' };

            const messages = [];
            let result = await generator.next(control);

            while (!result.done) {
                messages.push(result.value);
                result = await generator.next(control);
            }

            const parsedResult = JSON.parse(messages[0].metadata.result);
            expect(parsedResult).toHaveLength(2); // Should include .hidden file
            expect(
                parsedResult.find((r: any) => r.name === '.hidden')
            ).toBeDefined();
        });

        it('should handle directory read errors', async () => {
            mockFs.readdir.mockRejectedValue(new Error('Permission denied'));

            const generator = workspaceTools.listDirectory({
                path: '/test/path',
            });
            const control: AsyncControl = { type: 'continue' };

            const messages = [];
            let result = await generator.next(control);

            while (!result.done) {
                messages.push(result.value);
                result = await generator.next(control);
            }

            expect(messages).toHaveLength(1);
            expect(messages[0].type).toBe('error');
            expect(messages[0].content).toContain(
                'Cannot access directory: Permission denied'
            );
            expect(result.value.completedReason).toBe('completed');
        });
    });

    describe('workspacePath', () => {
        it('should return current working directory', async () => {
            const generator = workspaceTools.workspacePath({});
            const control: AsyncControl = { type: 'continue' };

            const messages = [];
            let result = await generator.next(control);

            while (!result.done) {
                messages.push(result.value);
                result = await generator.next(control);
            }

            expect(messages).toHaveLength(1);
            expect(messages[0].type).toBe('tool');
            expect(messages[0].content).toContain(
                'Current working directory is /mock/workspace'
            );
            expect(messages[0].metadata?.result).toBe('/mock/workspace');
            expect(result.value.completedReason).toBe('completed');
            expect(result.value.usage.toolsUsed).toBe(1);
        });
    });

    describe('createFile', () => {
        it('should successfully create file with content', async () => {
            mockFs.writeFile.mockResolvedValue(undefined);

            const generator = workspaceTools.createFile({
                filePath: '/test/file.txt',
                content: 'test content',
            });
            const control: AsyncControl = { type: 'continue' };

            const messages = [];
            let result = await generator.next(control);

            while (!result.done) {
                messages.push(result.value);
                result = await generator.next(control);
            }

            expect(mockFs.writeFile).toHaveBeenCalledWith(
                '/resolved/test/file.txt',
                'test content',
                'utf8'
            );
            expect(messages).toHaveLength(1);
            expect(messages[0].type).toBe('tool');
            expect(messages[0].content).toContain(
                'Created file at /test/file.txt with content:'
            );
            expect(messages[0].content).toContain('test content');
            expect(result.value.completedReason).toBe('completed');
        });

        it('should create empty file when no content provided', async () => {
            mockFs.writeFile.mockResolvedValue(undefined);

            const generator = workspaceTools.createFile({
                filePath: '/test/empty.txt',
            });
            const control: AsyncControl = { type: 'continue' };

            const messages = [];
            let result = await generator.next(control);

            while (!result.done) {
                messages.push(result.value);
                result = await generator.next(control);
            }

            expect(mockFs.writeFile).toHaveBeenCalledWith(
                '/resolved/test/empty.txt',
                '',
                'utf8'
            );
            expect(messages[0].content).toContain(
                'Created file at /test/empty.txt as empty file'
            );
        });

        it('should handle file creation errors', async () => {
            mockFs.writeFile.mockRejectedValue(new Error('Permission denied'));

            const generator = workspaceTools.createFile({
                filePath: '/test/file.txt',
                content: 'test',
            });
            const control: AsyncControl = { type: 'continue' };

            const messages = [];
            let result = await generator.next(control);

            while (!result.done) {
                messages.push(result.value);
                result = await generator.next(control);
            }

            expect(messages).toHaveLength(1);
            expect(messages[0].type).toBe('error');
            expect(messages[0].content).toContain(
                'Cannot create file: Permission denied'
            );
            expect(result.value.completedReason).toBe('completed');
        });
    });

    describe('createDirectory', () => {
        it('should successfully create directory', async () => {
            mockFs.mkdir.mockResolvedValue(undefined);

            const generator = workspaceTools.createDirectory({
                directoryPath: '/test/dir',
                recursive: false,
            });
            const control: AsyncControl = { type: 'continue' };

            const messages = [];
            let result = await generator.next(control);

            while (!result.done) {
                messages.push(result.value);
                result = await generator.next(control);
            }

            expect(mockFs.mkdir).toHaveBeenCalledWith('/resolved/test/dir', {
                recursive: false,
            });
            expect(messages).toHaveLength(1);
            expect(messages[0].type).toBe('tool');
            expect(messages[0].content).toContain(
                'Created directory at /test/dir'
            );
            expect(result.value.completedReason).toBe('completed');
        });

        it('should create directory recursively when specified', async () => {
            mockFs.mkdir.mockResolvedValue(undefined);

            const generator = workspaceTools.createDirectory({
                directoryPath: '/test/nested/dir',
                recursive: true,
            });
            const control: AsyncControl = { type: 'continue' };

            const messages = [];
            let result = await generator.next(control);

            while (!result.done) {
                messages.push(result.value);
                result = await generator.next(control);
            }

            expect(mockFs.mkdir).toHaveBeenCalledWith(
                '/resolved/test/nested/dir',
                { recursive: true }
            );
            expect(messages[0].content).toContain(
                'including any missing parent directories'
            );
        });

        it('should handle directory creation errors', async () => {
            mockFs.mkdir.mockRejectedValue(new Error('Permission denied'));

            const generator = workspaceTools.createDirectory({
                directoryPath: '/test/dir',
            });
            const control: AsyncControl = { type: 'continue' };

            const messages = [];
            let result = await generator.next(control);

            while (!result.done) {
                messages.push(result.value);
                result = await generator.next(control);
            }

            expect(messages).toHaveLength(1);
            expect(messages[0].type).toBe('error');
            expect(messages[0].content).toContain(
                'Cannot create directory: Permission denied'
            );
            expect(result.value.completedReason).toBe('completed');
        });
    });

    describe('exists', () => {
        it('should return true for existing file', async () => {
            mockFs.stat.mockResolvedValue({ isDirectory: () => false });

            const generator = workspaceTools.exists({ path: '/test/file.txt' });
            const control: AsyncControl = { type: 'continue' };

            const messages = [];
            let result = await generator.next(control);

            while (!result.done) {
                messages.push(result.value);
                result = await generator.next(control);
            }

            expect(mockFs.stat).toHaveBeenCalledWith('/resolved/test/file.txt');
            expect(messages).toHaveLength(1);
            expect(messages[0].type).toBe('tool');
            expect(messages[0].content).toContain(
                'Path exists and is a file: /test/file.txt'
            );

            const parsedResult = JSON.parse(messages[0].metadata.result);
            expect(parsedResult).toEqual({ exists: true, type: 'file' });
            expect(result.value.completedReason).toBe('completed');
        });

        it('should return true for existing directory', async () => {
            mockFs.stat.mockResolvedValue({ isDirectory: () => true });

            const generator = workspaceTools.exists({ path: '/test/dir' });
            const control: AsyncControl = { type: 'continue' };

            const messages = [];
            let result = await generator.next(control);

            while (!result.done) {
                messages.push(result.value);
                result = await generator.next(control);
            }

            expect(messages[0].content).toContain(
                'Path exists and is a directory: /test/dir'
            );
            const parsedResult = JSON.parse(messages[0].metadata.result);
            expect(parsedResult).toEqual({ exists: true, type: 'directory' });
        });

        it('should return false for non-existing path', async () => {
            mockFs.stat.mockRejectedValue(
                new Error('ENOENT: no such file or directory')
            );

            const generator = workspaceTools.exists({
                path: '/test/nonexistent',
            });
            const control: AsyncControl = { type: 'continue' };

            const messages = [];
            let result = await generator.next(control);

            while (!result.done) {
                messages.push(result.value);
                result = await generator.next(control);
            }

            expect(messages).toHaveLength(1);
            expect(messages[0].type).toBe('tool');
            expect(messages[0].content).toContain(
                'Path does not exist: /test/nonexistent'
            );

            const parsedResult = JSON.parse(messages[0].metadata.result);
            expect(parsedResult).toEqual({ exists: false });
            expect(result.value.completedReason).toBe('completed');
        });
    });

    describe('respondsWithNoToolsError', () => {
        it('should return error message for unknown tools', async () => {
            const generator = workspaceTools.respondsWithNoToolsError({});
            const control: AsyncControl = { type: 'continue' };

            const messages = [];
            let result = await generator.next(control);

            while (!result.done) {
                messages.push(result.value);
                result = await generator.next(control);
            }

            expect(messages).toHaveLength(1);
            expect(messages[0].type).toBe('error');
            expect(messages[0].content).toBe(
                'Requested tool is not available in WorkspaceToolbox'
            );
            expect(messages[0].metadata?.error).toBeInstanceOf(Error);
            expect(result.value.completedReason).toBe('completed');
        });
    });

    describe('helper methods', () => {
        describe('createToolMessage', () => {
            it('should create proper tool message structure', async () => {
                // Test this indirectly through workspacePath since createToolMessage is private
                const generator = workspaceTools.workspacePath({});
                const control: AsyncControl = { type: 'continue' };

                const messages = [];
                let result = await generator.next(control);

                while (!result.done) {
                    messages.push(result.value);
                    result = await generator.next(control);
                }

                const message = messages[0];
                expect(message).toMatchObject({
                    id: expect.stringMatching(/^workspace-path-/),
                    type: 'tool',
                    sender: 'workspace-tool',
                    timestamp: expect.any(Date),
                    metadata: {
                        toolName: 'workspace_path',
                        parameters: {},
                        result: '/mock/workspace',
                    },
                });
            });
        });

        describe('createErrorMessage', () => {
            it('should create proper error message structure', async () => {
                mockFs.readdir.mockRejectedValue(new Error('Test error'));

                const generator = workspaceTools.listDirectory({
                    path: '/test',
                });
                const control: AsyncControl = { type: 'continue' };

                const messages = [];
                let result = await generator.next(control);

                while (!result.done) {
                    messages.push(result.value);
                    result = await generator.next(control);
                }

                const message = messages[0];
                expect(message).toMatchObject({
                    id: expect.stringMatching(/^list-dir-error-/),
                    type: 'error',
                    sender: 'workspace-tool',
                    timestamp: expect.any(Date),
                    metadata: {
                        error: expect.any(Error),
                    },
                });
            });
        });
    });

    describe('edge cases', () => {
        it('should handle undefined includeHidden parameter', async () => {
            const mockEntries = [
                { name: 'file1.txt', isDirectory: () => false },
                { name: '.hidden', isDirectory: () => false },
            ];

            mockFs.readdir.mockResolvedValue(mockEntries);

            const generator = workspaceTools.listDirectory({ path: '/test' });
            const control: AsyncControl = { type: 'continue' };

            const messages = [];
            let result = await generator.next(control);

            while (!result.done) {
                messages.push(result.value);
                result = await generator.next(control);
            }

            // Should default to false (exclude hidden files)
            const parsedResult = JSON.parse(messages[0].metadata.result);
            expect(parsedResult).toHaveLength(1);
            expect(
                parsedResult.find((r: any) => r.name === '.hidden')
            ).toBeUndefined();
        });

        it('should handle undefined content parameter in createFile', async () => {
            mockFs.writeFile.mockResolvedValue(undefined);

            const generator = workspaceTools.createFile({
                filePath: '/test/file.txt',
            });
            const control: AsyncControl = { type: 'continue' };

            const messages = [];
            let result = await generator.next(control);

            while (!result.done) {
                messages.push(result.value);
                result = await generator.next(control);
            }

            expect(mockFs.writeFile).toHaveBeenCalledWith(
                '/resolved/test/file.txt',
                '',
                'utf8'
            );
        });

        it('should handle undefined recursive parameter in createDirectory', async () => {
            mockFs.mkdir.mockResolvedValue(undefined);

            const generator = workspaceTools.createDirectory({
                directoryPath: '/test/dir',
            });
            const control: AsyncControl = { type: 'continue' };

            const messages = [];
            let result = await generator.next(control);

            while (!result.done) {
                messages.push(result.value);
                result = await generator.next(control);
            }

            expect(mockFs.mkdir).toHaveBeenCalledWith('/resolved/test/dir', {
                recursive: false,
            });
        });

        it('should handle non-Error objects thrown by filesystem operations', async () => {
            mockFs.readdir.mockRejectedValue('String error');

            const generator = workspaceTools.listDirectory({ path: '/test' });
            const control: AsyncControl = { type: 'continue' };

            const messages = [];
            let result = await generator.next(control);

            while (!result.done) {
                messages.push(result.value);
                result = await generator.next(control);
            }

            expect(messages[0].type).toBe('error');
            expect(messages[0].content).toContain(
                'Cannot access directory: String error'
            );
        });
    });
});
