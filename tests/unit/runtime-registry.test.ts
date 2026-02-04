/**
 * Runtime Registry Tests
 * 
 * Tests for runtime registration and retrieval
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RuntimeRegistryImpl } from '../../apps/api/src/services/skills/runtimes/registry';
import type { SkillRuntime } from '../../apps/api/src/services/skills/runtimes/types';

describe('Runtime Registry', () => {
  let registry: RuntimeRegistryImpl;
  
  beforeEach(() => {
    registry = new RuntimeRegistryImpl();
  });
  
  const createMockRuntime = (kind: string): SkillRuntime => ({
    kind,
    run: async () => ({
      success: true,
      output: {},
      rawOutput: '',
      normalizedOutput: {},
      metrics: {
        executionTimeMs: 0,
        retryCount: 0,
        toolsUsed: [],
      },
    }),
  });
  
  describe('register', () => {
    it('should register a runtime', () => {
      const runtime = createMockRuntime('test');
      
      registry.register(runtime);
      
      expect(registry.has('test')).toBe(true);
    });
    
    it('should allow multiple runtimes', () => {
      registry.register(createMockRuntime('runtime1'));
      registry.register(createMockRuntime('runtime2'));
      
      expect(registry.has('runtime1')).toBe(true);
      expect(registry.has('runtime2')).toBe(true);
    });
    
    it('should overwrite existing runtime with same kind', () => {
      const runtime1 = createMockRuntime('test');
      const runtime2 = createMockRuntime('test');
      
      registry.register(runtime1);
      registry.register(runtime2);
      
      const retrieved = registry.get('test');
      expect(retrieved).toBe(runtime2);
    });
  });
  
  describe('get', () => {
    it('should retrieve registered runtime', () => {
      const runtime = createMockRuntime('test');
      registry.register(runtime);
      
      const retrieved = registry.get('test');
      
      expect(retrieved).toBe(runtime);
    });
    
    it('should return undefined for unregistered runtime', () => {
      const retrieved = registry.get('non-existent');
      
      expect(retrieved).toBeUndefined();
    });
  });
  
  describe('has', () => {
    it('should return true for registered runtime', () => {
      registry.register(createMockRuntime('test'));
      
      expect(registry.has('test')).toBe(true);
    });
    
    it('should return false for unregistered runtime', () => {
      expect(registry.has('non-existent')).toBe(false);
    });
  });
  
  describe('list', () => {
    it('should return all registered runtime kinds', () => {
      registry.register(createMockRuntime('runtime1'));
      registry.register(createMockRuntime('runtime2'));
      registry.register(createMockRuntime('runtime3'));
      
      const kinds = registry.list();
      
      expect(kinds).toContain('runtime1');
      expect(kinds).toContain('runtime2');
      expect(kinds).toContain('runtime3');
      expect(kinds).toHaveLength(3);
    });
    
    it('should return empty array when no runtimes registered', () => {
      const kinds = registry.list();
      
      expect(kinds).toEqual([]);
    });
  });
});
