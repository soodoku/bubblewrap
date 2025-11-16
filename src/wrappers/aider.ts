/**
 * Aider-specific wrapper
 * Extends the generic CommandWrapper with Aider-specific features
 */

import { CommandWrapper, CommandWrapperOptions } from '../command-wrapper.js';
import { CommandResult } from '../types.js';

export interface AiderOptions extends CommandWrapperOptions {
  model?: string;
  apiKey?: string;
  autoCommit?: boolean;
  yesAlways?: boolean;
  additionalArgs?: string[];
}

export class AiderWrapper extends CommandWrapper {
  private aiderOptions: AiderOptions;

  constructor(options: AiderOptions) {
    super(options);
    this.aiderOptions = options;
  }

  /**
   * Run Aider with a specific message
   */
  async runMessage(message: string, files: string[] = []): Promise<CommandResult> {
    const args = this.buildAiderArgs(files);
    args.push('--message', message);

    const env: Record<string, string> = {};
    Object.entries(process.env).forEach(([key, value]) => {
      if (value !== undefined) env[key] = value;
    });

    if (this.aiderOptions.apiKey) {
      env.OPENAI_API_KEY = this.aiderOptions.apiKey;
    }

    return this.execute(['aider', ...args], { env });
  }

  /**
   * Run Aider interactively (bypasses some sandbox protections)
   */
  async runInteractive(files: string[] = []): Promise<CommandResult> {
    console.warn(
      'Interactive mode bypasses some sandbox protections. Use with caution.'
    );
    const args = this.buildAiderArgs(files);
    return this.execute(['aider', ...args]);
  }

  /**
   * Build Aider command line arguments
   */
  private buildAiderArgs(files: string[]): string[] {
    const args: string[] = [];

    if (this.aiderOptions.model) {
      args.push('--model', this.aiderOptions.model);
    }

    if (this.aiderOptions.autoCommit) {
      args.push('--auto-commits');
    }

    if (this.aiderOptions.yesAlways) {
      args.push('--yes-always');
    }

    if (this.aiderOptions.additionalArgs) {
      args.push(...this.aiderOptions.additionalArgs);
    }

    args.push(...files);

    return args;
  }
}
