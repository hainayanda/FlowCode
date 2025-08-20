import { SessionInfo } from './sessions';

/**
 * Types of session change events
 */
export type SessionChangeEventType = 'session-switched' | 'session-updated';

/**
 * Session change event data
 */
export interface SessionChangeEvent {
    /** Type of the session change event */
    type: SessionChangeEventType;
    /** The new active session information */
    activeSession: SessionInfo;
    /** Previous session information (for session-switched events) */
    previousSession?: SessionInfo | undefined;
    /** Timestamp when the event occurred */
    timestamp: Date;
}

/**
 * Callback function type for session change subscribers
 */
export type SessionChangeCallback = (
    event: SessionChangeEvent
) => void | Promise<void>;
