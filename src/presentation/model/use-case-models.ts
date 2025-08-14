/**
 * Shared domain types that will be used by both Console and TUI use cases
 * These will be re-exported by both interfaces
 */

/**
 * Token usage information from business logic
 */
export interface DomainTokenUsage {
  used: number;
  limit: number;
  cost?: number;
}

/**
 * Worker information from business logic
 */
export interface DomainWorkerInfo {
  name: string;
  model: string;
  provider: string;
  status: 'idle' | 'thinking' | 'working' | 'streaming';
}