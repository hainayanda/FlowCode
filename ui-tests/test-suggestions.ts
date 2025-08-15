#!/usr/bin/env tsx

/**
 * Simple test to verify suggestions appear when typing /
 */

import { TUIView } from '../src/presentation/views/tui/tui-view.js';
import { ConsoleMessage } from '../src/presentation/model/message.js';
import { BehaviorSubject } from 'rxjs';

// Suggestions management
const suggestionsSubject = new BehaviorSubject<any[]>([]);
const inputTextSubject = new BehaviorSubject('');

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
    ConsoleMessage.create('Type "/" to see suggestions', 'system')
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
  options$: new BehaviorSubject(null),
};

let tui: TUIView;
let currentSuggestionIndex = -1;

// Simple mock listener
const mockListener = {
  onExit: () => {
    process.exit(0);
  },
  
  onInputChange: (text: string) => {
    console.log('Input changed:', text);
    inputTextSubject.next(text);
    
    // Filter commands based on input
    if (text.startsWith('/')) {
      const filtered = availableCommands.filter(cmd => 
        cmd.text.toLowerCase().startsWith(text.toLowerCase())
      );
      
      console.log('Filtered commands:', filtered.length);
      
      if (filtered.length > 0) {
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
  
  onUpArrow: () => {},
  onDownArrow: () => {},
  onLeftArrow: () => {},
  onRightArrow: () => {},
  onTab: () => {},
  onEnter: (currentInput: string) => {
    if (currentInput === 'quit') {
      process.exit(0);
    }
    inputTextSubject.next('');
  },
};

console.log('Starting Suggestions Test...');
console.log('Type "/" to see suggestions');
console.log('Type "quit" or press Ctrl+C to exit');
console.log('');

// Create and start TUI
tui = new TUIView(mockState as any, mockListener);
tui.start();

// Simulate typing "/" after a delay
setTimeout(() => {
  console.log('Simulating typing "/"...');
  mockListener.onInputChange('/');
}, 2000);

// Simulate typing "/con" after another delay
setTimeout(() => {
  console.log('Simulating typing "/con"...');
  mockListener.onInputChange('/con');
}, 4000);

// Handle process signals
process.on('SIGINT', () => {
  if (tui) {
    tui.stop();
  }
  process.exit(0);
});