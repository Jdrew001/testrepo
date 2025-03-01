import { Injectable } from '@angular/core';

/**
 * Maps for root ID renaming ("entity" -> "aeGrid")
 */
export type AdapterMapping = Map<string, string>;

/**
 * Configuration for known entity types (optional).
 */
export interface EntityTypeConfig {
  entityIdProperty?: string;
  detector?: (data: any[]) => boolean;
  idExtractor?: (entity: any) => any;
}

@Injectable({ providedIn: 'root' })
export class ReferenceAdapterService {
  private fieldMappings: AdapterMapping = new Map<string, string>();
  private entityConfigs: Map<string, EntityTypeConfig> = new Map();
  private autoDetectionEnabled = true;
  private debugLogs = false;

  constructor() {}

  //--- Public Mapping Methods ---

  registerFieldMapping(rootId: string, fieldName: string): void {
    this.fieldMappings.set(rootId, fieldName);
  }
  registerFieldMappings(mappings: Record<string, string>): void {
    for (const [root, field] of Object.entries(mappings)) {
      this.fieldMappings.set(root, field);
    }
  }
  getFieldName(rootId: string): string {
    return this.fieldMappings.get(rootId) || rootId;
  }
  clearMappings(): void { this.fieldMappings.clear(); }
  getAllMappings(): Record<string, string> {
    const out: Record<string, string> = {};
    this.fieldMappings.forEach((val, key) => { out[key] = val; });
    return out;
  }

  //--- Entity Detection Methods ---

  configureEntityType(entityType: string, config: EntityTypeConfig): void {
    if (config.entityIdProperty && !config.idExtractor) {
      config.idExtractor = (obj: any) => obj[config.entityIdProperty!];
    }
    if (config.entityIdProperty && !config.detector) {
      config.detector = (arr: any[]) => arr.length > 0 && arr[0][config.entityIdProperty!] !== undefined;
    }
    this.entityConfigs.set(entityType, config);
  }
  configureEntityTypes(configs: Record<string, EntityTypeConfig>): void {
    for (const [et, cfg] of Object.entries(configs)) {
      this.configureEntityType(et, cfg);
    }
  }
  setAutoDetection(enabled: boolean): void { this.autoDetectionEnabled = enabled; }
  setDebugLogs(enabled: boolean): void { this.debugLogs = enabled; }

  detectEntityArray(rootId: string, data: any[]): { isEntity: boolean; entityType?: string } {
    // Must be a non-empty array
    if (!data || !Array.isArray(data) || data.length === 0) {
      return { isEntity: false };
    }

    // 1) If we have a config for this root, check it
    if (this.entityConfigs.has(rootId)) {
      const cfg = this.entityConfigs.get(rootId)!;
      if (cfg.detector && cfg.detector(data)) {
        if (this.debugLogs) console.log(`[Adapter] root=${rootId}: config.detector => entity array`);
        return { isEntity: true, entityType: rootId };
      }
    }
    // 2) If auto-detection, check each config & fallback
    if (this.autoDetectionEnabled) {
      for (const [etype, cfg] of this.entityConfigs.entries()) {
        if (cfg.detector && cfg.detector(data)) {
          if (this.debugLogs) console.log(`[Adapter] auto-detected => type=${etype}`);
          return { isEntity: true, entityType: etype };
        }
      }
      // fallback
      if (this.isGenericEntityArray(data, rootId)) {
        if (this.debugLogs) console.log(`[Adapter] fallback => entity, root=${rootId}`);
        return { isEntity: true, entityType: 'auto-detected' };
      }
    }
    if (this.debugLogs) console.log(`[Adapter] root=${rootId}: not entity => false`);
    return { isEntity: false };
  }

  extractEntityId(entityType: string | undefined, entity: any): any {
    if (entityType && this.entityConfigs.has(entityType)) {
      const cfg = this.entityConfigs.get(entityType)!;
      if (cfg.idExtractor) return cfg.idExtractor(entity);
      if (cfg.entityIdProperty && entity[cfg.entityIdProperty] !== undefined) {
        return entity[cfg.entityIdProperty];
      }
    }
    return this.detectEntityId(entity);
  }

  //--- The "Fully Dynamic" version: no single-item skip, find ID-like property. ---
  private isGenericEntityArray(data: any[], rootId: string): boolean {
    if (!data || data.length === 0) return false;
    // *** We do NOT skip single-item arrays. ***

    // Find an ID-like property in each item
    const idProp = this.findCommonIdProperty(data);
    if (!idProp) {
      if (this.debugLogs) console.log(`[Adapter] root=${rootId} => no ID-like property => skip`);
      return false;
    }
    // Optional: check if there's nested structure, or skip that if you want everything
    return true;
  }

  private findCommonIdProperty(data: any[]): string | undefined {
    const idPatterns = ['id','code','key','aeid','uuid','guid','ref'];
    const sampleSize = Math.min(data.length, 5);

    const propertyNames = new Set<string>();
    for (let i=0; i<sampleSize; i++) {
      const item = data[i];
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        Object.keys(item).forEach(k => propertyNames.add(k));
      }
    }
    const candidates: string[] = [];
    propertyNames.forEach(prop => {
      const lower = prop.toLowerCase();
      const isIdLike = idPatterns.some(p => lower.includes(p));
      if (isIdLike) {
        // check if it exists in all sampled items
        let existsInAll = true;
        for (let i=0; i<sampleSize; i++) {
          if (!data[i] || data[i][prop] === undefined) {
            existsInAll = false;
            break;
          }
        }
        if (existsInAll) candidates.push(prop);
      }
    });
    if (!candidates.length) return undefined;

    // check uniqueness among up to 20 items
    for (const prop of candidates) {
      const seen = new Set();
      let isUnique = true;
      for (let i=0; i<Math.min(data.length, 20); i++) {
        const val = data[i][prop];
        if (seen.has(val)) {
          isUnique = false; break;
        }
        seen.add(val);
      }
      if (isUnique) return prop;
    }
    // fallback to first if none truly unique
    return candidates[0];
  }

  private detectEntityId(obj: any): any {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      return this.generateFallbackId(obj);
    }
    const patterns = ['id','aeid','code','key','uuid','guid','Id','ID','Key','Code'];
    // direct matches
    for (const pat of patterns) {
      if (obj[pat] !== undefined) return obj[pat];
    }
    // partial matches
    const keys = Object.keys(obj);
    for (const k of keys) {
      const lower = k.toLowerCase();
      if (patterns.some(pt =>
          lower === pt.toLowerCase() ||
          lower.endsWith(pt.toLowerCase()) ||
          lower.startsWith(pt.toLowerCase())
      )) {
        return obj[k];
      }
    }
    if (obj.name !== undefined) return `name-${obj.name}`;
    if (obj.title !== undefined) return `title-${obj.title}`;
    return this.generateFallbackId(obj);
  }

  private generateFallbackId(value: any): string {
    let hash = 0;
    const str = JSON.stringify(value);
    for (let i=0; i<str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return `gen-${Math.abs(hash).toString(36)}`;
  }
}