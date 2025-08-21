import { EventEmitter } from 'events';
import Database from 'better-sqlite3';
import { SessionManager } from '../../../../src/application/interfaces/session-manager';
import { SessionChangeEvent } from '../../../../src/application/models/session-events';
import { SessionInfo } from '../../../../src/application/models/sessions';

/**
 * Mock SessionManager for testing SQLiteMessageStore
 */
export class MockSessionManager extends EventEmitter implements SessionManager {
    private mockActiveSession: SessionInfo;
    private mockSessionHistory: SessionInfo[] = [];

    constructor(mockDbPath: string = ':memory:') {
        super();
        this.mockActiveSession = {
            name: 'test-session',
            lastActiveDate: new Date(),
            database: new Database(mockDbPath),
        };
    }

    async getActiveSession(): Promise<SessionInfo> {
        // Simulate the behavior of creating a new session if none exists
        if (!this.mockActiveSession) {
            const previousSession = undefined;
            this.mockActiveSession = {
                name: 'test-session',
                lastActiveDate: new Date(),
                database: new Database(':memory:'),
            };
            this.emitSessionChangeEvent(
                this.mockActiveSession,
                previousSession
            );
        }
        return this.mockActiveSession;
    }

    async getSessionHistory(): Promise<SessionInfo[]> {
        return this.mockSessionHistory;
    }

    async switchToSession(sessionId: string): Promise<void> {
        const previousSession = this.mockActiveSession
            ? { ...this.mockActiveSession }
            : undefined;

        // Check if we're already on this session
        if (previousSession && previousSession.name === sessionId) {
            // Just update the timestamp without emitting event
            await this.updateLastActiveDate();
            return;
        }

        // Find session in history or create new one
        const foundSession = this.mockSessionHistory.find(
            (s) => s.name === sessionId
        );
        if (foundSession) {
            this.mockActiveSession = {
                ...foundSession,
                lastActiveDate: new Date(),
            };
        } else {
            // Create new session for testing
            this.mockActiveSession = {
                name: sessionId,
                lastActiveDate: new Date(),
                database: new Database(':memory:'),
            };
        }

        this.emitSessionChangeEvent(this.mockActiveSession, previousSession);
    }

    async updateLastActiveDate(): Promise<void> {
        this.mockActiveSession.lastActiveDate = new Date();
    }

    async getCurrentActiveSession(): Promise<SessionInfo | null> {
        return this.mockActiveSession;
    }

    // Helper methods for testing
    setMockActiveSession(session: SessionInfo) {
        this.mockActiveSession = session;
    }

    setMockSessionHistory(sessions: SessionInfo[]) {
        this.mockSessionHistory = sessions;
    }

    setMockDbPath(dbPath: string) {
        // Close old database if it exists
        if (this.mockActiveSession.database) {
            this.mockActiveSession.database.close();
        }
        this.mockActiveSession.database = new Database(dbPath);
    }

    /**
     * Helper method to simulate session change for testing
     */
    simulateSessionChange(newSession: Partial<SessionInfo> & { name: string }) {
        const previousSession = this.mockActiveSession
            ? { ...this.mockActiveSession }
            : undefined;

        // Close previous database if switching to a new one
        if (this.mockActiveSession?.database && newSession.database) {
            this.mockActiveSession.database.close();
        }

        this.mockActiveSession = {
            name: newSession.name,
            lastActiveDate: newSession.lastActiveDate || new Date(),
            database: newSession.database || new Database(':memory:'),
        };

        this.emitSessionChangeEvent(this.mockActiveSession, previousSession);
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
