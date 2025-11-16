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
  allowedIPs?: string[];
  blockedIPs?: string[];
  allowedPorts?: number[];
  blockedPorts?: number[];
  allowedProtocols?: ('http' | 'https' | 'ws' | 'wss' | 'ftp' | 'ssh')[];
  allowLocalhost?: boolean;
  allowLoopback?: boolean;
  requireApprovalForNewDomains: boolean;

  // Resource limits
  maxMemoryMB?: number; // Maximum memory in megabytes
  maxCPUPercent?: number; // Maximum CPU usage percentage (100 = 1 core)
  maxProcesses?: number; // Maximum number of processes
  maxFileSize?: number; // Maximum file size in megabytes
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
  allowedIPs?: string[];
  blockedIPs?: string[];
  allowedPorts?: number[];
  blockedPorts?: number[];
  allowedProtocols?: ('http' | 'https' | 'ws' | 'wss' | 'ftp' | 'ssh')[];
  allowLocalhost?: boolean;
  allowLoopback?: boolean;
  requireApproval: boolean;
  socketPath: string;
}

export interface ExecuteOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
}
