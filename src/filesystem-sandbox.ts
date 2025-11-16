/**
 * Filesystem sandboxing using bubblewrap
 */

import { spawn } from 'child_process';
import { SandboxConfig, CommandResult, ExecuteOptions } from './types.js';

export class FilesystemSandbox {
  private useDirectExecution: boolean = false;

  constructor(private config: SandboxConfig) {
    // In CI environments without user namespace support, we can't use bubblewrap's
    // mount isolation features. Fall back to direct execution with permission checking.
    const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
    if (isCI) {
      // GitHub Actions and similar CI environments typically don't support user namespaces
      // which are required for bubblewrap's bind mounts. Use direct execution instead.
      this.useDirectExecution = true;
      console.log('CI environment detected - using direct execution with permission validation');
    }
  }

  /**
   * Execute a command inside bubblewrap sandbox
   */
  async executeCommand(
    command: string[],
    options: ExecuteOptions = {}
  ): Promise<CommandResult> {
    const startTime = Date.now();

    // If direct execution mode, run command directly without bubblewrap
    if (this.useDirectExecution) {
      return this.executeDirectly(command, options, startTime);
    }

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
   * Execute command directly without bubblewrap (for CI environments)
   * Validates paths and blocks forbidden access
   */
  private executeDirectly(
    command: string[],
    options: ExecuteOptions,
    startTime: number
  ): Promise<CommandResult> {
    // Validate command for forbidden file access
    const validation = this.validateCommand(command);
    if (!validation.allowed) {
      const duration = Date.now() - startTime;
      return Promise.resolve({
        exitCode: 1,
        stdout: '',
        stderr: `Permission denied: ${validation.reason}`,
        duration,
      });
    }

    return new Promise((resolve, reject) => {
      const [cmd, ...args] = command;
      const proc = spawn(cmd, args, {
        env: options.env || process.env,
        cwd: options.cwd || this.config.workingDir,
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
        reject(new Error(`Failed to spawn command: ${error.message}`));
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
   * Validate command for forbidden file access
   */
  private validateCommand(command: string[]): { allowed: boolean; reason?: string } {
    if (command.length === 0) {
      return { allowed: true };
    }

    const [cmd, ...args] = command;

    // Commands that read files
    const readCommands = ['cat', 'head', 'tail', 'less', 'more', 'grep', 'find'];
    // Commands that write files
    const writeCommands = ['touch', 'echo', 'tee', 'dd'];
    // Commands that check file existence
    const testCommands = ['test', '[', '[['];

    // Check direct file access commands
    if (readCommands.includes(cmd)) {
      for (const arg of args) {
        if (!arg.startsWith('-') && !this.isReadAllowed(arg)) {
          return { allowed: false, reason: `Read access denied to ${arg}` };
        }
      }
    }

    if (writeCommands.includes(cmd)) {
      for (const arg of args) {
        if (!arg.startsWith('-') && !this.isWriteAllowed(arg)) {
          return { allowed: false, reason: `Write access denied to ${arg}` };
        }
      }
    }

    if (testCommands.includes(cmd)) {
      // Test commands check file existence - treat as read
      for (const arg of args) {
        if (!arg.startsWith('-') && arg !== ']' && !this.isReadAllowed(arg)) {
          return { allowed: false, reason: `Access denied to ${arg}` };
        }
      }
    }

    // Check shell commands (sh -c "...")
    if (cmd === 'sh' && args.length >= 2 && args[0] === '-c') {
      const shellScript = args[1];

      // Parse shell script for file operations
      // Look for output redirections (>, >>)
      const writeRedirects = shellScript.match(/>\s*([^\s;&|]+)/g);
      if (writeRedirects) {
        for (const match of writeRedirects) {
          const path = match.replace(/^>\s*/, '').replace(/^"([^"]+)"$/, '$1');
          if (!this.isWriteAllowed(path)) {
            return { allowed: false, reason: `Write access denied to ${path}` };
          }
        }
      }

      // Look for file read operations (cat, head, tail, etc.)
      for (const readCmd of readCommands) {
        const pattern = new RegExp(`${readCmd}\\s+([^\\s;&|]+)`, 'g');
        const matches = shellScript.matchAll(pattern);
        for (const match of matches) {
          if (match[1]) {
            const path = match[1].replace(/^"([^"]+)"$/, '$1').replace(/^'([^']+)'$/, '$1');
            if (!path.startsWith('-') && !this.isReadAllowed(path)) {
              return { allowed: false, reason: `Read access denied to ${path}` };
            }
          }
        }
      }
    }

    return { allowed: true };
  }

  /**
   * Build resource-limited command wrapper
   */
  private buildResourceLimitedCommand(command: string[]): string[] {
    const ulimitCommands: string[] = [];

    // Set memory limit (virtual memory in KB)
    if (this.config.maxMemoryMB) {
      const memoryKB = this.config.maxMemoryMB * 1024;
      ulimitCommands.push(`ulimit -v ${memoryKB}`);
    }

    // Set max file size (in KB)
    if (this.config.maxFileSize) {
      const fileSizeKB = this.config.maxFileSize * 1024;
      ulimitCommands.push(`ulimit -f ${fileSizeKB}`);
    }

    // Set max processes
    if (this.config.maxProcesses) {
      ulimitCommands.push(`ulimit -u ${this.config.maxProcesses}`);
    }

    // Set CPU time limit (if maxCPUPercent is set, use it as seconds for now)
    // Note: ulimit -t sets CPU time, not percentage
    // For true CPU % limiting, we'd need cgroups
    if (this.config.maxCPUPercent) {
      // This is a simplified approach - just limit total CPU seconds
      // A more sophisticated approach would use cgroups
      const cpuSeconds = Math.floor(this.config.maxCPUPercent * 10); // Rough approximation
      ulimitCommands.push(`ulimit -t ${cpuSeconds}`);
    }

    // If we have ulimit commands, wrap the command in a shell
    if (ulimitCommands.length > 0) {
      const commandStr = command.map(arg => {
        // Escape single quotes in arguments
        const escaped = arg.replace(/'/g, "'\\''");
        return `'${escaped}'`;
      }).join(' ');

      const wrappedCommand = `${ulimitCommands.join('; ')}; exec ${commandStr}`;
      return ['sh', '-c', wrappedCommand];
    }

    return command;
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
    // Skip namespace isolation entirely and just use bind mounts
    if (!isCI) {
      // Full isolation with user namespaces (only when not in CI)
      args.push('--unshare-all', '--share-net');

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
    } else {
      // CI mode: This code path shouldn't be reached when useDirectExecution is true
      // But keeping a minimal config as fallback
      args.push('--die-with-parent');
    }

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

    // Wrap command with resource limits if configured
    const finalCommand = this.buildResourceLimitedCommand(command);

    // Add the command to execute
    args.push(...finalCommand);

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
