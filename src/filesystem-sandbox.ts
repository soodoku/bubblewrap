/**
 * Filesystem sandboxing using bubblewrap
 */

import { spawn } from 'child_process';
import { SandboxConfig, CommandResult, ExecuteOptions } from './types.js';

export class FilesystemSandbox {
  constructor(private config: SandboxConfig) {}

  /**
   * Execute a command inside bubblewrap sandbox
   */
  async executeCommand(
    command: string[],
    options: ExecuteOptions = {}
  ): Promise<CommandResult> {
    const startTime = Date.now();
    const bwrapArgs = this.buildBubblewrapArgs(command, options);

    return new Promise((resolve, reject) => {
      const proc = spawn('bwrap', bwrapArgs, {
        env: options.env || process.env,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('error', (error) => {
        reject(new Error(`Failed to spawn bubblewrap: ${error.message}`));
      });

      proc.on('close', (code) => {
        const duration = Date.now() - startTime;
        resolve({
          exitCode: code ?? 1,
          stdout,
          stderr,
          duration,
        });
      });

      // Handle timeout
      if (options.timeout) {
        setTimeout(() => {
          proc.kill('SIGTERM');
          setTimeout(() => proc.kill('SIGKILL'), 5000);
        }, options.timeout);
      }
    });
  }

  /**
   * Build bubblewrap command line arguments
   */
  private buildBubblewrapArgs(
    command: string[],
    options: ExecuteOptions
  ): string[] {
    const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';

    const args: string[] = [];

    // In CI environments, user namespaces may not be available
    // Use a more permissive mode that still provides isolation
    if (isCI) {
      // Only unshare IPC and UTS, skip user namespace
      args.push('--unshare-ipc', '--unshare-uts');
    } else {
      // Full isolation with user namespaces
      args.push('--unshare-all', '--share-net');
    }

    args.push(
      // Kill sandbox if parent dies
      '--die-with-parent',

      // Set up /proc and /dev
      '--proc',
      '/proc',
      '--dev',
      '/dev',

      // Create tmpfs for /tmp
      '--tmpfs',
      this.config.tmpDir
    );

    // Add read-only binds for system paths
    for (const path of this.config.allowedReadPaths) {
      if (path !== this.config.workingDir) {
        args.push('--ro-bind-try', path, path);
      }
    }

    // Add read-write binds for allowed write paths
    for (const path of this.config.allowedWritePaths) {
      args.push('--bind', path, path);
    }

    // Bind resolv.conf for DNS (read-only)
    args.push('--ro-bind-try', '/etc/resolv.conf', '/etc/resolv.conf');
    args.push('--ro-bind-try', '/etc/hosts', '/etc/hosts');

    // Set working directory
    const cwd = options.cwd || this.config.workingDir;
    args.push('--chdir', cwd);

    // Add the command to execute
    args.push(...command);

    return args;
  }

  /**
   * Check if bubblewrap is available
   */
  static async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn('which', ['bwrap']);
      proc.on('close', (code) => resolve(code === 0));
      proc.on('error', () => resolve(false));
    });
  }

  /**
   * Validate path is allowed for reading
   */
  isReadAllowed(path: string): boolean {
    // Check if path is in denied list
    if (this.config.deniedPaths.some((denied) => path.startsWith(denied))) {
      return false;
    }

    // Check if path is in allowed read paths
    return this.config.allowedReadPaths.some((allowed) =>
      path.startsWith(allowed)
    );
  }

  /**
   * Validate path is allowed for writing
   */
  isWriteAllowed(path: string): boolean {
    // Check if path is in denied list
    if (this.config.deniedPaths.some((denied) => path.startsWith(denied))) {
      return false;
    }

    // Check if path is in allowed write paths
    return this.config.allowedWritePaths.some((allowed) =>
      path.startsWith(allowed)
    );
  }
}
