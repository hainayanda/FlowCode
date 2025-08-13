/**
 * Router interface for Console ViewModel
 * Handles navigation and application lifecycle
 */
export interface ConsoleRouter {
  /**
   * Navigate to TUI mode
   */
  navigateToTUI(): void;
  
  /**
   * Exit the application
   */
  exit(): void;
}