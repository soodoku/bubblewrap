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
   * Extract file paths from command arguments based on command-specific parsing rules
   */
  private extractFilePaths(cmd: string, args: string[]): { readPaths: string[]; writePaths: string[] } {
    const readPaths: string[] = [];
    const writePaths: string[] = [];

    // Flags that take arguments (not file paths)
    const flagsWithArgs: Record<string, string[]> = {
      grep: ['-e', '-f', '-m', '-A', '-B', '-C', '--regexp', '--file', '--max-count'],
      head: ['-n', '-c', '--lines', '--bytes'],
      tail: ['-n', '-c', '--lines', '--bytes'],
      find: ['-name', '-type', '-size', '-user', '-group', '-perm', '-exec', '-maxdepth', '-mindepth'],
    };

    const commandFlags = flagsWithArgs[cmd] || [];
    let skipNext = false;

    switch (cmd) {
      case 'cat':
      case 'head':
      case 'tail':
      case 'less':
      case 'more':
        // All non-flag arguments are file paths
        for (let i = 0; i < args.length; i++) {
          if (skipNext) {
            skipNext = false;
            continue;
          }
          const arg = args[i];
          if (arg.startsWith('-')) {
            // Check if this flag takes an argument
            if (commandFlags.includes(arg)) {
              skipNext = true;
            }
          } else {
            readPaths.push(arg);
          }
        }
        break;

      case 'grep':
        // First non-flag argument is the pattern, rest are files
        let foundPattern = false;
        for (let i = 0; i < args.length; i++) {
          if (skipNext) {
            skipNext = false;
            continue;
          }
          const arg = args[i];
          if (arg.startsWith('-')) {
            // Check if this flag takes an argument
            if (commandFlags.includes(arg)) {
              skipNext = true;
            }
          } else {
            if (!foundPattern) {
              // This is the pattern, not a file
              foundPattern = true;
            } else {
              // These are files
              readPaths.push(arg);
            }
          }
        }
        break;

      case 'find':
        // First non-flag argument is the directory, then predicates
        let foundDirectory = false;
        for (let i = 0; i < args.length; i++) {
          if (skipNext) {
            skipNext = false;
            continue;
          }
          const arg = args[i];
          if (!foundDirectory && !arg.startsWith('-')) {
            // First non-flag arg is the directory to search
            readPaths.push(arg);
            foundDirectory = true;
          } else if (arg.startsWith('-')) {
            // Check if this flag takes an argument
            if (commandFlags.includes(arg)) {
              skipNext = true;
            }
          }
          // Other args are predicates, not file paths
        }
        break;

      case 'touch':
      case 'tee':
        // All non-flag arguments are file paths (write access)
        for (let i = 0; i < args.length; i++) {
          if (skipNext) {
            skipNext = false;
            continue;
          }
          const arg = args[i];
          if (arg.startsWith('-')) {
            if (commandFlags.includes(arg)) {
              skipNext = true;
            }
          } else {
            writePaths.push(arg);
          }
        }
        break;

      case 'echo':
        // Echo arguments are not file paths (unless redirected, handled separately)
        // No file paths to extract
        break;

      case 'dd':
        // dd uses if=/path and of=/path syntax
        for (const arg of args) {
          if (arg.startsWith('if=')) {
            readPaths.push(arg.substring(3));
          } else if (arg.startsWith('of=')) {
            writePaths.push(arg.substring(3));
          }
        }
        break;

      case 'test':
      case '[':
      case '[[':
        // Test commands: look for file test operators
        // Common patterns: -f file, -d dir, -e path, file1 -nt file2, etc.
        for (let i = 0; i < args.length; i++) {
          const arg = args[i];
          if (arg === ']') continue; // Skip closing bracket

          // File test operators that take a path argument
          if (['-f', '-d', '-e', '-r', '-w', '-x', '-s', '-L', '-h'].includes(arg)) {
            if (i + 1 < args.length) {
              readPaths.push(args[i + 1]);
              i++; // Skip the path
            }
          }
          // Binary operators with file paths on both sides
          else if (['-nt', '-ot', '-ef'].includes(arg)) {
            // Previous and next arguments are file paths
            if (i > 0 && args[i - 1] !== ']' && !args[i - 1].startsWith('-')) {
              // Previous arg already processed, just add next
            }
            if (i + 1 < args.length) {
              readPaths.push(args[i + 1]);
              i++; // Skip the path
            }
          }
          // Standalone file path (e.g., [ -f file ] or [ file ])
          else if (
            !arg.startsWith('-') &&
            (i === 0 || !['-eq', '-ne', '-lt', '-le', '-gt', '-ge', '=', '!=', '-z', '-n'].includes(args[i - 1]))
          ) {
            readPaths.push(arg);
          }
        }
        break;

      default:
        // Unknown command - don't extract any paths
        break;
    }

    return { readPaths, writePaths };
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

    // Use command-aware argument parsing
    if (readCommands.includes(cmd) || writeCommands.includes(cmd) || testCommands.includes(cmd)) {
      const { readPaths, writePaths } = this.extractFilePaths(cmd, args);

      // Validate read paths
      for (const path of readPaths) {
        if (!this.isReadAllowed(path)) {
          return { allowed: false, reason: `Read access denied to ${path}` };
        }
      }

      // Validate write paths
      for (const path of writePaths) {
        if (!this.isWriteAllowed(path)) {
          return { allowed: false, reason: `Write access denied to ${path}` };
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
