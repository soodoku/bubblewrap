/**
 * Permission management system
 */

import { PermissionType, Permission } from './types.js';
import { EventEmitter } from 'events';

export class PermissionManager extends EventEmitter {
  private permissions = new Map<string, Permission>();
  private autoApprove: Set<PermissionType> = new Set();

  constructor() {
    super();
  }

  /**
   * Set which permission types should be auto-approved
   */
  setAutoApprove(types: PermissionType[]): void {
    this.autoApprove = new Set(types);
  }

  /**
   * Request permission for an action
   */
  async request(
    type: PermissionType,
    resource: string,
    details?: string
  ): Promise<boolean> {
    const key = this.getKey(type, resource);

    // Check if already granted
    const existing = this.permissions.get(key);
    if (existing?.granted && !this.isExpired(existing)) {
      return true;
    }

    // Auto-approve if configured
    if (this.autoApprove.has(type)) {
      this.grant(type, resource, false);
      return true;
    }

    // Request from user
    const granted = await this.promptUser(type, resource, details);

    if (granted) {
      this.grant(type, resource, false);
    } else {
      this.deny(type, resource);
    }

    return granted;
  }

  /**
   * Check if permission is granted
   */
  check(type: PermissionType, resource: string): boolean {
    const key = this.getKey(type, resource);
    const permission = this.permissions.get(key);

    if (!permission || !permission.granted) {
      return false;
    }

    if (this.isExpired(permission)) {
      this.permissions.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Grant a permission
   */
  private grant(
    type: PermissionType,
    resource: string,
    permanent: boolean
  ): void {
    const key = this.getKey(type, resource);
    this.permissions.set(key, {
      type,
      resource,
      granted: true,
      permanent,
      timestamp: Date.now(),
    });

    this.emit('granted', { type, resource });
  }

  /**
   * Deny a permission
   */
  private deny(type: PermissionType, resource: string): void {
    const key = this.getKey(type, resource);
    this.permissions.set(key, {
      type,
      resource,
      granted: false,
      permanent: false,
      timestamp: Date.now(),
    });

    this.emit('denied', { type, resource });
  }

  /**
   * Revoke a permission
   */
  revoke(type: PermissionType, resource: string): void {
    const key = this.getKey(type, resource);
    this.permissions.delete(key);
    this.emit('revoked', { type, resource });
  }

  /**
   * Clear all permissions
   */
  clear(): void {
    this.permissions.clear();
    this.emit('cleared');
  }

  /**
   * Get all granted permissions
   */
  getAll(): Permission[] {
    return Array.from(this.permissions.values()).filter((p) => p.granted);
  }

  /**
   * Prompt user for permission
   */
  private async promptUser(
    type: PermissionType,
    resource: string,
    details?: string
  ): Promise<boolean> {
    return new Promise((resolve) => {
      this.emit('approval-required', {
        type,
        resource,
        details,
        approve: () => resolve(true),
        deny: () => resolve(false),
      });

      // Auto-deny after 60 seconds
      setTimeout(() => resolve(false), 60000);
    });
  }

  /**
   * Get permission key
   */
  private getKey(type: PermissionType, resource: string): string {
    return `${type}:${resource}`;
  }

  /**
   * Check if permission is expired (non-permanent permissions expire after 1 hour)
   */
  private isExpired(permission: Permission): boolean {
    if (permission.permanent) {
      return false;
    }

    const ONE_HOUR = 60 * 60 * 1000;
    return Date.now() - permission.timestamp > ONE_HOUR;
  }
}
