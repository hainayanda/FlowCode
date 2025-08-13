#!/usr/bin/env tsx

/**
 * Simple console test
 * Clean implementation for testing ConsoleView
 */

import { ConsoleView } from '../src/presentation/views/console/console-view.js';
import { ConsoleMessage, Message } from '../src/presentation/model/message.js';
import { Option } from '../src/presentation/model/option.js';
import { Subject, BehaviorSubject } from 'rxjs';

// History management
const inputHistory: string[] = [];
let historyIndex = -1;
const inputTextSubject = new BehaviorSubject('');

// Simple mock state for ConsoleView
const mockState = {
  messages$: new Subject<ConsoleMessage>(),
  inputText$: inputTextSubject.asObservable(),
  options$: new Subject<Option>()
};

// Simple mock listener
const mockListener = {
  onUserInput: async (input: string) => {
    if (input.toLowerCase() === 'quit') {
      process.exit(0);
    }
    
    // Add to history
    if (input !== inputHistory[inputHistory.length - 1]) {
      inputHistory.push(input);
      if (inputHistory.length > 50) {
        inputHistory.shift();
      }
    }
    historyIndex = -1; // Reset history navigation
    
    // Note: Console already shows input naturally via readline, no need to duplicate
    
    // Check for special commands to trigger option demo
    if (input.toLowerCase() === 'option' || input.toLowerCase() === 'choose') {
      setTimeout(() => {
        mockState.options$.next({
          message: "Would you like to proceed with the operation?",
          options: ["yes", "no", "always"],
          selectedIndex: 0
        });
      }, 500);
      return;
    }
    
    // Echo response
    setTimeout(() => {
      mockState.messages$.next(ConsoleMessage.create(`Processing: ${input}`, 'system'));
    }, 500);
  },
  
  onUpArrow: () => {
    if (inputHistory.length === 0) return;
    
    if (historyIndex === -1) {
      historyIndex = inputHistory.length - 1;
    } else if (historyIndex > 0) {
      historyIndex--;
    }
    
    inputTextSubject.next(inputHistory[historyIndex]);
  },
  
  onDownArrow: () => {
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
  
  onExit: () => {
    process.exit(0);
  }
};

console.log('Starting Console Message Types Test...');
console.log('Watch different message types appear in console format.');
console.log('Type messages and press Enter. Use ↑/↓ arrows for history.');
console.log('Type "option" or "choose" to test option selection.');
console.log('Type "quit" to exit.');
console.log('');

// Create and start console view
const console_view = new ConsoleView(mockState, mockListener);
console_view.start();

// Show all message types in specified order
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


// Handle process signals
process.on('SIGINT', () => {
  console.log('\nExiting console test...');
  process.exit(0);
});