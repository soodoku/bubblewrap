/**
 * Network proxy for controlling outbound connections
 */

import { createServer, Server, Socket } from 'net';
import { connect as tlsConnect } from 'tls';
import { ProxyConfig, NetworkRequest } from './types.js';
import { EventEmitter } from 'events';

export class NetworkProxy extends EventEmitter {
  private server: Server | null = null;
  private approvedDomains = new Set<string>();

  constructor(private config: ProxyConfig) {
    super();
  }

  /**
   * Start the proxy server on a Unix socket
   */
  async start(): Promise<void> {
    if (this.server) {
      throw new Error('Proxy already running');
    }

    return new Promise((resolve, reject) => {
      this.server = createServer((client) => {
        this.handleConnection(client);
      });

      this.server.on('error', (error) => {
        this.emit('error', error);
      });

      this.server.listen(this.config.socketPath, () => {
        console.log(`Network proxy listening on ${this.config.socketPath}`);
        resolve();
      });

      this.server.on('error', reject);
    });
  }

  /**
   * Stop the proxy server
   */
  async stop(): Promise<void> {
    if (!this.server) {
      return;
    }

    return new Promise((resolve) => {
      this.server!.close(() => {
        this.server = null;
        resolve();
      });
    });
  }

  /**
   * Handle incoming connection from sandboxed process
   */
  private async handleConnection(client: Socket): Promise<void> {
    let buffer = '';

    const onData = async (data: Buffer) => {
      buffer += data.toString();

      // Parse HTTP CONNECT request (for HTTPS)
      const connectMatch = buffer.match(/CONNECT ([^\s]+):(\d+)/);
      if (connectMatch) {
        const host = connectMatch[1];
        const port = parseInt(connectMatch[2], 10);

        client.off('data', onData);

        const allowed = await this.checkAccess(host);
        if (!allowed) {
          client.write('HTTP/1.1 403 Forbidden\r\n\r\n');
          client.end();
          this.emit('blocked', { host, port });
          return;
        }

        // Forward the connection
        this.forwardConnect(client, host, port);
        return;
      }

      // Parse regular HTTP request
      const httpMatch = buffer.match(/^(GET|POST|PUT|DELETE|PATCH) ([^\s]+)/);
      if (httpMatch) {
        const urlMatch = buffer.match(/Host: ([^\r\n]+)/);
        if (urlMatch) {
          const host = urlMatch[1];

          client.off('data', onData);

          const allowed = await this.checkAccess(host);
          if (!allowed) {
            client.write('HTTP/1.1 403 Forbidden\r\n\r\n');
            client.end();
            this.emit('blocked', { host });
            return;
          }

          // Forward HTTP request
          this.forwardHttp(client, buffer, host);
          return;
        }
      }
    };

    client.on('data', onData);

    client.on('error', (error) => {
      console.error('Client error:', error.message);
    });
  }

  /**
   * Check if access to domain is allowed
   */
  private async checkAccess(host: string): Promise<boolean> {
    // Remove port if present
    const domain = host.split(':')[0];

    // Check blocklist first
    if (this.isBlocked(domain)) {
      return false;
    }

    // Check if already approved
    if (this.approvedDomains.has(domain)) {
      return true;
    }

    // Check allowlist
    if (this.isAllowed(domain)) {
      this.approvedDomains.add(domain);
      return true;
    }

    // Require approval for new domains
    if (this.config.requireApproval) {
      const approved = await this.requestApproval(domain);
      if (approved) {
        this.approvedDomains.add(domain);
      }
      return approved;
    }

    return false;
  }

  /**
   * Check if domain is in blocklist
   */
  private isBlocked(domain: string): boolean {
    return this.config.blockedDomains.some((blocked) =>
      this.matchesDomain(domain, blocked)
    );
  }

  /**
   * Check if domain is in allowlist
   */
  private isAllowed(domain: string): boolean {
    return this.config.allowedDomains.some((allowed) =>
      this.matchesDomain(domain, allowed)
    );
  }

  /**
   * Match domain against pattern (supports wildcards)
   */
  private matchesDomain(domain: string, pattern: string): boolean {
    if (pattern.startsWith('*.')) {
      const baseDomain = pattern.slice(2);
      return domain === baseDomain || domain.endsWith('.' + baseDomain);
    }
    return domain === pattern;
  }

  /**
   * Request approval from user for new domain
   */
  private async requestApproval(domain: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.emit('approval-required', {
        domain,
        approve: () => resolve(true),
        deny: () => resolve(false),
      });

      // Auto-deny after 30 seconds
      setTimeout(() => resolve(false), 30000);
    });
  }

  /**
   * Forward HTTPS CONNECT request
   */
  private forwardConnect(client: Socket, host: string, port: number): void {
    const remote = tlsConnect({ host, port, rejectUnauthorized: false });

    remote.on('connect', () => {
      client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      client.pipe(remote);
      remote.pipe(client);
    });

    remote.on('error', (error) => {
      console.error(`Remote connection error: ${error.message}`);
      client.end();
    });

    client.on('error', () => {
      remote.end();
    });
  }

  /**
   * Forward HTTP request
   */
  private forwardHttp(client: Socket, request: string, host: string): void {
    const [hostname, port = '80'] = host.split(':');
    const remote = connect(parseInt(port, 10), hostname);

    remote.on('connect', () => {
      remote.write(request);
      client.pipe(remote);
      remote.pipe(client);
    });

    remote.on('error', (error) => {
      console.error(`Remote connection error: ${error.message}`);
      client.end();
    });

    client.on('error', () => {
      remote.end();
    });
  }
}

// Helper function
function connect(port: number, host: string): Socket {
  const net = require('net');
  return net.connect({ port, host });
}
