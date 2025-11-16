/**
 * Core types for the Aider sandboxing system
 */

export interface SandboxConfig {
  workingDir: string;
  allowedReadPaths: string[];
  allowedWritePaths: string[];
  deniedPaths: string[];
  tmpDir: string;
  enableNetworkProxy: boolean;
  allowedDomains: string[];
  blockedDomains: string[];
  requireApprovalForNewDomains: boolean;
}

export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  duration: number;
}

export enum PermissionType {
  FILESYSTEM_READ = 'fs:read',
  FILESYSTEM_WRITE = 'fs:write',
  NETWORK_ACCESS = 'net:access',
  PROCESS_SPAWN = 'proc:spawn',
}

export interface Permission {
  type: PermissionType;
  resource: string;
  granted: boolean;
  permanent: boolean;
  timestamp: number;
}

export interface NetworkRequest {
  host: string;
  port: number;
  method: string;
  path: string;
}

export interface ProxyConfig {
  allowedDomains: string[];
  blockedDomains: string[];
  requireApproval: boolean;
  socketPath: string;
}

export interface ExecuteOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
}
