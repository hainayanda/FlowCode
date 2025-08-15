
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

