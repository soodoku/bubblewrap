#!/usr/bin/env node

/**
 * Interactive sandbox wrapper - asks which coding assistant to use
 * Simple, easy to use, with good defaults like Claude Code
 */

import { Command } from 'commander';
import { CommandWrapper } from './command-wrapper.js';
import chalk from 'chalk';
import inquirer from 'inquirer';

const program = new Command();

program
  .name('safe-code')
  .description('🔒 Run any coding assistant safely in a sandbox')
  .version('1.0.0')
  .action(async () => {
    console.log(chalk.cyan('🔒 Safe Coding Assistant Wrapper'));
    console.log(chalk.gray('Sandboxes any AI coding tool with secure defaults\n'));

    // Ask which tool to use
    const { tool } = await inquirer.prompt([
      {
        type: 'list',
        name: 'tool',
        message: 'Which coding assistant do you want to use?',
        choices: [
          { name: '🤖 Aider - AI pair programmer', value: 'aider' },
          { name: '🐶 Code-puppy - Privacy-focused assistant', value: 'code-puppy' },
          { name: '🔧 Custom command - Run any tool', value: 'custom' },
          { name: '📝 Just open a safe shell', value: 'shell' },
        ],
      },
    ]);

    const cwd = process.cwd();

    // Create wrapper with good defaults (like Claude Code)
    const wrapper = new CommandWrapper({
      workingDir: cwd,
      autoApproveRead: true,  // Auto-approve reading (like Claude Code)
      autoApproveWrite: false, // Ask before writing (safe default)
      autoApproveNetwork: false, // Ask before network access
      // Good defaults for allowed domains
      allowedDomains: [
        'github.com',
        '*.githubusercontent.com',
        'npmjs.com',
        'pypi.org',
        'api.openai.com',
        'api.anthropic.com',
      ],
    });

    // Setup event handlers for permission requests
    wrapper.on('permission-required', async (data) => {
      console.log(chalk.yellow(`\n⚠️  Permission Request:`));
      console.log(chalk.gray(`  Type: ${data.type}`));
      console.log(chalk.gray(`  Resource: ${data.resource}`));

      const answer = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'approve',
          message: 'Allow this operation?',
          default: false,
        },
      ]);

      if (answer.approve) {
        console.log(chalk.green('✓ Approved'));
        data.approve();
      } else {
        console.log(chalk.red('✗ Denied'));
        data.deny();
      }
    });

    wrapper.on('network-approval-required', async (data) => {
      console.log(chalk.yellow(`\n⚠️  Network Access Request:`));
      console.log(chalk.gray(`  Domain: ${data.domain}`));

      const answer = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'approve',
          message: 'Allow network access to this domain?',
          default: false,
        },
      ]);

      if (answer.approve) {
        console.log(chalk.green(`✓ Allowed: ${data.domain}`));
        data.approve();
      } else {
        console.log(chalk.red(`✗ Blocked: ${data.domain}`));
        data.deny();
      }
    });

    try {
      console.log(chalk.blue('\n🔒 Initializing sandbox...'));
      await wrapper.initialize();
      console.log(chalk.green('✓ Sandbox ready'));
      console.log(chalk.gray(`Working directory: ${cwd}`));
      console.log(chalk.gray('Read access: ✓ (auto-approved)'));
      console.log(chalk.gray('Write access: ⚠️  (requires approval)'));
      console.log(chalk.gray('Network access: ⚠️  (requires approval)\n'));

      let command: string[];

      switch (tool) {
        case 'aider': {
          const { aiderMessage } = await inquirer.prompt([
            {
              type: 'input',
              name: 'aiderMessage',
              message: 'What do you want Aider to do?',
              default: 'Review and improve the code',
            },
          ]);
          command = ['aider', '--message', aiderMessage];
          break;
        }

        case 'code-puppy': {
          const { puppyPrompt } = await inquirer.prompt([
            {
              type: 'input',
              name: 'puppyPrompt',
              message: 'What do you want code-puppy to do?',
              default: 'Help me write clean code',
            },
          ]);
          command = ['code-puppy', '--prompt', puppyPrompt];
          break;
        }

        case 'custom': {
          const { customCommand } = await inquirer.prompt([
            {
              type: 'input',
              name: 'customCommand',
              message: 'Enter command to run (e.g., "cursor", "copilot"):',
            },
          ]);
          command = customCommand.split(' ');
          break;
        }

        case 'shell':
          command = ['bash'];
          console.log(chalk.yellow('\n💡 Starting sandboxed shell'));
          console.log(chalk.gray('You can run any command safely'));
          console.log(chalk.gray('Type "exit" to quit\n'));
          break;

        default:
          throw new Error('Invalid tool selection');
      }

      console.log(chalk.blue(`⚡ Starting: ${command.join(' ')}\n`));

      const result = await wrapper.execute(command);

      if (result.stdout) {
        console.log(result.stdout);
      }
      if (result.stderr) {
        console.error(chalk.red(result.stderr));
      }

      await wrapper.shutdown();

      if (result.exitCode === 0) {
        console.log(chalk.green('\n✓ Completed successfully'));
      } else {
        console.log(chalk.red(`\n✗ Exited with code ${result.exitCode}`));
      }

      process.exit(result.exitCode);

    } catch (error) {
      console.error(chalk.red(`\n✗ Error: ${(error as Error).message}`));
      await wrapper.shutdown();
      process.exit(1);
    }
  });

program.parse();
