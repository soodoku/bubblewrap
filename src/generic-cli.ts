#!/usr/bin/env node

/**
 * Generic CLI for running ANY command in a sandbox
 * Inspired by Anthropic's sandbox-runtime
 */

import { Command } from 'commander';
import { CommandWrapper } from './command-wrapper.js';
import { AiderWrapper } from './wrappers/aider.js';
import { CodePuppyWrapper } from './wrappers/code-puppy.js';
import { GenericToolWrapper } from './wrappers/generic.js';
import chalk from 'chalk';
import inquirer from 'inquirer';

const program = new Command();

program
  .name('sandbox')
  .description('Run any coding assistant or command in a secure sandbox')
  .version('1.0.0');

// Generic command execution (like Anthropic's srt)
program
  .command('exec <command> [args...]')
  .description('Execute any command in the sandbox')
  .option('--auto-approve-read', 'Auto-approve file read operations')
  .option('--auto-approve-write', 'Auto-approve file write operations')
  .option('--cwd <directory>', 'Working directory', process.cwd())
  .action(async (command, args, options) => {
    const wrapper = new CommandWrapper({
      workingDir: options.cwd,
      autoApproveRead: options.autoApproveRead,
      autoApproveWrite: options.autoApproveWrite,
    });

    setupEventHandlers(wrapper);

    try {
      console.log(chalk.blue('🔒 Initializing sandbox...'));
      await wrapper.initialize();

      console.log(chalk.green('✓ Sandbox ready'));
      console.log(chalk.blue(`⚡ Executing: ${command} ${args.join(' ')}`));

      const result = await wrapper.execute([command, ...args]);

      if (result.stdout) {
        console.log(result.stdout);
      }
      if (result.stderr) {
        console.error(chalk.red(result.stderr));
      }

      await wrapper.shutdown();
      process.exit(result.exitCode);
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
      await wrapper.shutdown();
      process.exit(1);
    }
  });

// Aider-specific commands
const aiderCmd = program.command('aider').description('Run Aider in sandbox');

aiderCmd
  .command('run <message>')
  .description('Run Aider with a message')
  .option('-f, --files <files...>', 'Files to work with')
  .option('-m, --model <model>', 'AI model to use')
  .option('--auto-commit', 'Enable auto-commits')
  .action(async (message, options) => {
    const aider = new AiderWrapper({
      workingDir: process.cwd(),
      model: options.model,
      autoCommit: options.autoCommit,
      autoApproveRead: true,
    });

    setupEventHandlers(aider);

    try {
      await aider.initialize();
      const result = await aider.runMessage(message, options.files || []);
      console.log(result.stdout);
      await aider.shutdown();
      process.exit(result.exitCode);
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
      process.exit(1);
    }
  });

// Code-puppy specific commands
const codePuppyCmd = program
  .command('code-puppy')
  .description('Run code-puppy in sandbox');

codePuppyCmd
  .command('run <prompt>')
  .description('Run code-puppy with a prompt')
  .option('-f, --files <files...>', 'Files to work with')
  .option('-m, --model <model>', 'AI model to use')
  .option('-p, --provider <provider>', 'AI provider (openai, anthropic, google)')
  .action(async (prompt, options) => {
    const codePuppy = new CodePuppyWrapper({
      workingDir: process.cwd(),
      model: options.model,
      provider: options.provider,
      autoApproveRead: true,
    });

    setupEventHandlers(codePuppy);

    try {
      await codePuppy.initialize();
      const result = await codePuppy.runPrompt(prompt, options.files || []);
      console.log(result.stdout);
      await codePuppy.shutdown();
      process.exit(result.exitCode);
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
      process.exit(1);
    }
  });

// Convenience commands for common tools
program
  .command('npm <script>')
  .description('Run npm script in sandbox')
  .option('--args <args...>', 'Additional arguments')
  .action(async (script, options) => {
    const wrapper = new GenericToolWrapper({
      workingDir: process.cwd(),
      autoApproveRead: true,
    });

    setupEventHandlers(wrapper);

    try {
      await wrapper.initialize();
      const result = await wrapper.runNpm(script, options.args || []);
      console.log(result.stdout);
      await wrapper.shutdown();
      process.exit(result.exitCode);
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
      process.exit(1);
    }
  });

program
  .command('git <args...>')
  .description('Run git command in sandbox')
  .action(async (args) => {
    const wrapper = new GenericToolWrapper({
      workingDir: process.cwd(),
      autoApproveRead: true,
    });

    setupEventHandlers(wrapper);

    try {
      await wrapper.initialize();
      const result = await wrapper.runGit(args);
      console.log(result.stdout);
      await wrapper.shutdown();
      process.exit(result.exitCode);
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
      process.exit(1);
    }
  });

function setupEventHandlers(wrapper: CommandWrapper): void {
  wrapper.on('permission-required', async (data) => {
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

  wrapper.on('network-approval-required', async (data) => {
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
}

program.parse();
