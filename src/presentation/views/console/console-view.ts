import { Subscription } from 'rxjs';
import * as readline from 'readline';
import { View } from '../view.js';
import { ConsoleViewState, ConsoleViewListener } from './console-contracts.js';
import { Option } from '../../model/option.js';

/**
 * Simple Console View - no fancy features, just basic input/output
 */
export class ConsoleView implements View {
  private subscriptions: Subscription[] = [];
  private rl?: readline.Interface;

  constructor(
    private state: ConsoleViewState,
    private listener: ConsoleViewListener
  ) {}

  start(): void {
    this.setupSubscriptions();
    this.setupInput();
    this.showPrompt();
  }

  stop(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions = [];
    this.rl?.close();
  }

  private setupSubscriptions(): void {
    // Just show messages as they come in
    this.subscriptions.push(
      this.state.messages$.subscribe(message => {
        console.log(message.toConsoleString());
        this.showPrompt();
      })
    );

    // Handle input text updates for history
    this.subscriptions.push(
      this.state.inputText$.subscribe(inputText => {
        if (this.rl) {
          // Simple way to update input text
          this.rl.write(null, { ctrl: true, name: 'u' }); // Clear line
          this.rl.write(inputText);
        }
      })
    );

    // Handle options
    this.subscriptions.push(
      this.state.options$.subscribe(option => {
        if (option) {
          this.showOptions(option);
        }
      })
    );
  }

  private setupInput(): void {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '> '
    });

    // Handle line input
    this.rl.on('line', async (input: string) => {
      const trimmed = input.trim();
      
      if (!trimmed) {
        this.showPrompt();
        return;
      }

      // Regular input
      await this.listener.onUserInput(trimmed);
      this.showPrompt();
    });

    // Handle arrow keys for history
    process.stdin.on('keypress', (_ch: string, key: any) => {
      if (key && key.name === 'up') {
        this.listener.onUpArrow();
      } else if (key && key.name === 'down') {
        this.listener.onDownArrow();
      }
    });

    // Handle Ctrl+C
    this.rl.on('SIGINT', () => {
      this.listener.onExit();
    });
  }

  private showPrompt(): void {
    if (this.rl && !this.rl.close) {
      this.rl.prompt();
    }
  }

  private showOptions(option: Option): void {
    console.log(`\n${option.message}`);
    option.options.forEach((opt, index) => {
      console.log(`${index + 1}. ${opt}`);
    });
    console.log('');
    this.showPrompt();
  }
}