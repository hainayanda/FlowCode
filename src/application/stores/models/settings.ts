/**
 * Application settings configuration.
 *
 * Defines the structure for user preferences and security settings
 * that control application behavior and access permissions.
 */
export interface Settings {
    /** Permission configuration for controlling access to features and resources */
    permissions: {
        /** Array of allowed permissions or patterns */
        allow: string[];
        /** Array of denied permissions or patterns */
        deny: string[];
    };
}
