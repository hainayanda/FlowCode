import { Observable } from 'rxjs';
import { ConsoleMessage } from '../../model/message.js';
import { Option } from '../../model/option.js';

/**
 * Console View State - all state needed by console to render
 * Contains only observables for reactive updates
 */
export interface ConsoleViewState {
  // Stream of new messages to display
  messages$: Observable<ConsoleMessage>;
  // Stream of input text to display (for history navigation)
  inputText$: Observable<string>;
  // Stream of options to display for user choice
  options$: Observable<Option>;
}

/**
 * Console View Listener - methods called by console when events occur
 * Like a delegate pattern in iOS
 */
export interface ConsoleViewListener {
  /**
   * Called when user enters input in console
   */
  onUserInput(input: string): Promise<void>;
  
  /**
   * Called when user presses up arrow (history navigation)
   */
  onUpArrow(): void;
  
  /**
   * Called when user presses down arrow (history navigation)
   */
  onDownArrow(): void;
  
  /**
   * Called when user wants to exit (Ctrl+C)
   */
  onExit(): void;
}