/**
 * Tests for FilesystemSandbox
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { FilesystemSandbox } from '../filesystem-sandbox.js';
import { getDefaultConfig } from '../config.js';
import { homedir } from 'os';
import { join } from 'path';

describe('FilesystemSandbox', () => {
  let sandbox: FilesystemSandbox;
  const testDir = process.cwd();

  beforeAll(async () => {
    const isAvailable = await FilesystemSandbox.isAvailable();
    if (!isAvailable) {
      console.warn('Skipping tests: bubblewrap not available');
    }
  });

  it('should create a sandbox instance', () => {
    const config = getDefaultConfig(testDir);
    sandbox = new FilesystemSandbox(config);
    expect(sandbox).toBeDefined();
  });

  it('should allow reading from working directory', () => {
    const config = getDefaultConfig(testDir);
    sandbox = new FilesystemSandbox(config);

    expect(sandbox.isReadAllowed(testDir)).toBe(true);
    expect(sandbox.isReadAllowed(join(testDir, 'package.json'))).toBe(true);
  });

  it('should deny reading from .ssh directory', () => {
    const config = getDefaultConfig(testDir);
    sandbox = new FilesystemSandbox(config);

    const sshPath = join(homedir(), '.ssh', 'id_rsa');
    expect(sandbox.isReadAllowed(sshPath)).toBe(false);
  });

  it('should deny reading from .aws directory', () => {
    const config = getDefaultConfig(testDir);
    sandbox = new FilesystemSandbox(config);

    const awsPath = join(homedir(), '.aws', 'credentials');
    expect(sandbox.isReadAllowed(awsPath)).toBe(false);
  });

  it('should allow writing to working directory', () => {
    const config = getDefaultConfig(testDir);
    sandbox = new FilesystemSandbox(config);

    expect(sandbox.isWriteAllowed(join(testDir, 'test.txt'))).toBe(true);
  });

  it('should deny writing to .ssh directory', () => {
    const config = getDefaultConfig(testDir);
    sandbox = new FilesystemSandbox(config);

    const sshPath = join(homedir(), '.ssh', 'authorized_keys');
    expect(sandbox.isWriteAllowed(sshPath)).toBe(false);
  });

  it('should execute simple command in sandbox', async () => {
    const isAvailable = await FilesystemSandbox.isAvailable();
    if (!isAvailable) {
      console.warn('Skipping: bubblewrap not available');
      return;
    }

    const config = getDefaultConfig(testDir);
    sandbox = new FilesystemSandbox(config);

    const result = await sandbox.executeCommand(['echo', 'hello'], {
      cwd: testDir,
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('hello');
  });

  it('should block access to sensitive files', async () => {
    const isAvailable = await FilesystemSandbox.isAvailable();
    if (!isAvailable) {
      console.warn('Skipping: bubblewrap not available');
      return;
    }

    const config = getDefaultConfig(testDir);
    sandbox = new FilesystemSandbox(config);

    const result = await sandbox.executeCommand(
      ['cat', join(homedir(), '.ssh', 'id_rsa')],
      { cwd: testDir }
    );

    expect(result.exitCode).not.toBe(0);
  });

  it('should allow access to working directory files', async () => {
    const isAvailable = await FilesystemSandbox.isAvailable();
    if (!isAvailable) {
      console.warn('Skipping: bubblewrap not available');
      return;
    }

    const config = getDefaultConfig(testDir);
    sandbox = new FilesystemSandbox(config);

    const result = await sandbox.executeCommand(
      ['ls', testDir],
      { cwd: testDir }
    );

    expect(result.exitCode).toBe(0);
  });
});
