/**
 * Option interface for user choice dialogs (yes/no/always, etc.)
 */
export interface Option {
  message: string;
  options: string[];
  selectedIndex: number;
}