import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import Database from 'better-sqlite3';
import { SessionManager } from '../interfaces/session-manager';
import { SessionChangeEvent } from '../models/session-events';
import { SessionInfo } from '../models/sessions';

/**
 * Service for managing FlowCode sessions
 *
 * Handles session creation, storage, and retrieval from ~/.flowcode/session/.
 * Each session is stored in its own directory with a hex-based name derived
 * from the creation timestamp. Sessions contain message databases, vector
 * databases, and metadata files. Emits events when sessions change.
 */
export class SessionService extends EventEmitter implements SessionManager {
    /**
     * The currently active session, null if none is loaded
     */
    private currentSession: SessionInfo | null = null;

    /**
     * Base path for all session storage (~/.flowcode/session)
     */
    private readonly sessionBasePath: string;

    /**
     * Creates a new SessionService instance
     *
     * @param homeDirectory The home directory path where sessions will be stored.
     */
    constructor(homeDirectory: string = os.homedir()) {
        super();
        this.sessionBasePath = path.join(homeDirectory, '.flowcode', 'session');
    }

    /**
     * Get the currently active session, creating a new one if none exists
     *
     * This method ensures there is always an active session available. If a session
     * is already loaded in memory, it returns that session. Otherwise, it creates
     * a brand new session with a unique hex identifier and initializes all required
     * files (message.db, vector.db, info.json).
     *
     * @returns Promise<SessionInfo> The active session information with database paths
     */
    async getActiveSession(): Promise<SessionInfo> {
        if (this.currentSession) {
            return this.currentSession;
        }
        await this.createSessionDirectoryIfNeeded();
        const previousSession = this.currentSession ?? undefined;
        this.currentSession = await this.createNewSession();

        this.emitSessionChangeEvent(this.currentSession, previousSession);

        return this.currentSession;
    }

    /**
     * Get all sessions sorted by last active date (most recent first)
     * @returns Promise<SessionInfo[]> Array of session information
     */
    async getSessionHistory(): Promise<SessionInfo[]> {
        try {
            await this.createSessionDirectoryIfNeeded();
            const sessionDirs = await fs.readdir(this.sessionBasePath);
            const sessions: SessionInfo[] = [];

            for (const sessionDir of sessionDirs) {
                const sessionPath = path.join(this.sessionBasePath, sessionDir);
                const stat = await fs.stat(sessionPath);

                if (stat.isDirectory()) {
                    try {
                        const sessionInfo =
                            await this.loadSessionInfo(sessionDir);
                        sessions.push(sessionInfo);
                    } catch {
                        // Skip invalid session directories
                    }
                }
            }

            // Sort by last active date (most recent first)
            return sessions.sort(
                (a, b) =>
                    b.lastActiveDate.getTime() - a.lastActiveDate.getTime()
            );
        } catch {
            // If session directory doesn't exist or other error, return empty array
            return [];
        }
    }

    /**
     * Switch to a different session
     * @param sessionId The hex ID of the session to switch to
     */
    async switchToSession(sessionId: string): Promise<void> {
        const previousSession = this.currentSession ?? undefined;

        // Check if we're already on this session
        if (previousSession && previousSession.name === sessionId) {
            // Just update the timestamp without emitting event
            await this.updateLastActiveDate();
            return;
        }

        const sessionInfo = await this.loadSessionInfo(sessionId);
        this.currentSession = sessionInfo;
        await this.updateLastActiveDate();

        this.emitSessionChangeEvent(this.currentSession, previousSession);
    }

    /**
     * Update the last active date for the current session
     */
    async updateLastActiveDate(): Promise<void> {
        if (!this.currentSession) {
            throw new Error('No active session to update');
        }

        this.currentSession.lastActiveDate = new Date();
        await this.saveSessionInfo(this.currentSession);
    }

    /**
     * Get the current active session information without creating a new one
     *
     * Returns the currently active session if one exists, or null if no session
     * is currently active. This is useful for components that need to check
     * session state without triggering session creation.
     *
     * @returns Promise<SessionInfo | null> The active session or null
     */
    async getCurrentActiveSession(): Promise<SessionInfo | null> {
        return this.currentSession;
    }

    private async createNewSession(): Promise<SessionInfo> {
        const now = new Date();
        const sessionName = this.generateHexSessionName(now);
        const sessionDir = path.join(this.sessionBasePath, sessionName);

        // Create session directory
        await fs.mkdir(sessionDir, { recursive: true });

        // Create database instance for the session
        const dbPath = path.join(sessionDir, 'message.db');
        const database = new Database(dbPath);

        // Create session info
        const sessionInfo: SessionInfo = {
            name: sessionName,
            lastActiveDate: now,
            database: database,
        };

        // Save session info
        await this.saveSessionInfo(sessionInfo);

        return sessionInfo;
    }

    private generateHexSessionName(date: Date): string {
        const timestamp = date.getTime();
        return timestamp.toString(16);
    }

    private async loadSessionInfo(sessionName: string): Promise<SessionInfo> {
        const sessionDir = path.join(this.sessionBasePath, sessionName);
        const infoPath = path.join(sessionDir, 'info.json');

        const infoContent = await fs.readFile(infoPath, 'utf-8');
        const info = JSON.parse(infoContent);

        // Create database instance for the session
        const dbPath = path.join(sessionDir, 'message.db');
        const database = new Database(dbPath);

        return {
            name: sessionName,
            lastActiveDate: new Date(info.lastActiveDate),
            database: database,
        };
    }

    private async saveSessionInfo(sessionInfo: SessionInfo): Promise<void> {
        const sessionDir = path.join(this.sessionBasePath, sessionInfo.name);
        const infoPath = path.join(sessionDir, 'info.json');

        const info = {
            lastActiveDate: sessionInfo.lastActiveDate.toISOString(),
        };

        await fs.writeFile(infoPath, JSON.stringify(info, null, 2), 'utf-8');
    }

    private async createSessionDirectoryIfNeeded(): Promise<void> {
        try {
            await fs.access(this.sessionBasePath);
        } catch {
            await fs.mkdir(this.sessionBasePath, { recursive: true });
        }
    }

    private emitSessionChangeEvent(
        activeSession: SessionInfo,
        previousSession?: SessionInfo
    ): void {
        const event: SessionChangeEvent = {
            type:
                activeSession.name === previousSession?.name
                    ? 'session-updated'
                    : 'session-switched',
            activeSession,
            previousSession,
            timestamp: new Date(),
        };
        this.emit('session-changed', event);
    }
}
