/**
 * Concrete security validation tests
 * These tests verify the actual security claims made in our documentation
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { PlatformSandbox } from '../platform-sandbox.js';
import { getDefaultConfig } from '../config.js';
import { homedir } from 'os';
import { join } from 'path';
import { writeFileSync, mkdirSync, existsSync } from 'fs';

describe('Security Validation Tests', () => {
  const testDir = process.cwd();
  let sandbox: PlatformSandbox;

  beforeAll(async () => {
    const isAvailable = await PlatformSandbox.isAvailable();
    if (!isAvailable) {
      console.warn(
        `Skipping tests: ${PlatformSandbox.getSandboxType()} not available on ${PlatformSandbox.getPlatform()}`
      );
    }

    const config = getDefaultConfig(testDir);
    sandbox = new PlatformSandbox(config);
  });

  /**
   * TEST 1: Block SSH Key Access
   * Claim: "Automatically blocks access to SSH keys (~/.ssh)"
   */
  it('TEST 1: Should block access to SSH private keys', async () => {
    const isAvailable = await PlatformSandbox.isAvailable();
    if (!isAvailable) return;

    const sshKeyPath = join(homedir(), '.ssh', 'id_rsa');

    // First verify the path is blocked by permission checker
    expect(sandbox.isReadAllowed(sshKeyPath)).toBe(false);

    // Then verify actual execution is blocked
    const result = await sandbox.executeCommand(['cat', sshKeyPath], {
      cwd: testDir,
    });

    // Should fail (non-zero exit code)
    expect(result.exitCode).not.toBe(0);
    console.log(`✓ TEST 1 PASSED: SSH key access blocked (exit code: ${result.exitCode})`);
  });

  /**
   * TEST 2: Block AWS Credentials Access
   * Claim: "Blocks access to AWS credentials (~/.aws)"
   */
  it('TEST 2: Should block access to AWS credentials', async () => {
    const isAvailable = await PlatformSandbox.isAvailable();
    if (!isAvailable) return;

    const awsCredPath = join(homedir(), '.aws', 'credentials');

    // First verify the path is blocked by permission checker
    expect(sandbox.isReadAllowed(awsCredPath)).toBe(false);

    // Then verify actual execution is blocked
    const result = await sandbox.executeCommand(['cat', awsCredPath], {
      cwd: testDir,
    });

    // Should fail (non-zero exit code)
    expect(result.exitCode).not.toBe(0);
    console.log(`✓ TEST 2 PASSED: AWS credentials access blocked (exit code: ${result.exitCode})`);
  });

  /**
   * TEST 3: Block Writing Outside Working Directory
   * Claim: "Write access restricted to project directory"
   */
  it('TEST 3: Should block writing files outside working directory', async () => {
    const isAvailable = await PlatformSandbox.isAvailable();
    if (!isAvailable) return;

    // Try to write to /tmp (outside working directory)
    const outsidePath = '/tmp/sandbox-test-forbidden.txt';

    // First verify the path is blocked by permission checker
    expect(sandbox.isWriteAllowed(outsidePath)).toBe(false);

    // Then verify actual execution is blocked
    const result = await sandbox.executeCommand(
      ['sh', '-c', `echo "malicious" > ${outsidePath}`],
      { cwd: testDir }
    );

    // The command might succeed (exit 0) but file should not be created
    // OR it might fail - either is acceptable
    if (result.exitCode === 0) {
      // If command succeeded, verify file wasn't actually created
      const checkResult = await sandbox.executeCommand(
        ['test', '-f', outsidePath],
        { cwd: testDir }
      );
      expect(checkResult.exitCode).not.toBe(0);
    }

    console.log(`✓ TEST 3 PASSED: Write outside working directory blocked`);
  });

  /**
   * TEST 4: Allow Working Directory Access
   * Claim: "Claude can read and write within the current working directory"
   */
  it('TEST 4: Should allow reading and writing in working directory', async () => {
    const isAvailable = await PlatformSandbox.isAvailable();
    if (!isAvailable) return;

    const testFile = join(testDir, 'sandbox-test-allowed.txt');
    const testContent = 'This is a test file';

    // Verify the path is allowed
    expect(sandbox.isReadAllowed(testFile)).toBe(true);
    expect(sandbox.isWriteAllowed(testFile)).toBe(true);

    // Test writing
    const writeResult = await sandbox.executeCommand(
      ['sh', '-c', `echo "${testContent}" > ${testFile}`],
      { cwd: testDir }
    );
    expect(writeResult.exitCode).toBe(0);

    // Test reading
    const readResult = await sandbox.executeCommand(['cat', testFile], {
      cwd: testDir,
    });
    expect(readResult.exitCode).toBe(0);
    expect(readResult.stdout.trim()).toBe(testContent);

    // Cleanup
    await sandbox.executeCommand(['rm', testFile], { cwd: testDir });

    console.log(`✓ TEST 4 PASSED: Working directory read/write allowed`);
  });

  /**
   * TEST 5: Block Access to System Files
   * Claim: "Blocks access to /etc/passwd, /etc/shadow"
   */
  it('TEST 5: Should block access to sensitive system files', async () => {
    const isAvailable = await PlatformSandbox.isAvailable();
    if (!isAvailable) return;

    const systemFiles = ['/etc/shadow', '/etc/sudoers'];

    for (const file of systemFiles) {
      // First verify the path is blocked by permission checker
      expect(sandbox.isReadAllowed(file)).toBe(false);

      // Then verify actual execution is blocked
      const result = await sandbox.executeCommand(['cat', file], {
        cwd: testDir,
      });

      // Should fail (non-zero exit code) or be empty (permission denied)
      expect(result.exitCode).not.toBe(0);
      console.log(`  ✓ Blocked access to ${file} (exit code: ${result.exitCode})`);
    }

    console.log(`✓ TEST 5 PASSED: System file access blocked`);
  });

  /**
   * BONUS TEST: Verify subprocess isolation
   * Claim: "covers not just Claude Code's direct interactions, but also any scripts, programs, or subprocesses"
   */
  it('BONUS: Should block subprocesses from accessing sensitive files', async () => {
    const isAvailable = await PlatformSandbox.isAvailable();
    if (!isAvailable) return;

    const sshKeyPath = join(homedir(), '.ssh', 'id_rsa');

    // Try to access via a subprocess (sh -c)
    const result = await sandbox.executeCommand(
      ['sh', '-c', `cat ${sshKeyPath}`],
      { cwd: testDir }
    );

    // Should fail
    expect(result.exitCode).not.toBe(0);
    console.log(`✓ BONUS TEST PASSED: Subprocess also blocked from SSH keys`);
  });
});
