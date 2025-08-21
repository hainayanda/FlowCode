import { vi } from 'vitest';
import { SettingsStore } from '../../../../src/application/interfaces/settings-store';
import { WorkspaceToolboxDelegate } from '../../../../src/application/tools/workspace/workspace-toolbox-delegate';
import {
    AsyncControl,
    AsyncControlResponse,
} from '../../../../src/application/models/async-control';
import { Message } from '../../../../src/application/models/messages';
import { Settings } from '../../../../src/application/models/settings';
import { generateUniqueId } from '../../../../src/utils/id-generator';

/**
 * Mock implementation of SettingsStore for testing
 */
export class MockSettingsStore implements SettingsStore {
    public allowedTools: string[] = [];
    public deniedTools: string[] = [];

    private allowedSet = new Set<string>();
    private deniedSet = new Set<string>();

    // Mock methods with spies
    public fetchSettings = vi.fn().mockResolvedValue({} as Settings);
    public fetchAllowedTools = vi
        .fn()
        .mockImplementation(() => Promise.resolve([...this.allowedSet]));
    public fetchDeniedTools = vi
        .fn()
        .mockImplementation(() => Promise.resolve([...this.deniedSet]));
    public writeSettings = vi.fn().mockResolvedValue(undefined);
    public addAllowedTool = vi.fn().mockImplementation((tool: string) => {
        this.allowedSet.add(tool);
        this.allowedTools = [...this.allowedSet];
        return Promise.resolve();
    });
    public addDeniedTool = vi.fn().mockImplementation((tool: string) => {
        this.deniedSet.add(tool);
        this.deniedTools = [...this.deniedSet];
        return Promise.resolve();
    });
    public removeAllowedTool = vi.fn().mockImplementation((tool: string) => {
        this.allowedSet.delete(tool);
        this.allowedTools = [...this.allowedSet];
        return Promise.resolve();
    });
    public removeDeniedTool = vi.fn().mockImplementation((tool: string) => {
        this.deniedSet.delete(tool);
        this.deniedTools = [...this.deniedSet];
        return Promise.resolve();
    });
    public isToolAllowed = vi
        .fn()
        .mockImplementation((tool: string) =>
            Promise.resolve(this.allowedSet.has(tool))
        );
    public isToolDenied = vi
        .fn()
        .mockImplementation((tool: string) =>
            Promise.resolve(this.deniedSet.has(tool))
        );

    // Helper methods for testing
    setToolAllowed(tool: string, allowed: boolean): void {
        if (allowed) {
            this.allowedSet.add(tool);
            this.allowedTools = [...this.allowedSet];
        } else {
            this.allowedSet.delete(tool);
            this.allowedTools = [...this.allowedSet];
        }
    }

    setToolDenied(tool: string, denied: boolean): void {
        if (denied) {
            this.deniedSet.add(tool);
            this.deniedTools = [...this.deniedSet];
        } else {
            this.deniedSet.delete(tool);
            this.deniedTools = [...this.deniedSet];
        }
    }

    reset(): void {
        this.allowedSet.clear();
        this.deniedSet.clear();
        this.allowedTools = [];
        this.deniedTools = [];
        vi.clearAllMocks();
    }
}

/**
 * Mock implementation of WorkspaceToolboxDelegate for testing
 */
export class MockWorkspaceToolboxDelegate implements WorkspaceToolboxDelegate {
    public listDirectory = vi.fn().mockImplementation(async function* (
        parameters: Record<string, any>
    ): AsyncGenerator<Message, AsyncControlResponse, AsyncControl> {
        const message = createMockMessage(
            'tool',
            `Listed directory: ${parameters.path}`
        );
        yield message;
        return {
            messages: [message],
            completedReason: 'completed',
            usage: { inputTokens: 0, outputTokens: 0, toolsUsed: 1 },
        };
    });

    public workspacePath = vi.fn().mockImplementation(async function* (
        _parameters: Record<string, any>
    ): AsyncGenerator<Message, AsyncControlResponse, AsyncControl> {
        const message = createMockMessage(
            'tool',
            'Current workspace: /mock/workspace'
        );
        yield message;
        return {
            messages: [message],
            completedReason: 'completed',
            usage: { inputTokens: 0, outputTokens: 0, toolsUsed: 1 },
        };
    });

    public createFile = vi.fn().mockImplementation(async function* (
        parameters: Record<string, any>
    ): AsyncGenerator<Message, AsyncControlResponse, AsyncControl> {
        const message = createMockMessage(
            'tool',
            `Created file: ${parameters.filePath}`
        );
        yield message;
        return {
            messages: [message],
            completedReason: 'completed',
            usage: { inputTokens: 0, outputTokens: 0, toolsUsed: 1 },
        };
    });

    public createDirectory = vi.fn().mockImplementation(async function* (
        parameters: Record<string, any>
    ): AsyncGenerator<Message, AsyncControlResponse, AsyncControl> {
        const message = createMockMessage(
            'tool',
            `Created directory: ${parameters.directoryPath}`
        );
        yield message;
        return {
            messages: [message],
            completedReason: 'completed',
            usage: { inputTokens: 0, outputTokens: 0, toolsUsed: 1 },
        };
    });

    public exists = vi.fn().mockImplementation(async function* (
        parameters: Record<string, any>
    ): AsyncGenerator<Message, AsyncControlResponse, AsyncControl> {
        const message = createMockMessage(
            'tool',
            `Path exists: ${parameters.path}`
        );
        yield message;
        return {
            messages: [message],
            completedReason: 'completed',
            usage: { inputTokens: 0, outputTokens: 0, toolsUsed: 1 },
        };
    });

    public respondsWithNoToolsError = vi
        .fn()
        .mockImplementation(async function* (
            _parameters: Record<string, any>
        ): AsyncGenerator<Message, AsyncControlResponse, AsyncControl> {
            const message = createMockMessage('error', 'Tool not found');
            yield message;
            return {
                messages: [message],
                completedReason: 'completed',
                usage: { inputTokens: 0, outputTokens: 0, toolsUsed: 1 },
            };
        });

    reset(): void {
        vi.clearAllMocks();
    }
}

/**
 * Helper function to create mock messages
 */
function createMockMessage(type: Message['type'], content: string): Message {
    return {
        id: generateUniqueId('mock'),
        content,
        type,
        sender: 'mock-workspace-tool',
        timestamp: new Date(),
    };
}
