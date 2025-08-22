import * as fs from 'fs/promises';
import * as path from 'path';
import { createFlowcodeDirectoryIfNeeded } from '../../common/utils/flowcode-directory';
import { SettingsStore } from './interfaces/settings-store';
import { Settings } from './models/settings';

/**
 * Creates default settings.
 *
 * @returns Default settings with empty permission arrays
 */
function createDefaultSettings(): Settings {
    return {
        permissions: {
            allow: [],
            deny: [],
        },
    };
}

/**
 * File-based settings repository.
 *
 * Manages settings persistence through settings.json in the workspace .flowcode directory.
 * Provides caching for efficient access and ensures data consistency through
 * read-after-write operations.
 */
export class SettingsRepository implements SettingsStore {
    private _settings: Settings = createDefaultSettings();
    private readonly settingsPath: string;
    private readonly workspaceRoot: string;

    /**
     * Creates a new SettingsRepository instance.
     *
     * @param workspaceRoot - The root directory of the workspace (process.cwd())
     */
    constructor(workspaceRoot: string = process.cwd()) {
        this.workspaceRoot = workspaceRoot;
        this.settingsPath = path.join(
            workspaceRoot,
            '.flowcode',
            'settings.json'
        );
    }

    /** Array of allowed tools */
    get allowedTools(): string[] {
        return this._settings.permissions.allow;
    }

    /** Array of denied tools */
    get deniedTools(): string[] {
        return this._settings.permissions.deny;
    }

    /**
     * Fetches the latest settings from storage.
     *
     * @returns Promise resolving to the current settings
     * @throws Error if settings file cannot be read or is invalid
     */
    async fetchSettings(): Promise<Settings> {
        try {
            await createFlowcodeDirectoryIfNeeded(this.workspaceRoot);
            const settingsData = await fs.readFile(this.settingsPath, 'utf-8');
            this._settings = JSON.parse(settingsData) as Settings;
            return this._settings;
        } catch (error) {
            if (
                error instanceof Error &&
                'code' in error &&
                error.code === 'ENOENT'
            ) {
                // File doesn't exist, return default settings
                this._settings = createDefaultSettings();
                return this._settings;
            }
            throw new Error(
                `Failed to read settings: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * Fetches the latest allowed tools from storage.
     *
     * @returns Promise resolving to array of allowed tools
     */
    async fetchAllowedTools(): Promise<string[]> {
        await this.fetchSettings();
        return this.allowedTools;
    }

    /**
     * Fetches the latest denied tools from storage.
     *
     * @returns Promise resolving to array of denied tools
     */
    async fetchDeniedTools(): Promise<string[]> {
        await this.fetchSettings();
        return this.deniedTools;
    }

    /**
     * Checks if a tool is in the allowed list.
     *
     * @param tool - Name of the tool to check
     * @returns Promise resolving to true if tool is allowed
     */
    async isToolAllowed(tool: string): Promise<boolean> {
        await this.fetchSettings();
        return this.allowedTools.includes(tool);
    }

    /**
     * Checks if a tool is in the denied list.
     *
     * @param tool - Name of the tool to check
     * @returns Promise resolving to true if tool is denied
     */
    async isToolDenied(tool: string): Promise<boolean> {
        await this.fetchSettings();
        return this.deniedTools.includes(tool);
    }

    /**
     * Writes settings to storage.
     *
     * @param settings - Settings object to persist
     */
    async writeSettings(settings: Settings): Promise<void> {
        await this.writeToFile(settings);
        await this.fetchSettings(); // Refresh cache
    }

    /**
     * Adds a tool to the allowed list.
     *
     * @param tool - Name of the tool to allow
     */
    async addAllowedTool(tool: string): Promise<void> {
        const currentSettings = this._settings;
        if (!currentSettings.permissions.allow.includes(tool)) {
            currentSettings.permissions.allow.push(tool);
            await this.writeSettings(currentSettings);
        }
    }

    /**
     * Adds a tool to the denied list.
     *
     * @param tool - Name of the tool to deny
     */
    async addDeniedTool(tool: string): Promise<void> {
        const currentSettings = this._settings;
        if (!currentSettings.permissions.deny.includes(tool)) {
            currentSettings.permissions.deny.push(tool);
            await this.writeSettings(currentSettings);
        }
    }

    /**
     * Removes a tool from the allowed list.
     *
     * @param tool - Name of the tool to remove from allowed list
     */
    async removeAllowedTool(tool: string): Promise<void> {
        const currentSettings = this._settings;
        const index = currentSettings.permissions.allow.indexOf(tool);
        if (index > -1) {
            currentSettings.permissions.allow.splice(index, 1);
            await this.writeSettings(currentSettings);
        }
    }

    /**
     * Removes a tool from the denied list.
     *
     * @param tool - Name of the tool to remove from denied list
     */
    async removeDeniedTool(tool: string): Promise<void> {
        const currentSettings = this._settings;
        const index = currentSettings.permissions.deny.indexOf(tool);
        if (index > -1) {
            currentSettings.permissions.deny.splice(index, 1);
            await this.writeSettings(currentSettings);
        }
    }

    /**
     * Writes settings data to the settings file.
     *
     * @param settings - Settings to write
     */
    private async writeToFile(settings: Settings): Promise<void> {
        try {
            await createFlowcodeDirectoryIfNeeded(this.workspaceRoot);
            const settingsData = JSON.stringify(settings, null, 2);
            await fs.writeFile(this.settingsPath, settingsData, 'utf-8');
        } catch (error) {
            throw new Error(
                `Failed to write settings: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }
}
