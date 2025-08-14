import { Observable } from 'rxjs';
import { ConsoleUseCase } from '../console/console-use-case.js';
import { DomainTokenUsage, DomainWorkerInfo } from '../../model/use-case-models.js';

/**
 * Use case interface for TUI ViewModel
 * Extends ConsoleUseCase with TUI-specific functionality
 * Will be implemented by FlowCodeUseCase class
 */
export interface TUIUseCase extends ConsoleUseCase {
  /**
   * Stream of token usage updates (TUI-specific)
   */
  tokenUsage$: Observable<DomainTokenUsage>;
  
  /**
   * Stream of worker information updates (TUI-specific)
   */
  workerInfo$: Observable<DomainWorkerInfo>;
  
  /**
   * Stream of loading state (TUI-specific)
   */
  isLoading$: Observable<boolean>;
}

// Re-export types for convenience
export type { DomainTokenUsage, DomainWorkerInfo };
export type { DomainMessage, DomainOption, CommandDefinition } from '../console/console-use-case.js';
