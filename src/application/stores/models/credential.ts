/**
 * Collection of credentials indexed by provider name.
 *
 * Maps provider names to their corresponding credential objects,
 * allowing for multiple API providers to be configured simultaneously.
 */
export interface Credentials {
    [provider: string]: Credential;
}

/**
 * Single credential configuration for an API provider.
 *
 * Contains the authentication information and usage tracking
 * for accessing a specific service provider.
 */
export interface Credential {
    /** API key for authenticating with the provider */
    apiKey: string;
    /** Timestamp of when this credential was last used */
    lastUsed: string;
}

/**
 * Credential with explicit provider identification.
 *
 * Extends the base Credential interface to include provider name,
 * useful when working with credentials outside their keyed context.
 */
export interface ProviderCredential extends Credential {
    /** Name of the provider this credential belongs to */
    provider: string;
}
