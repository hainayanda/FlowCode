import { Embedder } from '../../common/interfaces/embedder';
import { SessionManager } from '../services/interfaces/session-manager';
import { ConfigRepository } from './config-repository';
import { CredentialRepository } from './credential-repository';
import { ConfigStore } from './interfaces/config-store';
import { CredentialStore } from './interfaces/credential-store';
import { MessageStore, NaturalMessageStore } from './interfaces/message-store';
import { SettingsStore } from './interfaces/settings-store';
import { TokenStore } from './interfaces/token-store';
import { VectorStore } from './interfaces/vector-store';
import { CachedMessageStore } from './messages/cached-message-store';
import { MessageRepository } from './messages/message-repository';
import { SQLiteMessageStore } from './messages/sqlite-message-store';
import { NaturalMessageRepository } from './natural-message-repository';
import { SettingsRepository } from './settings-repository';
import { TokenRepository } from './token-repository';
import { CachedVectorStore } from './vectors/cached-vector-store';
import { SQLiteVectorStore } from './vectors/sqlite-vector-store';
import { VectorRepository } from './vectors/vector-repository';

/**
 * Factory for creating and managing store instances with lazy initialization.
 *
 * This factory provides a centralized way to create store instances with proper
 * dependency injection. All stores are created lazily and cached for reuse.
 * Only creates stores when they are first requested, which improves startup performance.
 *
 * @example
 * ```typescript
 * const factory = new StoresFactory(myEmbedder, mySessionManager);
 *
 * const tokenStore = factory.createTokenStore();
 * const configStore = factory.createConfigStore();
 * const naturalMessageStore = factory.createNaturalMessageStore();
 * ```
 */
export class StoresFactory {
    private readonly embedder: Embedder;
    private readonly sessionManager: SessionManager;
    private readonly workspaceRoot: string;
    private readonly homeDirectory: string;

    // Lazy-loaded store instances
    private _tokenStore: TokenStore | undefined;
    private _settingsStore: SettingsStore | undefined;
    private _naturalMessageStore: NaturalMessageStore | undefined;
    private _credentialStore: CredentialStore | undefined;
    private _configStore: ConfigStore | undefined;
    private _vectorStore: VectorStore | undefined;
    private _messageStore: MessageStore | undefined;

    /**
     * Creates a new StoresFactory instance with injected dependencies.
     *
     * @param embedder - Embedder for vector operations (required for NaturalMessageStore)
     * @param sessionManager - Session manager for database and session handling (required for MessageStore and VectorStore)
     * @param workspaceRoot - The root directory of the workspace (defaults to process.cwd())
     * @param homeDirectory - The home directory (defaults to os.homedir())
     */
    constructor(
        embedder: Embedder,
        sessionManager: SessionManager,
        workspaceRoot: string = process.cwd(),
        homeDirectory: string = require('os').homedir()
    ) {
        this.embedder = embedder;
        this.sessionManager = sessionManager;
        this.workspaceRoot = workspaceRoot;
        this.homeDirectory = homeDirectory;
    }

    /**
     * Creates or returns the cached TokenStore instance.
     *
     * TokenStore provides in-memory token usage tracking across different agents.
     * No external dependencies required.
     *
     * @returns TokenStore instance for token usage management
     */
    createTokenStore(): TokenStore {
        if (!this._tokenStore) {
            this._tokenStore = new TokenRepository();
        }
        return this._tokenStore;
    }

    /**
     * Creates or returns the cached SettingsStore instance.
     *
     * SettingsStore manages application settings persistence through settings.json
     * in the workspace .flowcode directory.
     *
     * @returns SettingsStore instance for settings management
     */
    createSettingsStore(): SettingsStore {
        if (!this._settingsStore) {
            this._settingsStore = new SettingsRepository(this.workspaceRoot);
        }
        return this._settingsStore;
    }

    /**
     * Creates or returns the cached VectorStore instance.
     *
     * VectorStore combines cached and persistent vector storage for optimal
     * performance and durability. Uses SessionManager for database operations.
     *
     * @returns VectorStore instance for vector storage and similarity search
     */
    createVectorStore(): VectorStore {
        if (!this._vectorStore) {
            const cachedStore = new CachedVectorStore(this.sessionManager);
            const persistentStore = new SQLiteVectorStore(this.sessionManager);
            this._vectorStore = new VectorRepository(
                cachedStore,
                persistentStore
            );
        }
        return this._vectorStore;
    }

    /**
     * Creates or returns the cached MessageStore instance.
     *
     * MessageStore combines cached and persistent message storage for optimal
     * performance and durability. Uses SessionManager for database operations.
     *
     * @returns MessageStore instance for message storage and retrieval
     */
    createMessageStore(): MessageStore {
        if (!this._messageStore) {
            const cachedStore = new CachedMessageStore(this.sessionManager);
            const persistentStore = new SQLiteMessageStore(this.sessionManager);
            this._messageStore = new MessageRepository(
                cachedStore,
                persistentStore
            );
        }
        return this._messageStore;
    }

    /**
     * Creates or returns the cached NaturalMessageStore instance.
     *
     * NaturalMessageStore combines vector search capabilities with message storage,
     * enabling semantic search across conversation history. Uses factory-created
     * VectorStore and MessageStore instances.
     *
     * @returns NaturalMessageStore instance for semantic message operations
     */
    createNaturalMessageStore(): NaturalMessageStore {
        if (!this._naturalMessageStore) {
            this._naturalMessageStore = new NaturalMessageRepository(
                this.embedder,
                this.createVectorStore(),
                this.createMessageStore()
            );
        }
        return this._naturalMessageStore;
    }

    /**
     * Creates or returns the cached CredentialStore instance.
     *
     * CredentialStore manages credential persistence through credentials.json
     * in the ~/.flowcode directory.
     *
     * @returns CredentialStore instance for credential management
     */
    createCredentialStore(): CredentialStore {
        if (!this._credentialStore) {
            this._credentialStore = new CredentialRepository(
                this.homeDirectory
            );
        }
        return this._credentialStore;
    }

    /**
     * Creates or returns the cached ConfigStore instance.
     *
     * ConfigStore manages configuration persistence through config.json in the
     * workspace .flowcode directory. Provides caching and event emission for changes.
     *
     * @returns ConfigStore instance for configuration management
     */
    createConfigStore(): ConfigStore {
        if (!this._configStore) {
            this._configStore = new ConfigRepository(this.workspaceRoot);
        }
        return this._configStore;
    }

    /**
     * Clears all cached store instances, forcing recreation on next access.
     *
     * Useful for testing or when dependencies need to be refreshed.
     * Does not affect the injected dependencies.
     */
    clearCache(): void {
        this._tokenStore = undefined;
        this._settingsStore = undefined;
        this._naturalMessageStore = undefined;
        this._credentialStore = undefined;
        this._configStore = undefined;
        this._vectorStore = undefined;
        this._messageStore = undefined;
    }
}
