import { Observable } from 'rxjs';
import { Result } from '../shared/result';
import { DomainMessage, DomainOption } from '../../presentation/view-models/console/console-use-case.js';

export interface InitializationOptions {
  taskmasterModel: string;
  taskmasterApiKey?: string;
  workers: WorkerConfig[];
  summarizer?: {
    provider: string;
    model: string;
  };
  embedding?: {
    provider: string;
    model: string;
  };
  generateMarkdownFiles: boolean;
}

export interface WorkerConfig {
  name: string;
  model: string;
  description: string;
  apiKey?: string;
}

export interface InitializationStep {
  name: string;
  description: string;
  completed: boolean;
}

export enum InitializationState {
  NotStarted = 'not-started',
  InProgress = 'in-progress',
  Completed = 'completed',
  Failed = 'failed'
}

export interface Initializer {
  /**
   * Get current initialization state
   */
  getState(): InitializationState;

  /**
   * Observable stream of initialization messages for presentation layer
   */
  messages$: Observable<DomainMessage>;

  /**
   * Observable stream of initialization options for presentation layer
   */
  options$: Observable<DomainOption>;

  /**
   * Observable that emits when initialization is completed or failed
   */
  completion$: Observable<{ state: InitializationState; error?: string }>;

  /**
   * Start initialization process
   */
  start(): Result<void, string>;

  /**
   * Process user response (from text input or option selection)
   */
  processResponse(response: string): Result<void, string>;

  /**
   * Process user option selection
   */
  processOptionSelection(optionIndex: number): Result<void, string>;

  /**
   * Create .flowcode directory structure in current directory
   */
  createProjectStructure(): Promise<Result<void, string>>;

  /**
   * Generate markdown files using taskmaster analysis
   */
  generateMarkdownFiles(options: InitializationOptions): Promise<Result<void, string>>;

  /**
   * Get current initialization progress
   */
  getInitializationSteps(): InitializationStep[];

  /**
   * Validate if current directory is suitable for FlowCode initialization
   */
  validateCurrentDirectory(): Result<void, string>;

  /**
   * Check if current directory is already initialized
   */
  isCurrentDirectoryInitialized(): boolean;

  /**
   * Reset initialization state and clear all streams
   */
  reset(): void;
}