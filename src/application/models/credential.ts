export interface Credentials {
    [provider: string]: Credential;
}

export interface Credential {
    apiKey: string;
    lastUsed: string;
}

export interface ProviderCredential extends Credential {
    provider: string;
}
