/**
 * Router interface for TUI ViewModel
 * Handles navigation and application lifecycle
 */
export interface TUIRouter {
  /**
   * Navigate to Console mode
   */
  navigateToConsole(): void;
  
  /**
   * Exit the application
   */
  exit(): void;
}