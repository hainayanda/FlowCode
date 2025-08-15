#!/usr/bin/env tsx

/**
 * Simple TUI test to verify mouse hover fix
 * Clean implementation without complex mocks
 */

import { TUIView } from '../src/presentation/views/tui/tui-view.js';
import { Option } from '../src/presentation/model/option.js';
import { ConsoleMessage } from '../src/presentation/model/message.js';
import { BehaviorSubject } from 'rxjs';

// History management
const inputHistory: string[] = [];
let historyIndex = -1;
const inputTextSubject = new BehaviorSubject('');

// Suggestions management
const suggestionsSubject = new BehaviorSubject<any[]>([]);
let currentSuggestionIndex = -1;

// Sample commands for autocomplete
const availableCommands = [
  { text: '/init', description: 'Initialize a new FlowCode project' },
  { text: '/config', description: 'Configure FlowCode settings' },
  { text: '/workers', description: 'Manage worker configuration' },
  { text: '/routing', description: 'Test routing configuration' },
  { text: '/help', description: 'Show help information' },
  { text: '/quit', description: 'Exit the application' }
];

// Simple mock state
const mockState = {
  messages$: new BehaviorSubject(
    ConsoleMessage.create('Welcome to FlowCode! Test the mouse hover fix, options, and secure mode.', 'system')
  ),
  tokenUsage$: new BehaviorSubject({ used: 0, limit: 1000, cost: 0 }),
  workerInfo$: new BehaviorSubject({
    name: 'taskmaster',
    model: 'claude-3.5-sonnet',
    provider: 'anthropic',
    status: 'idle'
  }),
  isLoading$: new BehaviorSubject(false),
  inputText$: inputTextSubject.asObservable(),
  suggestions$: suggestionsSubject.asObservable(),
  options$: new BehaviorSubject<Option | null>(null),
};

// Create TUI reference for proper cleanup
let tui: TUIView;

// Simple mock listener
const mockListener = {
  onExit: () => {
    process.exit(0);
  },
  
  onSwitchToConsole: () => {
    // Switch to console mode - no console.log needed
  },
  
  onUpArrow: () => {
    const currentSuggestions = suggestionsSubject.getValue();
    
    // If there are suggestions, navigate them
    if (currentSuggestions.length > 0) {
      if (currentSuggestionIndex > 0) {
        currentSuggestionIndex--;
      } else {
        currentSuggestionIndex = currentSuggestions.length - 1; // Wrap to bottom
      }
      
      // Update highlight
      const updated = currentSuggestions.map((s, i) => ({
        ...s,
        highlight: i === currentSuggestionIndex
      }));
      suggestionsSubject.next(updated);
      return;
    }
    
    // Otherwise handle history navigation
    if (inputHistory.length === 0) return;
    
    if (historyIndex === -1) {
      historyIndex = inputHistory.length - 1;
    } else if (historyIndex > 0) {
      historyIndex--;
    }
    
    inputTextSubject.next(inputHistory[historyIndex]);
  },
  
  onDownArrow: () => {
    const currentSuggestions = suggestionsSubject.getValue();
    
    // If there are suggestions, navigate them
    if (currentSuggestions.length > 0) {
      if (currentSuggestionIndex < currentSuggestions.length - 1) {
        currentSuggestionIndex++;
      } else {
        currentSuggestionIndex = 0; // Wrap to top
      }
      
      // Update highlight
      const updated = currentSuggestions.map((s, i) => ({
        ...s,
        highlight: i === currentSuggestionIndex
      }));
      suggestionsSubject.next(updated);
      return;
    }
    
    // Otherwise handle history navigation
    if (inputHistory.length === 0) return;
    
    if (historyIndex === -1) return;
    
    if (historyIndex < inputHistory.length - 1) {
      historyIndex++;
      inputTextSubject.next(inputHistory[historyIndex]);
    } else {
      historyIndex = -1;
      inputTextSubject.next('');
    }
  },
  
  onInputChange: (text: string) => {
    // Update the input text subject
    inputTextSubject.next(text);
    
    // Filter commands based on input
    if (text.startsWith('/')) {
      const filtered = availableCommands.filter(cmd => 
        cmd.text.toLowerCase().startsWith(text.toLowerCase())
      );
      
      if (filtered.length > 0) {
        // Always reset to first suggestion when filtering changes
        currentSuggestionIndex = 0;
        const suggestions = filtered.map((cmd, index) => ({
          ...cmd,
          highlight: index === currentSuggestionIndex
        }));
        suggestionsSubject.next(suggestions);
      } else {
        suggestionsSubject.next([]);
        currentSuggestionIndex = -1;
      }
    } else {
      suggestionsSubject.next([]);
      currentSuggestionIndex = -1;
    }
  },
  
  
  onLeftArrow: () => {
    // Handle left arrow logic - option navigation
    const currentOptions = mockState.options$.value;
    if (currentOptions) {
      // Navigate left in options
      let newIndex = currentOptions.selectedIndex - 1;
      if (newIndex < 0) {
        newIndex = currentOptions.options.length - 1; // Wrap to end
      }
      
      // Update the option with new selectedIndex
      mockState.options$.next({
        ...currentOptions,
        selectedIndex: newIndex
      });
    }
  },
  
  onRightArrow: () => {
    // Handle right arrow logic - option navigation
    const currentOptions = mockState.options$.value;
    if (currentOptions) {
      // Navigate right in options
      let newIndex = currentOptions.selectedIndex + 1;
      if (newIndex >= currentOptions.options.length) {
        newIndex = 0; // Wrap to beginning
      }
      
      // Update the option with new selectedIndex
      mockState.options$.next({
        ...currentOptions,
        selectedIndex: newIndex
      });
    }
  },
  
  onTab: () => {
    // Handle tab key logic - could be for suggestion selection
    const currentSuggestions = suggestionsSubject.getValue();
    if (currentSuggestions.length > 0) {
      const selected = currentSuggestions.find(s => s.highlight) || currentSuggestions[0];
      if (selected) {
        // Auto-complete with selected suggestion
        inputTextSubject.next(selected.text + ' ');
        suggestionsSubject.next([]);
        currentSuggestionIndex = -1;
      }
    }
  },
  
  onEnter: (currentInput: string) => {
    // Handle enter key logic - could be for suggestion selection, option selection, or input submission
    
    // First check if suggestions are showing
    const currentSuggestions = suggestionsSubject.getValue();
    if (currentSuggestions.length > 0) {
      const selected = currentSuggestions.find(s => s.highlight) || currentSuggestions[0];
      if (selected) {
        // Auto-complete with selected suggestion
        inputTextSubject.next(selected.text + ' ');
        suggestionsSubject.next([]);
        currentSuggestionIndex = -1;
        return;
      }
    }
    
    // Then check if options are showing
    const currentOptions = mockState.options$.value;
    if (currentOptions) {
      // Use the selectedIndex from the option state
      const selectedOption = currentOptions.options[currentOptions.selectedIndex];
      mockState.options$.next(null);
      mockState.messages$.next(ConsoleMessage.create(`You selected: ${selectedOption}`, 'system'));
      return;
    }
    
    // Otherwise, handle input submission
    const input = currentInput.trim();
    if (input) {
      inputTextSubject.next(''); // Clear input
      
      // Add to history
      if (input !== inputHistory[inputHistory.length - 1]) {
        inputHistory.push(input);
        if (inputHistory.length > 50) {
          inputHistory.shift();
        }
      }
      historyIndex = -1; // Reset history navigation
      
      // Note: TUI shows input naturally in input box, no need to duplicate as message
      
      // Check for special commands to trigger demos
      if (input.toLowerCase() === 'option' || input.toLowerCase() === 'choose') {
        setTimeout(() => {
          mockState.options$.next({
            message: "How would you like to proceed?",
            options: ["Continue", "Review changes", "Cancel"],
            selectedIndex: 0
          });
        }, 500);
        return;
      }
      
      if (input.toLowerCase() === 'quit') {
        process.exit(0);
      }
      
      // Show loading state
      mockState.isLoading$.next(true);
      
      // Echo response
      setTimeout(() => {
        mockState.isLoading$.next(false);
        mockState.messages$.next(ConsoleMessage.create(`Processing: ${input}`, 'system'));
      }, 1500);
    }
  },

};

console.log('Starting TUI Complete Feature Test...');
console.log('Instructions:');
console.log('• Watch different message types appear');
console.log('• Hover mouse over the input textbox - should NOT show random text');
console.log('• Type "/" to see command suggestions (try /in, /co, /he)');
console.log('• Use ↑/↓ arrows to navigate suggestions, Tab or Enter to select');
console.log('• Type "option" or "choose" to test option dialogs with arrow navigation');
console.log('• Type messages and press Enter. Use ↑/↓ arrows for history when no suggestions');
console.log('• Type "quit" or press Ctrl+C to exit');
console.log('');

// Create and start TUI
tui = new TUIView(mockState as any, mockListener);
tui.start();

// Show all message types in same order as console test
setTimeout(() => {
  mockState.messages$.next(ConsoleMessage.create('System notification - app status update', 'system'));
}, 200);

setTimeout(() => {
  mockState.messages$.next(ConsoleMessage.create('Analyzing your request and breaking it down into tasks', 'worker', { workerId: 'taskmaster' }));
}, 400);

setTimeout(() => {
  mockState.messages$.next(ConsoleMessage.create('Planning the implementation approach and considering dependencies', 'thinking', { workerId: 'taskmaster' }));
}, 600);

setTimeout(() => {
  mockState.messages$.next(ConsoleMessage.create('Implementing the authentication service with JWT tokens', 'worker', { workerId: 'code-worker' }));
}, 800);

setTimeout(() => {
  mockState.messages$.next(ConsoleMessage.create('Considering security best practices and error handling patterns', 'thinking', { workerId: 'code-worker' }));
}, 1000);

setTimeout(() => {
  mockState.messages$.next(ConsoleMessage.create('Failed to connect to database - connection timeout', 'error'));
}, 1200);

setTimeout(() => {
  mockState.messages$.next(ConsoleMessage.create('Updated authentication logic', 'file', {
    filePath: 'src/auth/jwt-service.ts',
    fileOperation: 'edit',
    diffs: [
      { lineNumber: 45, type: 'unchanged', oldContent: '  async validateToken(token: string): Promise<boolean> {' },
      { lineNumber: 46, type: 'unchanged', oldContent: '    try {' },
      { lineNumber: 47, type: 'removed', oldContent: '      jwt.verify(token, this.secret);' },
      { lineNumber: 47, type: 'added', newContent: '      const decoded = jwt.verify(token, this.secret) as JWTPayload;' },
      { lineNumber: 48, type: 'added', newContent: '      ' },
      { lineNumber: 49, type: 'added', newContent: '      // Check token expiration' },
      { lineNumber: 50, type: 'added', newContent: '      if (decoded.exp && decoded.exp < Date.now() / 1000) {' },
      { lineNumber: 51, type: 'added', newContent: '        return false;' },
      { lineNumber: 52, type: 'added', newContent: '      }' },
      { lineNumber: 53, type: 'unchanged', oldContent: '      return true;' },
      { lineNumber: 54, type: 'removed', oldContent: '    } catch {' },
      { lineNumber: 54, type: 'added', newContent: '    } catch (error) {' },
      { lineNumber: 55, type: 'added', newContent: '      console.error("Token validation failed:", error);' },
      { lineNumber: 56, type: 'unchanged', oldContent: '      return false;' }
    ],
    totalLinesAdded: 8,
    totalLinesRemoved: 2
  }));
}, 1400);

setTimeout(() => {
  mockState.messages$.next(ConsoleMessage.create('Removed deprecated API endpoints', 'file', {
    filePath: 'src/api/legacy-endpoints.ts',
    fileOperation: 'delete',
    totalLinesRemoved: 150
  }));
}, 1600);

setTimeout(() => {
  mockState.messages$.next(ConsoleMessage.create('Created new dashboard component', 'file', {
    filePath: 'src/components/Dashboard.tsx',
    fileOperation: 'add',
    totalLinesAdded: 120
  }));
}, 1800);

setTimeout(() => {
  mockState.options$.next({
    message: "How would you like to proceed?",
    options: ["Continue", "Review changes", "Cancel"],
    selectedIndex: 0
  });
}, 2000);

// Show secure mode demo (after option demo)

// Handle process signals
process.on('SIGINT', () => {
  if (tui) {
    tui.stop();
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  if (tui) {
    tui.stop();
  }
  process.exit(0);
});