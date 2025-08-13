import { Subscription } from 'rxjs';
import { createRequire } from 'module';
import { View } from '../View.js';
import { TUIViewState, TUIViewListener } from './tui-view-contracts.js';
import { ConsoleMessage } from '../../model/message.js';
import { Option } from '../../model/option.js';

interface Suggestion {
  text: string;
  description: string;
  highlight: boolean;
}

const require = createRequire(import.meta.url);
const blessed = require('blessed');

// Blessed component interfaces
interface BlessedScreen {
  render(): void;
  destroy(): void;
}

interface BlessedElement {
  show(): void;
  hide(): void;
  setContent(content: string): void;
  focus(): void;
  getValue(): string;
  setValue(value: string): void;
  clearValue(): void;
  key(keys: string[], handler: () => void | boolean): void;
  on(event: string, handler: (...args: unknown[]) => void): void;
  readInput(callback: () => void): void;
}

interface BlessedLog extends BlessedElement {
  log(message: string): void;
}

/**
 * Simple TUI View - clean blessed implementation without complications
 */
export class TUIView implements View {
  private subscriptions: Subscription[] = [];
  private screen: BlessedScreen;
  private messageLog: BlessedLog;
  private inputBox: BlessedElement;
  private statusLine: BlessedElement;
  private workerInfo: BlessedElement;
  private optionBox: BlessedElement;
  private suggestionsBox: BlessedElement;
  private currentOption?: Option;
  private loadingSpinnerIndex: number = 0;
  private loadingInterval: NodeJS.Timeout | null = null;
  private baseWorkerContent: string = '';

  constructor(
    private state: TUIViewState,
    private listener: TUIViewListener
  ) {}

  start(): void {
    this.createScreen();
    this.createLayout();
    this.setupHandlers();
    this.setupSubscriptions();
    this.screen.render();
    // Focus input box after initial render
    setImmediate(() => {
      this.inputBox.focus();
    });
  }

  stop(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions = [];
    if (this.loadingInterval) {
      clearInterval(this.loadingInterval);
      this.loadingInterval = null;
    }
    if (this.screen) {
      this.screen.destroy();
    }
  }

  private createScreen(): void {
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'FlowCode',
      mouse: false,  // Disable blessed's mouse to allow native terminal text selection
      warnings: false
    });

  }

  private createLayout(): void {
    // Message log
    this.messageLog = blessed.log({
      parent: this.screen,
      top: 0,
      left: 0,
      width: '100%',
      height: '100%-3',
      style: { fg: 'white' },
      scrollable: true,
      alwaysScroll: true,
      mouse: false,  // Disable to allow native terminal text selection
      keys: true,
      tags: true
    });

    // Input box
    this.inputBox = blessed.textbox({
      parent: this.screen,
      bottom: 1,
      left: 0,
      width: '100%',
      height: 3,
      border: { type: 'line', fg: 'gray' },
      style: { fg: 'white' },
      inputOnFocus: true
    });

    // Status line - left side
    this.statusLine = blessed.text({
      parent: this.screen,
      bottom: 0,
      left: 0,
      width: '50%',
      height: 1,
      content: 'Press {#FFA500-fg}Enter{/} to send • Ctrl+C to exit',
      style: { fg: 'gray' },
      tags: true
    });

    // Worker and token info combined - bottom right  
    this.workerInfo = blessed.text({
      parent: this.screen,
      bottom: 0,
      right: 0,
      width: 'shrink',
      height: 1,
      content: '⠋ {#FFA500-fg}taskmaster{/} · claude-3.5-sonnet · anthropic • Tokens: 0/1000 ($0.00)',
      style: { fg: 'gray' },
      tags: true
    });

    // Option box - positioned right above the input box
    this.optionBox = blessed.box({
      parent: this.screen,
      bottom: 4, // Just above the input box (which is height 3 + bottom 1)
      left: 0,
      width: '100%',
      height: 'shrink',
      style: { 
        fg: 'white',
        bg: '#333333' // Dark grey background
      },
      padding: { top: 1, bottom: 1, left: 2, right: 2 },
      hidden: true,
      tags: true
    });

    // Suggestions box - positioned right above the input box (same as options)
    this.suggestionsBox = blessed.box({
      parent: this.screen,
      bottom: 4, // Just above the input box
      left: 0,
      width: '100%',
      height: 8, // Fixed height instead of shrink
      border: { type: 'line', fg: 'gray' }, // Add border for visibility
      style: { 
        fg: 'white',
        bg: '#333333' // Dark grey background like TUI test specifies
      },
      padding: { top: 0, bottom: 0, left: 0, right: 0 }, // Remove padding to control it manually
      hidden: true,
      tags: true,
      scrollable: true
    });
  }

  private setupHandlers(): void {
    // Key handlers - let viewmodel handle all logic
    this.inputBox.key(['enter'], () => {
      const currentInput = this.inputBox.getValue();
      this.listener.onEnter(currentInput);
      // Focus after a longer delay to ensure onEnter processing completes
      setTimeout(() => {
        this.inputBox.focus();
      }, 10);
    });

    this.inputBox.key(['tab'], () => {
      this.listener.onTab();
    });

    // Arrow key navigation - let viewmodel handle all logic
    this.inputBox.key(['up'], () => {
      this.listener.onUpArrow();
    });

    this.inputBox.key(['down'], () => {
      this.listener.onDownArrow();
    });

    this.inputBox.key(['left'], () => {
      this.listener.onLeftArrow();
    });

    this.inputBox.key(['right'], () => {
      this.listener.onRightArrow();
    });

    // Use 'keypress' event for input handling instead of readInput
    this.inputBox.on('keypress', (_ch: unknown, key: any) => {
      // Skip special keys (arrows, enter, etc.) but allow regular typing
      if (!key || (!key.ctrl && !key.meta && (!key.name || key.name.length === 1))) {
        // Give blessed time to update the input value
        setImmediate(() => {
          const value = this.inputBox.getValue();
          this.listener.onInputChange(value);
        });
      }
    });
    
    // Also listen for backspace/delete
    this.inputBox.key(['backspace', 'delete'], () => {
      setImmediate(() => {
        const value = this.inputBox.getValue();
        this.listener.onInputChange(value);
      });
    });

    // Handle Ctrl+C on input box specifically
    this.inputBox.key(['C-c'], () => {
      this.listener.onExit();
    });
  }

  private setupSubscriptions(): void {
    // Messages
    this.subscriptions.push(
      this.state.messages$.subscribe(message => {
        this.messageLog.log(this.formatMessage(message));
        this.screen.render();
      })
    );

    // Input text (for history)
    this.subscriptions.push(
      this.state.inputText$.subscribe(text => {
        // Only update if different from current value to avoid cursor jumping
        if (this.inputBox.getValue() !== text) {
          this.inputBox.clearValue();
          this.inputBox.setValue(text);
          this.screen.render();
        }
      })
    );

    // Combined worker and token info
    let currentWorker = { name: 'test-worker', model: 'claude-3.5', provider: 'anthropic', status: 'idle' };
    let currentTokens: { used: number; limit: number; cost?: number } = { used: 0, limit: 1000, cost: 0 };

    this.subscriptions.push(
      this.state.workerInfo$.subscribe(worker => {
        currentWorker = worker;
        this.updateWorkerTokenDisplay(currentWorker, currentTokens);
      })
    );

    this.subscriptions.push(
      this.state.tokenUsage$.subscribe(usage => {
        currentTokens = usage;
        this.updateWorkerTokenDisplay(currentWorker, currentTokens);
      })
    );

    // Loading state
    this.subscriptions.push(
      this.state.isLoading$.subscribe(loading => {
        if (loading) {
          this.statusLine.setContent('Processing... • Ctrl+C to exit');
          this.startLoadingSpinner();
        } else {
          this.statusLine.setContent('Press {#FFA500-fg}Enter{/} to send • Ctrl+C to exit');
          this.stopLoadingSpinner();
        }
        this.screen.render();
      })
    );
    // Suggestions
    this.subscriptions.push(
      this.state.suggestions$.subscribe(suggestions => {
        if (suggestions.length > 0) {
          this.showSuggestions(suggestions);
        } else {
          this.hideSuggestions();
        }
      })
    );

    // Options
    this.subscriptions.push(
      this.state.options$.subscribe(option => {
        this.currentOption = option || undefined;
        if (option) {
          this.showOptions(option);
        } else {
          this.hideOptions();
        }
      })
    );
  }

  private formatMessage(message: ConsoleMessage): string {
    switch (message.type) {
      case 'user':
        return `{green-fg}You{/}\n${message.content}\n`;
      case 'system':
        return `{gray-fg}${message.content}{/}\n`;
      case 'worker':
        const workerId = message.metadata?.workerId || 'assistant';
        const color = workerId === 'taskmaster' ? '#FFA500-fg' : 'blue-fg'; // Orange for taskmaster
        return `{${color}}${workerId}{/}\n${message.content}\n`;
      case 'thinking':
        const thinkingWorkerId = message.metadata?.workerId || 'assistant';
        const thinkingTitleColor = thinkingWorkerId === 'taskmaster' ? '#8B4513-fg' : '#4682B4-fg'; // Very dull orange/blue for title
        return `{${thinkingTitleColor}}${thinkingWorkerId} is thinking{/}\n{#696969-fg}${message.content}{/}\n`;
      case 'error':
        return `{red-fg}error{/}\n{#8B0000-fg}${message.content}{/}\n`;
      case 'file':
        // For file operations, get the full console string and convert ANSI to blessed tags
        const consoleString = message.toConsoleString();
        return `${this.convertAnsiToBlessedTags(consoleString)}\n`;
      default:
        return `${message.content}\n`;
    }
  }

  private convertAnsiToBlessedTags(text: string): string {
    return text
      // Remove timestamps - handles both [HH:MM:SS] and [HH:MM:SS AM/PM] formats
      .replace(/\[\d{1,2}:\d{2}:\d{2}(?:\s*[AP]M)?\]\s*/g, '')
      // Reset codes
      .replace(/\x1b\[0m/g, '{/}')
      // Basic colors
      .replace(/\x1b\[90m/g, '{gray-fg}')    // gray
      .replace(/\x1b\[31m/g, '{red-fg}')     // red  
      .replace(/\x1b\[32m/g, '{green-fg}')   // green
      .replace(/\x1b\[33m/g, '{yellow-fg}')  // yellow
      .replace(/\x1b\[37m/g, '{white-fg}')   // white
      // 256 colors (approximate mappings)
      .replace(/\x1b\[38;5;214m/g, '{yellow-fg}')  // orange -> yellow
      .replace(/\x1b\[38;5;67m/g, '{blue-fg}')     // bluish -> blue
      // Handle diff lines with backgrounds  
      .replace(/(\{green-fg\}\+[^\n]+)/g, '{white-fg}{green-bg}$1{/}')  // Added lines: white text, green background
      .replace(/(\{red-fg\}-[^\n]+)/g, '{white-fg}{#800000-bg}$1{/}')  // Deleted lines: white text, maroon background
      // Remove any remaining ANSI codes
      .replace(/\x1b\[[0-9;]*m/g, '');
  }

  private startLoadingSpinner(): void {
    if (this.loadingInterval) return; // Already running
    
    const spinnerChars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    
    this.loadingInterval = setInterval(() => {
      this.loadingSpinnerIndex = (this.loadingSpinnerIndex + 1) % spinnerChars.length;
      // Keep the content fixed by using the stored base content
      this.workerInfo.setContent(spinnerChars[this.loadingSpinnerIndex] + ' ' + this.baseWorkerContent);
      this.screen.render();
    }, 100);
  }

  private stopLoadingSpinner(): void {
    if (this.loadingInterval) {
      clearInterval(this.loadingInterval);
      this.loadingInterval = null;
      // Update display without spinner
      this.workerInfo.setContent(this.baseWorkerContent);
      this.screen.render();
    }
  }

  private updateWorkerTokenDisplay(worker: { name: string; model: string; provider: string }, tokens: { used: number; limit: number; cost?: number }): void {
    // Use same colors as messages
    const color = worker.name === 'taskmaster' ? '#FFA500-fg' : 'blue-fg'; // Orange for taskmaster, blue for others
    const content = `{${color}}${worker.name}{/} · ${worker.model} · ${worker.provider} • Tokens: ${tokens.used}/${tokens.limit} ($${(tokens.cost || 0).toFixed(2)})`;
    this.baseWorkerContent = content;
    
    if (this.loadingInterval) {
      // Don't update directly, let the spinner handle it
      return;
    }
    
    this.workerInfo.setContent(content);
    this.screen.render();
  }
  
  private updateOptionDisplay(): void {
    if (!this.currentOption) return;
    
    let content = `${this.currentOption.message}\n\n`;
    
    // Create button-like display using selectedIndex from option object
    this.currentOption.options.forEach((opt, index) => {
      if (index === this.currentOption!.selectedIndex) {
        content += `{inverse}[ ${opt} ]{/}  `;
      } else {
        content += `[ ${opt} ]  `;
      }
    });
    
    content += '\n\nUse ← → arrows to navigate, Enter to select';
    
    this.optionBox.setContent(content);
    this.screen.render();
  }

  private showSuggestions(suggestions: Suggestion[]): void {
    let content = '';
    suggestions.forEach((suggestion) => {
      if (suggestion.highlight) {
        // Use bold yellow for selected item, with consistent spacing
        content += ` {bold}{yellow-fg}▶{/} {bold}{yellow-fg}${suggestion.text}{/} - ${suggestion.description}\n`;
      } else {
        // Gray text for unselected items
        content += `   {gray-fg}${suggestion.text} - ${suggestion.description}{/}\n`;
      }
    });
    
    // Remove only trailing newline, not leading spaces
    content = content.trimEnd();
    
    this.suggestionsBox.setContent(content);
    this.suggestionsBox.show();
    // Make sure input box stays focused
    this.inputBox.focus();
    this.screen.render();
  }

  private hideSuggestions(): void {
    this.suggestionsBox.hide();
    this.screen.render();
  }

  private showOptions(option: Option): void {
    this.currentOption = option;
    this.optionBox.show();
    this.updateOptionDisplay();
    this.screen.render();
  }

  private hideOptions(): void {
    this.currentOption = undefined;
    this.optionBox.hide();
    this.screen.render();
  }
}