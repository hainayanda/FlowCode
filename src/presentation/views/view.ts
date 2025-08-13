/**
 * Base interface for all views in the MVVM architecture
 * Views are responsible for presentation only - all logic is in the ViewModel
 */
export interface View {
  /**
   * Start the view - setup subscriptions and initialize UI
   */
  start(): void;

  /**
   * Stop the view - cleanup subscriptions and resources
   */
  stop(): void;
}