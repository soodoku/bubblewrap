/**
 * macOS sandboxing using sandbox-exec and Seatbelt profiles
 */

import { spawn } from 'child_process';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { SandboxConfig, CommandResult, ExecuteOptions } from './types.js';

export class MacOSSandbox {
  constructor(private config: SandboxConfig) {}

  /**
   * Execute a command inside macOS sandbox
   */
  async executeCommand(
    command: string[],
    options: ExecuteOptions = {}
  ): Promise<CommandResult> {
    const startTime = Date.now();
    const profilePath = await this.createSandboxProfile();

    try {
      const result = await this.runSandboxed(command, profilePath, options);
      return result;
    } finally {
      // Clean up profile file
      await unlink(profilePath).catch(() => {
        // Ignore cleanup errors
      });
    }
  }

  /**
   * Create temporary Seatbelt profile
   */
  private async createSandboxProfile(): Promise<string> {
    const profile = this.generateSeatbeltProfile();
    const profilePath = join(tmpdir(), `sandbox-${Date.now()}.sb`);
    await writeFile(profilePath, profile, 'utf-8');
    return profilePath;
  }

  /**
   * Generate Seatbelt sandbox profile
   */
  private generateSeatbeltProfile(): string {
    const deniedPaths = this.config.deniedPaths
      .map((path) => path.replace(/^~/, process.env.HOME || ''))
      .map((path) => `    (subpath "${path}")`)
      .join('\n');

    return `
(version 1)
(debug deny)

; Allow default operations
(allow default)

; Deny network access (we control this via proxy)
; Note: sandbox-exec network filtering is limited
; We rely on the network proxy for actual control

; Deny access to sensitive files and directories
(deny file-read* file-write*
${deniedPaths}
)

; Allow access to working directory
(allow file-read* file-write*
  (subpath "${this.config.workingDir}")
)

; Allow read access to system directories
(allow file-read*
  (subpath "/usr")
  (subpath "/System")
  (subpath "/Library/Frameworks")
  (subpath "/Library/Application Support")
  (literal "/etc/resolv.conf")
  (literal "/etc/hosts")
)

; Allow write to tmp
(allow file-write*
  (subpath "${this.config.tmpDir}")
)

; Allow network for our proxy
(allow network*)

; Allow process execution
(allow process-exec*)
(allow process-fork)

; Allow IPC
(allow ipc*)

; Allow mach lookups (required for system services)
(allow mach-lookup)
`;
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

    // Set CPU time limit
    if (this.config.maxCPUPercent) {
      const cpuSeconds = Math.floor(this.config.maxCPUPercent * 10);
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
   * Run command with sandbox-exec
   */
  private async runSandboxed(
    command: string[],
    profilePath: string,
    options: ExecuteOptions
  ): Promise<CommandResult> {
    const startTime = Date.now();

    // Wrap command with resource limits if configured
    const finalCommand = this.buildResourceLimitedCommand(command);

    return new Promise((resolve, reject) => {
      const proc = spawn('sandbox-exec', ['-f', profilePath, ...finalCommand], {
        cwd: options.cwd || this.config.workingDir,
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
        reject(new Error(`Failed to spawn sandbox-exec: ${error.message}`));
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
   * Check if sandbox-exec is available
   */
  static async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn('which', ['sandbox-exec']);
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
