/**
 * Platform-agnostic sandbox interface
 */

import { platform } from 'os';
import { FilesystemSandbox } from './filesystem-sandbox.js';
import { MacOSSandbox } from './macos-sandbox.js';
import { SandboxConfig, CommandResult, ExecuteOptions } from './types.js';

export interface ISandbox {
  executeCommand(
    command: string[],
    options?: ExecuteOptions
  ): Promise<CommandResult>;
  isReadAllowed(path: string): boolean;
  isWriteAllowed(path: string): boolean;
}

export class PlatformSandbox implements ISandbox {
  private sandbox: ISandbox;

  constructor(config: SandboxConfig) {
    const currentPlatform = platform();

    if (currentPlatform === 'darwin') {
      this.sandbox = new MacOSSandbox(config);
    } else if (currentPlatform === 'linux') {
      this.sandbox = new FilesystemSandbox(config);
    } else {
      throw new Error(
        `Platform ${currentPlatform} is not supported. Only Linux and macOS are supported.`
      );
    }
  }

  async executeCommand(
    command: string[],
    options: ExecuteOptions = {}
  ): Promise<CommandResult> {
    return this.sandbox.executeCommand(command, options);
  }

  isReadAllowed(path: string): boolean {
    return this.sandbox.isReadAllowed(path);
  }

  isWriteAllowed(path: string): boolean {
    return this.sandbox.isWriteAllowed(path);
  }

  /**
   * Check if sandboxing is available on this platform
   */
  static async isAvailable(): Promise<boolean> {
    const currentPlatform = platform();

    if (currentPlatform === 'darwin') {
      return MacOSSandbox.isAvailable();
    } else if (currentPlatform === 'linux') {
      return FilesystemSandbox.isAvailable();
    }

    return false;
  }

  /**
   * Get the current platform name
   */
  static getPlatform(): string {
    return platform();
  }

  /**
   * Get the sandbox implementation name for current platform
   */
  static getSandboxType(): string {
    const currentPlatform = platform();

    if (currentPlatform === 'darwin') {
      return 'sandbox-exec';
    } else if (currentPlatform === 'linux') {
      return 'bubblewrap';
    }

    return 'unsupported';
  }
}
