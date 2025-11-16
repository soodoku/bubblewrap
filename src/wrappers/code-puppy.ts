/**
 * Code-puppy specific wrapper
 * Extends the generic CommandWrapper with code-puppy-specific features
 */

import { CommandWrapper, CommandWrapperOptions } from '../command-wrapper.js';
import { CommandResult } from '../types.js';

export interface CodePuppyOptions extends CommandWrapperOptions {
  model?: string;
  apiKey?: string;
  provider?: 'openai' | 'anthropic' | 'google' | 'cerebras';
  agentFile?: string;
  additionalArgs?: string[];
}

export class CodePuppyWrapper extends CommandWrapper {
  private options: CodePuppyOptions;

  constructor(options: CodePuppyOptions) {
    super(options);
    this.options = options;
  }

  /**
   * Run code-puppy with a prompt
   */
  async runPrompt(prompt: string, files: string[] = []): Promise<CommandResult> {
    const args = this.buildCodePuppyArgs();
    args.push('--prompt', prompt);
    args.push(...files);

    const env = this.buildEnv();
    return this.execute(['code-puppy', ...args], { env });
  }

  /**
   * Run code-puppy interactively
   */
  async runInteractive(files: string[] = []): Promise<CommandResult> {
    const args = this.buildCodePuppyArgs();
    args.push(...files);

    const env = this.buildEnv();
    return this.execute(['code-puppy', ...args], { env });
  }

  /**
   * Build code-puppy command line arguments
   */
  private buildCodePuppyArgs(): string[] {
    const args: string[] = [];

    if (this.options.model) {
      args.push('--model', this.options.model);
    }

    if (this.options.provider) {
      args.push('--provider', this.options.provider);
    }

    if (this.options.agentFile) {
      args.push('--agent', this.options.agentFile);
    }

    if (this.options.additionalArgs) {
      args.push(...this.options.additionalArgs);
    }

    return args;
  }

  /**
   * Build environment variables
   */
  private buildEnv(): Record<string, string> {
    const env: Record<string, string> = {};
    Object.entries(process.env).forEach(([key, value]) => {
      if (value !== undefined) env[key] = value;
    });

    if (this.options.apiKey) {
      // Set API key based on provider
      switch (this.options.provider) {
        case 'openai':
          env.OPENAI_API_KEY = this.options.apiKey;
          break;
        case 'anthropic':
          env.ANTHROPIC_API_KEY = this.options.apiKey;
          break;
        case 'google':
          env.GOOGLE_API_KEY = this.options.apiKey;
          break;
        case 'cerebras':
          env.CEREBRAS_API_KEY = this.options.apiKey;
          break;
      }
    }

    return env;
  }
}
