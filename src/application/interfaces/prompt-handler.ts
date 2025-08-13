import { Observable } from 'rxjs';
import { DomainTokenUsage, DomainWorkerInfo } from '../../presentation/view-models/shared-use-case.js';
import { DomainOption } from '../../presentation/view-models/console/console-use-case.js';

/**
 * Pending user message in processing queue
 */
export interface PendingUserMessage {
  id: string;
  content: string;
  timestamp: Date;
  priority: number;
}

/**
 * Prompt handler interface for AI processing with queue management
 * Handles multiple concurrent requests and manages context internally
 */
export interface PromptHandler {
  /**
   * Process user input - adds to queue and returns promise for this specific request
   * Promise resolves when THIS request completes (not when queue is empty)
   * Writes results directly to injected MessageStore
   */
  processUserInput(input: string): Promise<void>;
  
  /**
   * Cancel all pending requests and clear queue
   * All pending promises resolve empty (no rejection)
   */
  cancelAllRequests(): Promise<void>;
  
  /**
   * Respond to user choice - PromptHandler stores the choice and continues processing
   */
  respondToChoice(selectedIndex: number): Promise<void>;
  
  /**
   * Stream of pending user messages (ordered by timestamp)
   */
  pendingUserMessages$: Observable<PendingUserMessage[]>;
  
  /**
   * Stream of loading state (true when any request is processing)
   */
  isProcessing: Observable<boolean>;
  
  /**
   * Stream of current active worker information
   */
  currentWorker$: Observable<DomainWorkerInfo>;
  
  /**
   * Stream of token usage updates
   */
  tokenUsage$: Observable<DomainTokenUsage>;
  
  /**
   * Stream of user choice options (published when PromptHandler needs permission)
   */
  options$: Observable<DomainOption>;
  
  /**
   * Get current queue status
   */
  getQueueStatus(): {
    pendingCount: number;
    isProcessing: boolean;
    currentRequestId?: string;
  };
}