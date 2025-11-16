#!/usr/bin/env node

/**
 * CLI for running Aider in a sandboxed environment
 */

import { Command } from 'commander';
import { AiderWrapper } from './aider-wrapper.js';
import chalk from 'chalk';
import inquirer from 'inquirer';

const program = new Command();

program
  .name('aider-sandbox')
  .description('Run Aider AI coding agent in a secure sandbox')
  .version('1.0.0');

program
  .command('run')
  .description('Run Aider with a message in sandbox mode')
  .argument('<message>', 'Message to send to Aider')
  .option('-f, --files <files...>', 'Files to work with')
  .option('-m, --model <model>', 'AI model to use')
  .option('--auto-commit', 'Enable auto-commits')
  .option('--yes', 'Auto-approve all prompts')
  .action(async (message, options) => {
    const cwd = process.cwd();
    const aider = new AiderWrapper(cwd, {
      model: options.model,
      autoCommit: options.autoCommit,
      yesAlways: options.yes,
    });

    // Set up event handlers
    setupEventHandlers(aider);

    try {
      console.log(chalk.blue('🔒 Initializing sandbox...'));
      await aider.initialize();

      console.log(chalk.green('✓ Sandbox ready'));
      console.log(chalk.blue(`📝 Running: ${message}`));

      const result = await aider.runMessage(message, options.files || []);

      console.log(chalk.gray('\n--- Output ---'));
      if (result.stdout) {
        console.log(result.stdout);
      }
      if (result.stderr) {
        console.error(chalk.red(result.stderr));
      }

      if (result.exitCode !== 0) {
        console.log(chalk.red(`\n✗ Failed with exit code ${result.exitCode}`));
        process.exit(result.exitCode);
      }

      console.log(chalk.green('\n✓ Complete'));
      await aider.shutdown();
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
      await aider.shutdown();
      process.exit(1);
    }
  });

program
  .command('interactive')
  .description('Start Aider in interactive mode')
  .option('-f, --files <files...>', 'Files to work with')
  .option('-m, --model <model>', 'AI model to use')
  .action(async (options) => {
    const cwd = process.cwd();
    const aider = new AiderWrapper(cwd, {
      model: options.model,
    });

    setupEventHandlers(aider);

    try {
      console.log(chalk.blue('🔒 Initializing sandbox...'));
      await aider.initialize();

      console.log(chalk.green('✓ Sandbox ready'));
      console.log(chalk.yellow('⚠️  Starting interactive mode...\n'));

      await aider.startInteractive(options.files || []);
      await aider.shutdown();
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
      await aider.shutdown();
      process.exit(1);
    }
  });

program
  .command('exec')
  .description('Execute a command in the sandbox')
  .argument('<command>', 'Command to execute')
  .argument('[args...]', 'Command arguments')
  .action(async (command, args) => {
    const cwd = process.cwd();
    const aider = new AiderWrapper(cwd);

    setupEventHandlers(aider);

    try {
      console.log(chalk.blue('🔒 Initializing sandbox...'));
      await aider.initialize();

      console.log(chalk.green('✓ Sandbox ready'));
      console.log(chalk.blue(`⚡ Executing: ${command} ${args.join(' ')}`));

      const result = await aider.executeCommand([command, ...args]);

      if (result.stdout) {
        console.log(result.stdout);
      }
      if (result.stderr) {
        console.error(chalk.red(result.stderr));
      }

      await aider.shutdown();
      process.exit(result.exitCode);
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
      await aider.shutdown();
      process.exit(1);
    }
  });

function setupEventHandlers(aider: AiderWrapper): void {
  // Handle permission requests
  aider.on('permission-required', async (data) => {
    const answer = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'approve',
        message: `Allow ${data.type} for "${data.resource}"?${
          data.details ? `\n  ${data.details}` : ''
        }`,
        default: false,
      },
    ]);

    if (answer.approve) {
      data.approve();
    } else {
      data.deny();
    }
  });

  // Handle network approval requests
  aider.on('network-approval-required', async (data) => {
    const answer = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'approve',
        message: chalk.yellow(
          `⚠️  Allow network access to "${data.domain}"?`
        ),
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

  // Handle initialization
  aider.on('initialized', () => {
    // Optionally enable auto-approve for certain actions
    // aider.getSandbox().setAutoApprove([PermissionType.FILESYSTEM_READ]);
  });
}

program.parse();
