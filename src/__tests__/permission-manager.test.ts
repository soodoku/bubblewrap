/**
 * Tests for PermissionManager
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PermissionManager } from '../permission-manager.js';
import { PermissionType } from '../types.js';

describe('PermissionManager', () => {
  let manager: PermissionManager;

  beforeEach(() => {
    manager = new PermissionManager();
  });

  it('should create a permission manager', () => {
    expect(manager).toBeDefined();
  });

  it('should auto-approve configured permission types', async () => {
    manager.setAutoApprove([PermissionType.FILESYSTEM_READ]);

    const granted = await manager.request(
      PermissionType.FILESYSTEM_READ,
      '/tmp/test.txt'
    );

    expect(granted).toBe(true);
  });

  it('should check granted permissions', async () => {
    manager.setAutoApprove([PermissionType.FILESYSTEM_READ]);

    await manager.request(PermissionType.FILESYSTEM_READ, '/tmp/test.txt');

    expect(
      manager.check(PermissionType.FILESYSTEM_READ, '/tmp/test.txt')
    ).toBe(true);
  });

  it('should return false for non-granted permissions', () => {
    expect(
      manager.check(PermissionType.FILESYSTEM_WRITE, '/tmp/test.txt')
    ).toBe(false);
  });

  it('should revoke permissions', async () => {
    manager.setAutoApprove([PermissionType.FILESYSTEM_READ]);

    await manager.request(PermissionType.FILESYSTEM_READ, '/tmp/test.txt');
    expect(
      manager.check(PermissionType.FILESYSTEM_READ, '/tmp/test.txt')
    ).toBe(true);

    manager.revoke(PermissionType.FILESYSTEM_READ, '/tmp/test.txt');
    expect(
      manager.check(PermissionType.FILESYSTEM_READ, '/tmp/test.txt')
    ).toBe(false);
  });

  it('should clear all permissions', async () => {
    manager.setAutoApprove([
      PermissionType.FILESYSTEM_READ,
      PermissionType.FILESYSTEM_WRITE,
    ]);

    await manager.request(PermissionType.FILESYSTEM_READ, '/tmp/test.txt');
    await manager.request(PermissionType.FILESYSTEM_WRITE, '/tmp/test.txt');

    expect(manager.getAll().length).toBe(2);

    manager.clear();

    expect(manager.getAll().length).toBe(0);
  });

  it('should emit events on grant', async (context) => {
    return new Promise<void>((resolve) => {
      manager.setAutoApprove([PermissionType.FILESYSTEM_READ]);

      manager.on('granted', (data) => {
        expect(data.type).toBe(PermissionType.FILESYSTEM_READ);
        expect(data.resource).toBe('/tmp/test.txt');
        resolve();
      });

      manager.request(PermissionType.FILESYSTEM_READ, '/tmp/test.txt');
    });
  });
});
