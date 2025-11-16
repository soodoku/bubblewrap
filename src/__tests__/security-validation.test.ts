/**
 * Comprehensive security validation tests
 * These tests verify the actual security claims with real file access attempts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SandboxManager } from '../sandbox-manager.js';
import { PermissionType } from '../types.js';
import { PlatformSandbox } from '../platform-sandbox.js';
import { homedir } from 'os';
import { join } from 'path';
import { writeFile, mkdir, rm } from 'fs/promises';
import { existsSync } from 'fs';

describe('Security Validation Tests', () => {
  let sandbox: SandboxManager;
  const testDir = join(process.cwd(), 'test-sandbox-dir');
  const sensitiveTestFile = join(testDir, '.test-sensitive');

  beforeAll(async () => {
    // Skip tests if sandboxing not available
    const available = await PlatformSandbox.isAvailable();
    if (!available) {
      console.warn(
        `Skipping security tests: ${PlatformSandbox.getSandboxType()} not available on ${PlatformSandbox.getPlatform()}`
      );
    }

    // Create test directory
    await mkdir(testDir, { recursive: true });
    await writeFile(sensitiveTestFile, 'sensitive data', 'utf-8');
  });

  afterAll(async () => {
    // Clean up
    await rm(testDir, { recursive: true, force: true });
  });

  describe('SSH Key Protection', () => {
    it('should block reading SSH private keys', async () => {
      const available = await PlatformSandbox.isAvailable();
      if (!available) return;

      sandbox = new SandboxManager(testDir);
      sandbox.setAutoApprove([PermissionType.PROCESS_SPAWN]);
      await sandbox.initialize();

      const sshKeyPath = join(homedir(), '.ssh', 'id_rsa');
      const result = await sandbox.executeCommand(['cat', sshKeyPath]);

      // Should fail - either file doesn't exist or access denied
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr.length).toBeGreaterThan(0);

      await sandbox.shutdown();
    });

    it('should block writing to SSH directory', async () => {
      const available = await PlatformSandbox.isAvailable();
      if (!available) return;

      sandbox = new SandboxManager(testDir);
      sandbox.setAutoApprove([PermissionType.PROCESS_SPAWN]);
      await sandbox.initialize();

      const maliciousKeyPath = join(homedir(), '.ssh', 'malicious_key');
      const result = await sandbox.executeCommand([
        'sh',
        '-c',
        `echo 'malicious' > ${maliciousKeyPath}`,
      ]);

      // Should fail
      expect(result.exitCode).not.toBe(0);

      await sandbox.shutdown();
    });

    it('should report SSH paths as not readable', () => {
      sandbox = new SandboxManager(testDir);
      const sshPath = join(homedir(), '.ssh', 'id_rsa');
      expect(sandbox.canRead(sshPath)).toBe(false);
    });

    it('should report SSH paths as not writable', () => {
      sandbox = new SandboxManager(testDir);
      const sshPath = join(homedir(), '.ssh', 'authorized_keys');
      expect(sandbox.canWrite(sshPath)).toBe(false);
    });
  });

  describe('AWS Credentials Protection', () => {
    it('should block reading AWS credentials', async () => {
      const available = await PlatformSandbox.isAvailable();
      if (!available) return;

      sandbox = new SandboxManager(testDir);
      sandbox.setAutoApprove([PermissionType.PROCESS_SPAWN]);
      await sandbox.initialize();

      const awsCredsPath = join(homedir(), '.aws', 'credentials');
      const result = await sandbox.executeCommand(['cat', awsCredsPath]);

      expect(result.exitCode).not.toBe(0);

      await sandbox.shutdown();
    });

    it('should block reading AWS config', async () => {
      const available = await PlatformSandbox.isAvailable();
      if (!available) return;

      sandbox = new SandboxManager(testDir);
      sandbox.setAutoApprove([PermissionType.PROCESS_SPAWN]);
      await sandbox.initialize();

      const awsConfigPath = join(homedir(), '.aws', 'config');
      const result = await sandbox.executeCommand(['cat', awsConfigPath]);

      expect(result.exitCode).not.toBe(0);

      await sandbox.shutdown();
    });

    it('should report AWS paths as not readable', () => {
      sandbox = new SandboxManager(testDir);
      const awsPath = join(homedir(), '.aws', 'credentials');
      expect(sandbox.canRead(awsPath)).toBe(false);
    });
  });

  describe('GCloud Credentials Protection', () => {
    it('should block reading GCloud credentials', async () => {
      const available = await PlatformSandbox.isAvailable();
      if (!available) return;

      sandbox = new SandboxManager(testDir);
      sandbox.setAutoApprove([PermissionType.PROCESS_SPAWN]);
      await sandbox.initialize();

      const gcloudPath = join(
        homedir(),
        '.config',
        'gcloud',
        'credentials.db'
      );
      const result = await sandbox.executeCommand(['cat', gcloudPath]);

      expect(result.exitCode).not.toBe(0);

      await sandbox.shutdown();
    });

    it('should report GCloud paths as not readable', () => {
      sandbox = new SandboxManager(testDir);
      const gcloudPath = join(homedir(), '.config', 'gcloud');
      expect(sandbox.canRead(gcloudPath)).toBe(false);
    });
  });

  describe('System File Protection', () => {
    it('should block reading /etc/shadow', async () => {
      const available = await PlatformSandbox.isAvailable();
      if (!available) return;

      sandbox = new SandboxManager(testDir);
      sandbox.setAutoApprove([PermissionType.PROCESS_SPAWN]);
      await sandbox.initialize();

      const result = await sandbox.executeCommand(['cat', '/etc/shadow']);

      expect(result.exitCode).not.toBe(0);

      await sandbox.shutdown();
    });

    it('should block reading /etc/passwd', async () => {
      const available = await PlatformSandbox.isAvailable();
      if (!available) return;

      sandbox = new SandboxManager(testDir);
      sandbox.setAutoApprove([PermissionType.PROCESS_SPAWN]);
      await sandbox.initialize();

      const result = await sandbox.executeCommand(['cat', '/etc/passwd']);

      // Note: /etc/passwd is sometimes readable but shouldn't be in sandbox
      // depending on platform configuration
      expect(result.exitCode).not.toBe(0);

      await sandbox.shutdown();
    });
  });

  describe('Working Directory Access', () => {
    it('should allow reading files in working directory', async () => {
      const available = await PlatformSandbox.isAvailable();
      if (!available) return;

      sandbox = new SandboxManager(testDir);
      sandbox.setAutoApprove([PermissionType.PROCESS_SPAWN]);
      await sandbox.initialize();

      const result = await sandbox.executeCommand([
        'cat',
        sensitiveTestFile,
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe('sensitive data');

      await sandbox.shutdown();
    });

    it('should allow writing files in working directory', async () => {
      const available = await PlatformSandbox.isAvailable();
      if (!available) return;

      sandbox = new SandboxManager(testDir);
      sandbox.setAutoApprove([PermissionType.PROCESS_SPAWN]);
      await sandbox.initialize();

      const testFile = join(testDir, 'test-write.txt');
      const result = await sandbox.executeCommand([
        'sh',
        '-c',
        `echo 'test data' > ${testFile}`,
      ]);

      expect(result.exitCode).toBe(0);
      expect(existsSync(testFile)).toBe(true);

      await sandbox.shutdown();
    });

    it('should allow listing working directory', async () => {
      const available = await PlatformSandbox.isAvailable();
      if (!available) return;

      sandbox = new SandboxManager(testDir);
      sandbox.setAutoApprove([PermissionType.PROCESS_SPAWN]);
      await sandbox.initialize();

      const result = await sandbox.executeCommand(['ls', '-la', testDir]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('.test-sensitive');

      await sandbox.shutdown();
    });

    it('should report working directory as readable', () => {
      sandbox = new SandboxManager(testDir);
      expect(sandbox.canRead(testDir)).toBe(true);
      expect(sandbox.canRead(join(testDir, 'file.txt'))).toBe(true);
    });

    it('should report working directory as writable', () => {
      sandbox = new SandboxManager(testDir);
      expect(sandbox.canWrite(testDir)).toBe(true);
      expect(sandbox.canWrite(join(testDir, 'file.txt'))).toBe(true);
    });
  });

  describe('Directory Traversal Protection', () => {
    it('should block access outside working directory', async () => {
      const available = await PlatformSandbox.isAvailable();
      if (!available) return;

      sandbox = new SandboxManager(testDir);
      sandbox.setAutoApprove([PermissionType.PROCESS_SPAWN]);
      await sandbox.initialize();

      const result = await sandbox.executeCommand([
        'cat',
        join(homedir(), 'some-file.txt'),
      ]);

      expect(result.exitCode).not.toBe(0);

      await sandbox.shutdown();
    });

    it('should block writing outside working directory', async () => {
      const available = await PlatformSandbox.isAvailable();
      if (!available) return;

      sandbox = new SandboxManager(testDir);
      sandbox.setAutoApprove([PermissionType.PROCESS_SPAWN]);
      await sandbox.initialize();

      const maliciousPath = join(homedir(), 'malicious.txt');
      const result = await sandbox.executeCommand([
        'sh',
        '-c',
        `echo 'malicious' > ${maliciousPath}`,
      ]);

      expect(result.exitCode).not.toBe(0);

      await sandbox.shutdown();
    });
  });

  describe('Docker Credentials Protection', () => {
    it('should block reading Docker config', async () => {
      const available = await PlatformSandbox.isAvailable();
      if (!available) return;

      sandbox = new SandboxManager(testDir);
      sandbox.setAutoApprove([PermissionType.PROCESS_SPAWN]);
      await sandbox.initialize();

      const dockerConfigPath = join(homedir(), '.docker', 'config.json');
      const result = await sandbox.executeCommand(['cat', dockerConfigPath]);

      expect(result.exitCode).not.toBe(0);

      await sandbox.shutdown();
    });

    it('should report Docker paths as not readable', () => {
      sandbox = new SandboxManager(testDir);
      const dockerPath = join(homedir(), '.docker', 'config.json');
      expect(sandbox.canRead(dockerPath)).toBe(false);
    });
  });

  describe('Kubernetes Config Protection', () => {
    it('should block reading Kubernetes config', async () => {
      const available = await PlatformSandbox.isAvailable();
      if (!available) return;

      sandbox = new SandboxManager(testDir);
      sandbox.setAutoApprove([PermissionType.PROCESS_SPAWN]);
      await sandbox.initialize();

      const kubeConfigPath = join(homedir(), '.kube', 'config');
      const result = await sandbox.executeCommand(['cat', kubeConfigPath]);

      expect(result.exitCode).not.toBe(0);

      await sandbox.shutdown();
    });

    it('should report Kubernetes paths as not readable', () => {
      sandbox = new SandboxManager(testDir);
      const kubePath = join(homedir(), '.kube', 'config');
      expect(sandbox.canRead(kubePath)).toBe(false);
    });
  });

  describe('GPG Keys Protection', () => {
    it('should block reading GPG private keys', async () => {
      const available = await PlatformSandbox.isAvailable();
      if (!available) return;

      sandbox = new SandboxManager(testDir);
      sandbox.setAutoApprove([PermissionType.PROCESS_SPAWN]);
      await sandbox.initialize();

      const gpgPath = join(homedir(), '.gnupg', 'private-keys-v1.d');
      const result = await sandbox.executeCommand(['ls', gpgPath]);

      expect(result.exitCode).not.toBe(0);

      await sandbox.shutdown();
    });

    it('should report GPG paths as not readable', () => {
      sandbox = new SandboxManager(testDir);
      const gpgPath = join(homedir(), '.gnupg');
      expect(sandbox.canRead(gpgPath)).toBe(false);
    });
  });
});
