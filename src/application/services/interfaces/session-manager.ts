import { EventEmitter } from 'events';
import { SessionInfo } from '../../stores/models/sessions';

/**
 * Interface for managing FlowCode sessions
 *
 * Provides functionality to create, retrieve, and manage user sessions.
 * Each session maintains its own message history, vector database, and metadata.
 * Supports reactive notifications for session changes via EventEmitter.
 */
export interface SessionManager extends EventEmitter {
    /**
     * Get the currently active session, creating a new one if none exists
     *
     * This method ensures there is always an active session available for the user.
     * If no session is currently active, it will create a new session with a unique
     * hex-based identifier derived from the creation timestamp.
     *
     * @returns Promise<SessionInfo> The active session information including paths to databases
     */
    getActiveSession(): Promise<SessionInfo>;

    /**
     * Retrieve the complete history of all sessions
     *
     * Returns all available sessions sorted by their last active date in descending order
     * (most recently active first). This allows users to see and potentially switch
     * to previous sessions.
     *
     * @returns Promise<SessionInfo[]> Array of session information sorted by last active date
     */
    getSessionHistory(): Promise<SessionInfo[]>;

    /**
     * Switch the active session to a specific existing session
     *
     * Changes the current active session to the specified session ID and updates
     * its last active date. The session must exist in the session directory.
     *
     * @param sessionId The hex-based ID of the session to switch to
     * @returns Promise<void> Resolves when the session switch is complete
     */
    switchToSession(sessionId: string): Promise<void>;

    /**
     * Update the last active timestamp for the current session
     *
     * Marks the current session as recently active by updating its lastActiveDate
     * to the current time. This affects the ordering in session history.
     *
     * @returns Promise<void> Resolves when the timestamp update is saved
     */
    updateLastActiveDate(): Promise<void>;

    /**
     * Get the current active session information without creating a new one
     *
     * Returns the currently active session if one exists, or null if no session
     * is currently active. This is useful for components that need to check
     * session state without triggering session creation.
     *
     * @returns Promise<SessionInfo | null> The active session or null
     */
    getCurrentActiveSession(): Promise<SessionInfo | null>;
}
