import { Settings } from '../models/settings';

/**
 * Interface for reading settings data.
 *
 * Provides access to settings configuration and methods to fetch
 * the latest settings from persistent storage.
 */
export interface SettingsReader {
    /** Array of allowed tools */
    allowedTools: string[];

    /** Array of denied tools */
    deniedTools: string[];

    /**
     * Fetches the latest settings from storage.
     *
     * @returns Promise resolving to the current settings
     */
    fetchSettings(): Promise<Settings>;

    /**
     * Fetches the latest allowed tools from storage.
     *
     * @returns Promise resolving to array of allowed tools
     */
    fetchAllowedTools(): Promise<string[]>;

    /**
     * Fetches the latest denied tools from storage.
     *
     * @returns Promise resolving to array of denied tools
     */
    fetchDeniedTools(): Promise<string[]>;

    /**
     * Checks if a tool is in the allowed list.
     *
     * @param tool - Name of the tool to check
     * @returns Promise resolving to true if tool is allowed
     */
    isToolAllowed(tool: string): Promise<boolean>;

    /**
     * Checks if a tool is in the denied list.
     *
     * @param tool - Name of the tool to check
     * @returns Promise resolving to true if tool is denied
     */
    isToolDenied(tool: string): Promise<boolean>;
}

/**
 * Interface for writing settings data.
 *
 * Provides methods to persist settings configuration to storage,
 * allowing for runtime settings management.
 */
export interface SettingsWriter {
    /**
     * Writes settings to storage.
     *
     * @param settings - Settings object to persist
     */
    writeSettings(settings: Settings): Promise<void>;

    /**
     * Adds a tool to the allowed list.
     *
     * @param tool - Name of the tool to allow
     */
    addAllowedTool(tool: string): Promise<void>;

    /**
     * Adds a tool to the denied list.
     *
     * @param tool - Name of the tool to deny
     */
    addDeniedTool(tool: string): Promise<void>;

    /**
     * Removes a tool from the allowed list.
     *
     * @param tool - Name of the tool to remove from allowed list
     */
    removeAllowedTool(tool: string): Promise<void>;

    /**
     * Removes a tool from the denied list.
     *
     * @param tool - Name of the tool to remove from denied list
     */
    removeDeniedTool(tool: string): Promise<void>;
}

/**
 * Combined interface for reading and writing settings data.
 */
export interface SettingsStore extends SettingsReader, SettingsWriter {}
