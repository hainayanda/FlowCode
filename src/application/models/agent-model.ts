/**
 * Represents an AI model available through the FlowCode system.
 *
 * Contains identifying information and metadata for models from various
 * AI providers, allowing the system to catalog and select appropriate models.
 */
export interface AgentModel {
    /** The AI provider (e.g., 'openai', 'anthropic', 'google') */
    provider: string;

    /** The specific model identifier as used by the provider */
    model: string;

    /** User-friendly alias for the model used in FlowCode */
    alias: string;

    /** Optional human-readable description of the model's capabilities */
    description?: string;
}
