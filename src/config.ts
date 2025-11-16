/**
 * Configuration management for sandbox
 */

import { homedir } from 'os';
import { join } from 'path';
import { SandboxConfig } from './types.js';

export const DEFAULT_DENIED_PATHS = [
  join(homedir(), '.ssh'),
  join(homedir(), '.aws'),
  join(homedir(), '.config', 'gcloud'),
  join(homedir(), '.gnupg'),
  join(homedir(), '.kube'),
  join(homedir(), '.docker'),
  '/etc/passwd',
  '/etc/shadow',
  '/etc/sudoers',
];

export const DEFAULT_ALLOWED_DOMAINS = [
  'github.com',
  'raw.githubusercontent.com',
  'npmjs.com',
  'pypi.org',
  'registry.npmjs.org',
  'api.github.com',
  'files.pythonhosted.org',
];

export const DEFAULT_BLOCKED_DOMAINS = [
  // Add domains you want to explicitly block
];

export const DEFAULT_BLOCKED_PORTS = [
  22,   // SSH
  23,   // Telnet
  3389, // RDP
];

export const DEFAULT_RESOURCE_LIMITS = {
  maxMemoryMB: 2048,      // 2GB RAM limit
  maxCPUPercent: 100,     // 100% of 1 core
  maxProcesses: 100,      // Max 100 processes
  maxFileSize: 1024,      // 1GB max file size
};

export function getDefaultConfig(workingDir: string): SandboxConfig {
  return {
    workingDir,
    allowedReadPaths: [
      '/usr',
      '/lib',
      '/lib64',
      '/bin',
      '/etc/ssl',
      '/etc/ca-certificates',
      workingDir,
    ],
    allowedWritePaths: [workingDir],
    deniedPaths: DEFAULT_DENIED_PATHS,
    tmpDir: '/tmp',
    enableNetworkProxy: true,
    allowedDomains: DEFAULT_ALLOWED_DOMAINS,
    blockedDomains: DEFAULT_BLOCKED_DOMAINS,
    blockedPorts: DEFAULT_BLOCKED_PORTS,
    allowLocalhost: true,  // Allow localhost for local dev servers
    allowLoopback: true,   // Allow loopback connections
    requireApprovalForNewDomains: true,

    // Resource limits (reasonable defaults for coding assistants)
    maxMemoryMB: DEFAULT_RESOURCE_LIMITS.maxMemoryMB,
    maxCPUPercent: DEFAULT_RESOURCE_LIMITS.maxCPUPercent,
    maxProcesses: DEFAULT_RESOURCE_LIMITS.maxProcesses,
    maxFileSize: DEFAULT_RESOURCE_LIMITS.maxFileSize,
  };
}

export function validateConfig(config: SandboxConfig): void {
  if (!config.workingDir) {
    throw new Error('workingDir is required');
  }

  // Ensure denied paths are not in allowed paths
  for (const denied of config.deniedPaths) {
    if (config.allowedWritePaths.some((p) => p.startsWith(denied))) {
      throw new Error(
        `Denied path ${denied} cannot be in allowedWritePaths`
      );
    }
  }
}
