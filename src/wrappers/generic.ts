/**
 * Generic tool wrapper with convenience methods
 * Use this for any coding assistant or command-line tool
 */

import { CommandWrapper } from '../command-wrapper.js';
import { CommandResult } from '../types.js';

/**
 * Generic wrapper with convenience methods for common tools
 */
export class GenericToolWrapper extends CommandWrapper {
  /**
   * Run any npm script in the sandbox
   */
  async runNpm(script: string, args: string[] = []): Promise<CommandResult> {
    return this.execute(['npm', 'run', script, ...args]);
  }

  /**
   * Run git commands in the sandbox
   */
  async runGit(args: string[]): Promise<CommandResult> {
    return this.execute(['git', ...args]);
  }

  /**
   * Run python scripts in the sandbox
   */
  async runPython(script: string, args: string[] = []): Promise<CommandResult> {
    return this.execute(['python', script, ...args]);
  }

  /**
   * Run node scripts in the sandbox
   */
  async runNode(script: string, args: string[] = []): Promise<CommandResult> {
    return this.execute(['node', script, ...args]);
  }

  /**
   * Install npm packages (restricted to working directory)
   */
  async npmInstall(packages: string[] = []): Promise<CommandResult> {
    const args = ['install'];
    if (packages.length > 0) {
      args.push(...packages);
    }
    return this.execute(['npm', ...args]);
  }

  /**
   * Install pip packages (restricted to working directory)
   */
  async pipInstall(packages: string[] = []): Promise<CommandResult> {
    return this.execute(['pip', 'install', ...packages]);
  }

  /**
   * Run make targets
   */
  async runMake(target: string = ''): Promise<CommandResult> {
    const args = target ? ['make', target] : ['make'];
    return this.execute(args);
  }

  /**
   * Run cargo commands (Rust)
   */
  async runCargo(subcommand: string, args: string[] = []): Promise<CommandResult> {
    return this.execute(['cargo', subcommand, ...args]);
  }
}
