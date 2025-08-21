import { describe, it, expect, beforeEach } from 'vitest';
import { StoresFactory } from '../../../src/application/stores/stores-factory';
import { Embedder } from '../../../src/application/interfaces/embedder';
import { SessionManager } from '../../../src/application/interfaces/session-manager';
import { SessionInfo } from '../../../src/application/models/sessions';
import Database from 'better-sqlite3';

// Mock implementations for testing
class MockEmbedder implements Embedder {
    isAvailable = true;

    async embed(text: string): Promise<number[]> {
        return [0.1, 0.2, 0.3];
    }
}

class MockSessionManager implements SessionManager {
    on(event: string, listener: (...args: any[]) => void): this {
        return this;
    }

    off(event: string, listener: (...args: any[]) => void): this {
        return this;
    }

    emit(event: string, ...args: any[]): boolean {
        return true;
    }

    async getActiveSession(): Promise<SessionInfo> {
        return {
            id: 'test-session',
            name: 'Test Session',
            path: '/test/session',
            lastActiveDate: new Date().toISOString(),
            database: new Database(':memory:'),
        };
    }

    async getSessionHistory(): Promise<SessionInfo[]> {
        return [];
    }

    async switchToSession(sessionId: string): Promise<void> {
        // Mock implementation
    }

    async updateLastActiveDate(): Promise<void> {
        // Mock implementation
    }

    async getCurrentActiveSession(): Promise<SessionInfo | null> {
        return null;
    }
}

describe('StoresFactory', () => {
    let factory: StoresFactory;
    let mockEmbedder: MockEmbedder;
    let mockSessionManager: MockSessionManager;

    beforeEach(() => {
        mockEmbedder = new MockEmbedder();
        mockSessionManager = new MockSessionManager();
        factory = new StoresFactory(
            mockEmbedder,
            mockSessionManager,
            '/test/workspace',
            '/test/home'
        );
    });

    describe('constructor', () => {
        it('should accept dependencies with default paths', () => {
            const minimalFactory = new StoresFactory(
                new MockEmbedder(),
                new MockSessionManager()
            );
            expect(minimalFactory).toBeDefined();
        });

        it('should use provided custom paths', () => {
            expect(factory).toBeDefined();
        });
    });

    describe('createTokenStore', () => {
        it('should create a TokenStore instance', () => {
            const tokenStore = factory.createTokenStore();

            expect(tokenStore).toBeDefined();
            expect(typeof tokenStore.getTokenUsage).toBe('function');
            expect(typeof tokenStore.getTotalTokenUsage).toBe('function');
            expect(typeof tokenStore.incrementTokenUsage).toBe('function');
        });

        it('should return the same instance on subsequent calls (lazy caching)', () => {
            const tokenStore1 = factory.createTokenStore();
            const tokenStore2 = factory.createTokenStore();

            expect(tokenStore1).toBe(tokenStore2);
        });

        it('should have initial empty token usage', () => {
            const tokenStore = factory.createTokenStore();

            expect(tokenStore.getTotalTokenUsage()).toBe(0);
            expect(tokenStore.getTokenUsage('test-agent')).toBe(0);
        });
    });

    describe('createSettingsStore', () => {
        it('should create a SettingsStore instance', () => {
            const settingsStore = factory.createSettingsStore();

            expect(settingsStore).toBeDefined();
            expect(typeof settingsStore.fetchSettings).toBe('function');
            expect(typeof settingsStore.writeSettings).toBe('function');
            expect(typeof settingsStore.isToolAllowed).toBe('function');
        });

        it('should return the same instance on subsequent calls (lazy caching)', () => {
            const settingsStore1 = factory.createSettingsStore();
            const settingsStore2 = factory.createSettingsStore();

            expect(settingsStore1).toBe(settingsStore2);
        });
    });

    describe('createVectorStore', () => {
        it('should create a VectorStore instance', () => {
            const vectorStore = factory.createVectorStore();

            expect(vectorStore).toBeDefined();
            expect(typeof vectorStore.storeVector).toBe('function');
            expect(typeof vectorStore.searchSimilar).toBe('function');
        });

        it('should return the same instance on subsequent calls (lazy caching)', () => {
            const vectorStore1 = factory.createVectorStore();
            const vectorStore2 = factory.createVectorStore();

            expect(vectorStore1).toBe(vectorStore2);
        });
    });

    describe('createMessageStore', () => {
        it('should create a MessageStore instance', () => {
            const messageStore = factory.createMessageStore();

            expect(messageStore).toBeDefined();
            expect(typeof messageStore.storeMessage).toBe('function');
            expect(typeof messageStore.getMessageHistory).toBe('function');
            expect(typeof messageStore.getMessageById).toBe('function');
        });

        it('should return the same instance on subsequent calls (lazy caching)', () => {
            const messageStore1 = factory.createMessageStore();
            const messageStore2 = factory.createMessageStore();

            expect(messageStore1).toBe(messageStore2);
        });
    });

    describe('createNaturalMessageStore', () => {
        it('should create a NaturalMessageStore instance', () => {
            const naturalMessageStore = factory.createNaturalMessageStore();

            expect(naturalMessageStore).toBeDefined();
            expect(typeof naturalMessageStore.searchSimilar).toBe('function');
            expect(typeof naturalMessageStore.storeMessage).toBe('function');
            expect(typeof naturalMessageStore.getMessageHistory).toBe(
                'function'
            );
        });

        it('should return the same instance on subsequent calls (lazy caching)', () => {
            const naturalMessageStore1 = factory.createNaturalMessageStore();
            const naturalMessageStore2 = factory.createNaturalMessageStore();

            expect(naturalMessageStore1).toBe(naturalMessageStore2);
        });

        it('should inject the correct dependencies', () => {
            const naturalMessageStore = factory.createNaturalMessageStore();

            // Test that vector search availability reflects the embedder
            expect(naturalMessageStore.isVectorSearchAvailable).toBe(true);
        });

        it('should use factory-created stores internally', () => {
            const naturalMessageStore = factory.createNaturalMessageStore();
            const vectorStore = factory.createVectorStore();
            const messageStore = factory.createMessageStore();

            // Both should be defined since NaturalMessageStore should trigger their creation
            expect(vectorStore).toBeDefined();
            expect(messageStore).toBeDefined();
        });
    });

    describe('createCredentialStore', () => {
        it('should create a CredentialStore instance', () => {
            const credentialStore = factory.createCredentialStore();

            expect(credentialStore).toBeDefined();
            expect(typeof credentialStore.fetchCredentials).toBe('function');
            expect(typeof credentialStore.writeCredential).toBe('function');
            expect(typeof credentialStore.getCredential).toBe('function');
        });

        it('should return the same instance on subsequent calls (lazy caching)', () => {
            const credentialStore1 = factory.createCredentialStore();
            const credentialStore2 = factory.createCredentialStore();

            expect(credentialStore1).toBe(credentialStore2);
        });
    });

    describe('createConfigStore', () => {
        it('should create a ConfigStore instance', () => {
            const configStore = factory.createConfigStore();

            expect(configStore).toBeDefined();
            expect(typeof configStore.fetchConfig).toBe('function');
            expect(typeof configStore.writeConfig).toBe('function');
            expect(typeof configStore.getAgentConfig).toBe('function');
        });

        it('should return the same instance on subsequent calls (lazy caching)', () => {
            const configStore1 = factory.createConfigStore();
            const configStore2 = factory.createConfigStore();

            expect(configStore1).toBe(configStore2);
        });

        it('should be an EventEmitter', () => {
            const configStore = factory.createConfigStore();

            expect(typeof configStore.on).toBe('function');
            expect(typeof configStore.emit).toBe('function');
        });
    });

    describe('clearCache', () => {
        it('should clear all cached instances', () => {
            // Create all stores
            const tokenStore1 = factory.createTokenStore();
            const settingsStore1 = factory.createSettingsStore();
            const vectorStore1 = factory.createVectorStore();
            const messageStore1 = factory.createMessageStore();
            const naturalMessageStore1 = factory.createNaturalMessageStore();
            const credentialStore1 = factory.createCredentialStore();
            const configStore1 = factory.createConfigStore();

            // Clear cache
            factory.clearCache();

            // Create stores again - should be new instances
            const tokenStore2 = factory.createTokenStore();
            const settingsStore2 = factory.createSettingsStore();
            const vectorStore2 = factory.createVectorStore();
            const messageStore2 = factory.createMessageStore();
            const naturalMessageStore2 = factory.createNaturalMessageStore();
            const credentialStore2 = factory.createCredentialStore();
            const configStore2 = factory.createConfigStore();

            expect(tokenStore1).not.toBe(tokenStore2);
            expect(settingsStore1).not.toBe(settingsStore2);
            expect(vectorStore1).not.toBe(vectorStore2);
            expect(messageStore1).not.toBe(messageStore2);
            expect(naturalMessageStore1).not.toBe(naturalMessageStore2);
            expect(credentialStore1).not.toBe(credentialStore2);
            expect(configStore1).not.toBe(configStore2);
        });

        it('should maintain lazy loading after cache clear', () => {
            factory.clearCache();

            const tokenStore1 = factory.createTokenStore();
            const tokenStore2 = factory.createTokenStore();

            expect(tokenStore1).toBe(tokenStore2);
        });
    });

    describe('integration with real dependencies', () => {
        it('should work with unavailable embedder', () => {
            const unavailableEmbedder: Embedder = {
                isAvailable: false,
                async embed(text: string): Promise<number[]> {
                    throw new Error('Embedder not available');
                },
            };

            const factoryWithUnavailableEmbedder = new StoresFactory(
                unavailableEmbedder,
                new MockSessionManager()
            );

            const naturalMessageStore =
                factoryWithUnavailableEmbedder.createNaturalMessageStore();
            expect(naturalMessageStore.isVectorSearchAvailable).toBe(false);
        });
    });

    describe('all stores creation', () => {
        it('should create all supported store types without errors', () => {
            expect(() => factory.createTokenStore()).not.toThrow();
            expect(() => factory.createSettingsStore()).not.toThrow();
            expect(() => factory.createVectorStore()).not.toThrow();
            expect(() => factory.createMessageStore()).not.toThrow();
            expect(() => factory.createNaturalMessageStore()).not.toThrow();
            expect(() => factory.createCredentialStore()).not.toThrow();
            expect(() => factory.createConfigStore()).not.toThrow();
        });

        it('should create different types of stores independently', () => {
            const tokenStore = factory.createTokenStore();
            const settingsStore = factory.createSettingsStore();
            const vectorStore = factory.createVectorStore();
            const messageStore = factory.createMessageStore();
            const naturalMessageStore = factory.createNaturalMessageStore();
            const credentialStore = factory.createCredentialStore();
            const configStore = factory.createConfigStore();

            expect(tokenStore).not.toBe(settingsStore);
            expect(settingsStore).not.toBe(vectorStore);
            expect(vectorStore).not.toBe(messageStore);
            expect(messageStore).not.toBe(naturalMessageStore);
            expect(naturalMessageStore).not.toBe(credentialStore);
            expect(credentialStore).not.toBe(configStore);
        });
    });
});
