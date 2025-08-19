#!/usr/bin/env node

import { intro, outro, text, select, confirm } from '@clack/prompts';
import { cyan, green, red } from 'picocolors';

async function main(): Promise<void> {
  console.clear();
  
  intro(cyan('FlowCode TUI'));
  
  const name = await text({
    message: 'What is your name?',
    placeholder: 'Enter your name',
    validate: (value) => {
      if (!value) return 'Name is required';
    }
  });
  
  if (typeof name === 'string') {
    const action = await select({
      message: `Hello ${name}! What would you like to do?`,
      options: [
        { value: 'start', label: 'Start working' },
        { value: 'settings', label: 'View settings' },
        { value: 'exit', label: 'Exit' }
      ]
    });
    
    if (action === 'exit') {
      const shouldExit = await confirm({
        message: 'Are you sure you want to exit?'
      });
      
      if (shouldExit) {
        outro(green('Goodbye! 👋'));
        process.exit(0);
      }
    }
    
    outro(green('Thanks for using FlowCode!'));
  } else {
    outro(red('Operation cancelled'));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(red('An error occurred:'), error);
  process.exit(1);
});