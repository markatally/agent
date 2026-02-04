import type { RuntimeRegistry, SkillRuntime } from './types';

export class RuntimeRegistryImpl implements RuntimeRegistry {
  private runtimes = new Map<string, SkillRuntime>();

  get(kind: string): SkillRuntime | undefined {
    return this.runtimes.get(kind);
  }

  has(kind: string): boolean {
    return this.runtimes.has(kind);
  }

  register(runtime: SkillRuntime): void {
    this.runtimes.set(runtime.kind, runtime);
  }

  list(): readonly string[] {
    return Array.from(this.runtimes.keys());
  }
}

let registryInstance: RuntimeRegistry | null = null;

export function getRuntimeRegistry(): RuntimeRegistry {
  if (!registryInstance) {
    registryInstance = new RuntimeRegistryImpl();
  }
  return registryInstance;
}
