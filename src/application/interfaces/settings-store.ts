/**
 * Settings configuration structure
 */
export interface SettingsConfig {
  permissions: {
    allow: string[];
    deny: string[];
  };
  [key: string]: any;
}

/**
 * Settings reader interface for reading configuration
 */
export interface SettingsReader {
  /**
   * Get the full settings configuration
   */
  getSettings(): Promise<SettingsConfig>;

  /**
   * Get allowed permissions list
   */
  getAllowedPermissions(): Promise<string[]>;

  /**
   * Get denied permissions list
   */
  getDeniedPermissions(): Promise<string[]>;

  /**
   * Check if a specific permission pattern is allowed
   * Pattern format: {toolbox_id}.{tool_name}({param_filters})
   * Example: "file_tools.append_to_file(*)" or "bash_tools.execute_command(command:npm run build)"
   */
  isPermissionAllowed(permissionPattern: string): Promise<boolean>;

  /**
   * Get settings file path
   */
  getSettingsPath(): string;

  /**
   * Check if settings file exists
   */
  settingsExists(): Promise<boolean>;
}

/**
 * Settings writer interface for updating configuration
 */
export interface SettingsWriter {
  /**
   * Write the full settings configuration (replaces entire file)
   */
  writeSettings(settings: SettingsConfig): Promise<boolean>;

  /**
   * Create .flowcode directory if it doesn't exist
   */
  ensureSettingsDirectory(): Promise<boolean>;
}

/**
 * Combined settings store interface
 */
export interface SettingsStore extends SettingsReader, SettingsWriter {
}