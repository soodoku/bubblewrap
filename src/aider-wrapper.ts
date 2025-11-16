/**
 * Wrapper for running Aider in a sandboxed environment
 */

import { SandboxManager } from './sandbox-manager.js';
import { CommandResult } from './types.js';
import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

export interface AiderOptions {
  model?: string;
  apiKey?: string;
  autoCommit?: boolean;
  yesAlways?: boolean;
  additionalArgs?: string[];
}

export class AiderWrapper extends EventEmitter {
  private sandbox: SandboxManager;
  private aiderProcess: ChildProcess | null = null;

  constructor(
    private workingDir: string,
    private options: AiderOptions = {}
  ) {
    super();
    this.sandbox = new SandboxManager(workingDir);

    // Forward sandbox events
    this.sandbox.on('permission-required', (data) => {
      this.emit('permission-required', data);
    });

    this.sandbox.on('network-approval-required', (data) => {
      this.emit('network-approval-required', data);
    });
  }

  /**
   * Initialize the sandboxed Aider environment
   */
  async initialize(): Promise<void> {
    await this.sandbox.initialize();

    // Check if aider is installed
    const result = await this.sandbox.executeCommand(['which', 'aider']);
    if (result.exitCode !== 0) {
      throw new Error(
        'Aider is not installed. Install it with: pip install aider-chat'
      );
    }

    this.emit('initialized');
  }

  /**
   * Run Aider with a specific message
   */
  async runMessage(message: string, files: string[] = []): Promise<CommandResult> {
    const args = this.buildAiderArgs(files);
    args.push('--message', message);

    return this.sandbox.executeCommand(['aider', ...args], {
      cwd: this.workingDir,
    });
  }

  /**
   * Start Aider in interactive mode (non-sandboxed for now)
   */
  async startInteractive(files: string[] = []): Promise<void> {
    const args = this.buildAiderArgs(files);

    // For interactive mode, we need to pass through stdio
    // This is more complex with sandboxing, so we'll use direct spawn
    // but still enforce permissions through pre-flight checks

    console.warn(
      'Interactive mode bypasses some sandbox protections. Use with caution.'
    );

    this.aiderProcess = spawn('aider', args, {
      cwd: this.workingDir,
      stdio: 'inherit',
      env: {
        ...process.env,
        ...(this.options.apiKey && { OPENAI_API_KEY: this.options.apiKey }),
      },
    });

    return new Promise((resolve, reject) => {
      this.aiderProcess!.on('close', (code: number) => {
        this.aiderProcess = null;
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Aider exited with code ${code}`));
        }
      });

      this.aiderProcess!.on('error', reject);
    });
  }

  /**
   * Execute a shell command through Aider's sandboxed environment
   */
  async executeCommand(command: string[]): Promise<CommandResult> {
    return this.sandbox.executeCommand(command, {
      cwd: this.workingDir,
    });
  }

  /**
   * Stop the Aider process if running
   */
  stop(): void {
    if (this.aiderProcess) {
      this.aiderProcess.kill('SIGTERM');
      setTimeout(() => {
        if (this.aiderProcess) {
          this.aiderProcess.kill('SIGKILL');
        }
      }, 5000);
    }
  }

  /**
   * Shutdown and cleanup
   */
  async shutdown(): Promise<void> {
    this.stop();
    await this.sandbox.shutdown();
    this.emit('shutdown');
  }

  /**
   * Get the underlying sandbox manager
   */
  getSandbox(): SandboxManager {
    return this.sandbox;
  }

  /**
   * Build Aider command line arguments
   */
  private buildAiderArgs(files: string[]): string[] {
    const args: string[] = [];

    if (this.options.model) {
      args.push('--model', this.options.model);
    }

    if (this.options.autoCommit) {
      args.push('--auto-commits');
    }

    if (this.options.yesAlways) {
      args.push('--yes-always');
    }

    if (this.options.additionalArgs) {
      args.push(...this.options.additionalArgs);
    }

    // Add files
    args.push(...files);

    return args;
  }
}
