import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SessionService } from '../../../src/application/services/session-service';

describe('SessionService', () => {
    let sessionService: SessionService;
    let testHomeDir: string;
    let testSessionPath: string;

    beforeEach(async () => {
        // Create a temporary directory for testing
        testHomeDir = await fs.mkdtemp(
            path.join(os.tmpdir(), 'session-service-test-')
        );
        testSessionPath = path.join(testHomeDir, '.flowcode', 'session');
        sessionService = new SessionService(testHomeDir);
    });

    afterEach(async () => {
        // Clean up test directory
        try {
            await fs.rm(testHomeDir, { recursive: true, force: true });
        } catch (error) {
            // Ignore cleanup errors
        }
    });

    describe('getActiveSession', () => {
        it('should create a new session when none exists', async () => {
            const session = await sessionService.getActiveSession();

            expect(session).toBeDefined();
            expect(session.name).toMatch(/^[0-9a-f]+$/); // hex format
            expect(session.lastActiveDate).toBeInstanceOf(Date);
            expect(session.messageDbPath).toContain('message.db');
            expect(session.vectorDbPath).toContain('vector.db');

            // Verify files were created
            const messageDbExists = await fs
                .access(session.messageDbPath)
                .then(() => true)
                .catch(() => false);
            const vectorDbExists = await fs
                .access(session.vectorDbPath)
                .then(() => true)
                .catch(() => false);
            const infoJsonExists = await fs
                .access(
                    path.join(path.dirname(session.messageDbPath), 'info.json')
                )
                .then(() => true)
                .catch(() => false);

            expect(messageDbExists).toBe(true);
            expect(vectorDbExists).toBe(true);
            expect(infoJsonExists).toBe(true);
        });

        it('should return the same session on subsequent calls', async () => {
            const session1 = await sessionService.getActiveSession();
            const session2 = await sessionService.getActiveSession();

            expect(session1.name).toBe(session2.name);
            expect(session1.lastActiveDate.getTime()).toBe(
                session2.lastActiveDate.getTime()
            );
        });

        it('should create new session each time for new service instance', async () => {
            // Create a session first
            const originalSession = await sessionService.getActiveSession();

            // Create a new service instance to simulate restart
            const newService = new SessionService(testHomeDir);
            const newSession = await newService.getActiveSession();

            // Should be different sessions
            expect(newSession.name).not.toBe(originalSession.name);
        });
    });

    describe('getSessionHistory', () => {
        it('should return empty array when no sessions exist', async () => {
            const history = await sessionService.getSessionHistory();
            expect(history).toEqual([]);
        });

        it('should return sessions sorted by last active date', async () => {
            // Create first session
            const session1 = await sessionService.getActiveSession();

            // Wait a bit and create another session
            await new Promise((resolve) => setTimeout(resolve, 10));

            // Create a new service and session
            const newService = new SessionService(testHomeDir);
            const session2 = await newService.getActiveSession();

            const history = await sessionService.getSessionHistory();

            expect(history.length).toBeGreaterThanOrEqual(1);
            expect(history[0].lastActiveDate.getTime()).toBeGreaterThanOrEqual(
                session1.lastActiveDate.getTime()
            );
        });
    });

    describe('switchToSession', () => {
        it('should switch to an existing session', async () => {
            // Create initial session
            const session1 = await sessionService.getActiveSession();
            const sessionName = session1.name;

            // Switch to the same session (should work)
            await sessionService.switchToSession(sessionName);

            const activeSession = await sessionService.getActiveSession();
            expect(activeSession.name).toBe(sessionName);
        });

        it('should throw error for non-existent session', async () => {
            await expect(
                sessionService.switchToSession('nonexistent')
            ).rejects.toThrow();
        });
    });

    describe('updateLastActiveDate', () => {
        it('should update the last active date of current session', async () => {
            const session = await sessionService.getActiveSession();
            const originalDate = new Date(session.lastActiveDate);

            // Wait a bit to ensure different timestamp
            await new Promise((resolve) => setTimeout(resolve, 10));

            await sessionService.updateLastActiveDate();

            const updatedSession = await sessionService.getActiveSession();
            expect(updatedSession.lastActiveDate.getTime()).toBeGreaterThan(
                originalDate.getTime()
            );
        });

        it('should throw error when no active session', async () => {
            const emptyService = new SessionService();
            await expect(emptyService.updateLastActiveDate()).rejects.toThrow(
                'No active session to update'
            );
        });
    });

    describe('session directory structure', () => {
        it('should create proper directory structure', async () => {
            const session = await sessionService.getActiveSession();
            const sessionDir = path.dirname(session.messageDbPath);

            // Check that session directory exists
            const dirStat = await fs.stat(sessionDir);
            expect(dirStat.isDirectory()).toBe(true);

            // Check that all required files exist
            const messageDbStat = await fs.stat(session.messageDbPath);
            const vectorDbStat = await fs.stat(session.vectorDbPath);
            const infoJsonStat = await fs.stat(
                path.join(sessionDir, 'info.json')
            );

            expect(messageDbStat.isFile()).toBe(true);
            expect(vectorDbStat.isFile()).toBe(true);
            expect(infoJsonStat.isFile()).toBe(true);
        });

        it('should save and load info.json correctly', async () => {
            const session = await sessionService.getActiveSession();
            const sessionDir = path.dirname(session.messageDbPath);
            const infoPath = path.join(sessionDir, 'info.json');

            const infoContent = await fs.readFile(infoPath, 'utf-8');
            const info = JSON.parse(infoContent);

            expect(info.lastActiveDate).toBeDefined();
            expect(new Date(info.lastActiveDate)).toEqual(
                session.lastActiveDate
            );
        });
    });

    describe('hex session naming', () => {
        it('should generate hex session names', async () => {
            const session = await sessionService.getActiveSession();

            // Should be valid hex
            expect(session.name).toMatch(/^[0-9a-f]+$/);

            // Should be based on timestamp
            const hexValue = parseInt(session.name, 16);
            const now = Date.now();

            // Should be close to current timestamp (within 10 seconds)
            expect(Math.abs(hexValue - now)).toBeLessThan(10000);
        });
    });
});
