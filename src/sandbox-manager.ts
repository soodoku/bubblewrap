/**
 * Main sandbox manager that integrates all components
 */

import { FilesystemSandbox } from './filesystem-sandbox.js';
import { NetworkProxy } from './network-proxy.js';
import { PermissionManager } from './permission-manager.js';
import {
  SandboxConfig,
  CommandResult,
  ExecuteOptions,
  PermissionType,
} from './types.js';
import { getDefaultConfig, validateConfig } from './config.js';
import { EventEmitter } from 'events';

export class SandboxManager extends EventEmitter {
  private fsSandbox: FilesystemSandbox;
  private networkProxy: NetworkProxy | null = null;
  private permissions: PermissionManager;
  private config: SandboxConfig;
  private initialized = false;

  constructor(workingDir: string, config?: Partial<SandboxConfig>) {
    super();

    this.config = {
      ...getDefaultConfig(workingDir),
      ...config,
    };

    validateConfig(this.config);

    this.fsSandbox = new FilesystemSandbox(this.config);
    this.permissions = new PermissionManager();

    // Forward permission events
    this.permissions.on('approval-required', (data) => {
      this.emit('permission-required', data);
    });

    if (this.config.enableNetworkProxy) {
      this.networkProxy = new NetworkProxy({
        allowedDomains: this.config.allowedDomains,
        blockedDomains: this.config.blockedDomains,
        requireApproval: this.config.requireApprovalForNewDomains,
        socketPath: '/tmp/aider-sandbox-proxy.sock',
      });

      // Forward network events
      this.networkProxy.on('approval-required', (data) => {
        this.emit('network-approval-required', data);
      });

      this.networkProxy.on('blocked', (data) => {
        this.emit('network-blocked', data);
      });
    }
  }

  /**
   * Initialize the sandbox environment
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Check if bubblewrap is available
    const bwrapAvailable = await FilesystemSandbox.isAvailable();
    if (!bwrapAvailable) {
      throw new Error(
        'bubblewrap is not installed. Install it with: apt-get install bubblewrap'
      );
    }

    // Start network proxy if enabled
    if (this.networkProxy) {
      await this.networkProxy.start();
    }

    this.initialized = true;
    this.emit('initialized');
  }

  /**
   * Shutdown the sandbox
   */
  async shutdown(): Promise<void> {
    if (this.networkProxy) {
      await this.networkProxy.stop();
    }
    this.initialized = false;
    this.emit('shutdown');
  }

  /**
   * Execute a command in the sandbox
   */
  async executeCommand(
    command: string[],
    options: ExecuteOptions = {}
  ): Promise<CommandResult> {
    if (!this.initialized) {
      throw new Error('Sandbox not initialized. Call initialize() first.');
    }

    // Check permission to spawn process
    const hasPermission = await this.permissions.request(
      PermissionType.PROCESS_SPAWN,
      command[0],
      `Execute: ${command.join(' ')}`
    );

    if (!hasPermission) {
      throw new Error(`Permission denied to execute: ${command[0]}`);
    }

    // Add proxy environment variables if network proxy is enabled
    const env = { ...options.env };
    if (this.networkProxy) {
      env.HTTP_PROXY = 'unix:///tmp/aider-sandbox-proxy.sock';
      env.HTTPS_PROXY = 'unix:///tmp/aider-sandbox-proxy.sock';
      env.ALL_PROXY = 'unix:///tmp/aider-sandbox-proxy.sock';
      env.NO_PROXY = 'localhost,127.0.0.1';
    }

    // Execute in filesystem sandbox
    const result = await this.fsSandbox.executeCommand(command, {
      ...options,
      env,
    });

    this.emit('command-executed', { command, result });

    return result;
  }

  /**
   * Check if a file path can be read
   */
  canRead(path: string): boolean {
    return this.fsSandbox.isReadAllowed(path);
  }

  /**
   * Check if a file path can be written
   */
  canWrite(path: string): boolean {
    return this.fsSandbox.isWriteAllowed(path);
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<SandboxConfig> {
    return Object.freeze({ ...this.config });
  }

  /**
   * Get permission manager (for UI integration)
   */
  getPermissionManager(): PermissionManager {
    return this.permissions;
  }

  /**
   * Enable auto-approval for certain permission types
   */
  setAutoApprove(types: PermissionType[]): void {
    this.permissions.setAutoApprove(types);
  }
}
