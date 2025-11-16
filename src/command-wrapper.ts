/**
 * Generic command wrapper for executing any tool in a sandbox
 * This is tool-agnostic and can wrap any command-line tool
 */

import { SandboxManager } from './sandbox-manager.js';
import { CommandResult, PermissionType } from './types.js';
import { EventEmitter } from 'events';

export interface CommandWrapperOptions {
  workingDir: string;
  autoApproveRead?: boolean;
  autoApproveWrite?: boolean;
  autoApproveNetwork?: boolean;
  allowedDomains?: string[];
  blockedDomains?: string[];
  deniedPaths?: string[];
}

/**
 * Generic wrapper that can execute any command in a sandbox
 * Use this directly or extend for tool-specific wrappers
 */
export class CommandWrapper extends EventEmitter {
  protected sandbox: SandboxManager;
  protected workingDir: string;

  constructor(options: CommandWrapperOptions) {
    super();
    this.workingDir = options.workingDir;

    // Create sandbox with options
    this.sandbox = new SandboxManager(options.workingDir, {
      allowedDomains: options.allowedDomains || [
        'github.com',
        '*.githubusercontent.com',
        'npmjs.com',
        'pypi.org',
        'registry.npmjs.org',
      ],
      blockedDomains: options.blockedDomains || [],
      ...(options.deniedPaths && { deniedPaths: options.deniedPaths }),
    });

    // Set up auto-approvals based on options
    const autoApprove: PermissionType[] = [];
    if (options.autoApproveRead) {
      autoApprove.push(PermissionType.FILESYSTEM_READ);
    }
    if (options.autoApproveWrite) {
      autoApprove.push(PermissionType.FILESYSTEM_WRITE);
    }
    if (options.autoApproveNetwork) {
      autoApprove.push(PermissionType.NETWORK_ACCESS);
    }
    // Always auto-approve process spawn (user controls via command)
    autoApprove.push(PermissionType.PROCESS_SPAWN);

    this.sandbox.setAutoApprove(autoApprove);

    // Forward sandbox events
    this.sandbox.on('permission-required', (data) => {
      this.emit('permission-required', data);
    });

    this.sandbox.on('network-approval-required', (data) => {
      this.emit('network-approval-required', data);
    });

    this.sandbox.on('command-executed', (data) => {
      this.emit('command-executed', data);
    });
  }

  /**
   * Initialize the sandbox
   */
  async initialize(): Promise<void> {
    await this.sandbox.initialize();
    this.emit('initialized');
  }

  /**
   * Execute any command in the sandbox
   */
  async execute(
    command: string[],
    options: { cwd?: string; env?: Record<string, string> } = {}
  ): Promise<CommandResult> {
    return this.sandbox.executeCommand(command, {
      cwd: options.cwd || this.workingDir,
      env: options.env,
    });
  }

  /**
   * Execute a shell command string in the sandbox
   */
  async executeShell(
    command: string,
    options: { cwd?: string; env?: Record<string, string> } = {}
  ): Promise<CommandResult> {
    return this.execute(['sh', '-c', command], options);
  }

  /**
   * Check if a path can be read
   */
  canRead(path: string): boolean {
    return this.sandbox.canRead(path);
  }

  /**
   * Check if a path can be written
   */
  canWrite(path: string): boolean {
    return this.sandbox.canWrite(path);
  }

  /**
   * Get the underlying sandbox manager for advanced usage
   */
  getSandbox(): SandboxManager {
    return this.sandbox;
  }

  /**
   * Shutdown and cleanup
   */
  async shutdown(): Promise<void> {
    await this.sandbox.shutdown();
    this.emit('shutdown');
  }
}
