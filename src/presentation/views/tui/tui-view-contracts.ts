import { Observable } from 'rxjs';
import { ConsoleMessage } from '../../model/message.js';
import { Option } from '../../model/option.js';

/**
 * Suggestion for command completion
 */
export interface Suggestion {
  text: string;         // The full command text
  description: string;  // Description of what the command does
  highlight: boolean;   // Whether this suggestion is currently selected
}

/**
 * Token usage information for display
 */
export interface TokenUsage {
  used: number;
  limit: number;
  cost?: number;
}

/**
 * Worker/Taskmaster information for display
 */
export interface WorkerInfo {
  name: string;
  model: string;
  provider: string;
  status: 'idle' | 'thinking' | 'working' | 'streaming';
}

/**
 * TUI View State - all state needed by TUI to render
 * Similar to ConsoleViewState but with additional TUI-specific data
 */
export interface TUIViewState {
  // Stream of new messages to display in chat area
  messages$: Observable<ConsoleMessage>;
  
  // Stream of token usage updates for top-right display
  tokenUsage$: Observable<TokenUsage>;
  
  // Stream of worker info updates for bottom-right display
  workerInfo$: Observable<WorkerInfo>;
  
  // Stream of loading state for animation
  isLoading$: Observable<boolean>;
  
  // Stream of input text to display (for history navigation)
  inputText$: Observable<string>;
  
  // Stream of suggestions for command completion
  suggestions$: Observable<Suggestion[]>;
  
  // Stream of options to display as buttons for user choice
  options$: Observable<Option | null>;
}

/**
 * TUI View Listener - methods called by TUI when events occur
 * Each method represents a view event that delegates to viewmodel
 */
export interface TUIViewListener {
  /**
   * Called when user wants to exit the TUI
   */
  onExit(): void;
  
  /**
   * Called when user switches back to console mode
   */
  onSwitchToConsole?(): void;
  
  /**
   * Called when user presses up arrow - viewmodel handles all logic
   */
  onUpArrow(): void;
  
  /**
   * Called when user presses down arrow - viewmodel handles all logic
   */
  onDownArrow(): void;
  
  /**
   * Called when user presses left arrow - viewmodel handles all logic
   */
  onLeftArrow(): void;
  
  /**
   * Called when user presses right arrow - viewmodel handles all logic
   */
  onRightArrow(): void;
  
  /**
   * Called when user presses Tab key - viewmodel handles all logic
   */
  onTab(): void;
  
  /**
   * Called when user presses Enter key - viewmodel handles all logic
   */
  onEnter(currentInput: string): void;
  
  /**
   * Called when user types text - viewmodel handles all logic
   */
  onInputChange(text: string): void;
}