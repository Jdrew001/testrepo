import { Injectable } from '@angular/core';

export type AdapterMapping = Map<string, string>;

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

  constructor() {
    this.initializeDefaultDetectors();
  }

  registerFieldMapping(rootId: string, fieldName: string): void {
    this.fieldMappings.set(rootId, fieldName);
  }

  registerFieldMappings(mappings: Record<string, string>): void {
    for (const [rootId, fieldName] of Object.entries(mappings)) {
      this.fieldMappings.set(rootId, fieldName);
    }
  }

  getFieldName(rootId: string): string {
    return this.fieldMappings.get(rootId) || rootId;
  }

  clearMappings(): void {
    this.fieldMappings.clear();
  }

  getAllMappings(): Record<string, string> {
    const result: Record<string, string> = {};
    this.fieldMappings.forEach((val, key) => {
      result[key] = val;
    });
    return result;
  }

  configureEntityType(entityType: string, cfg: EntityTypeConfig): void {
    if (cfg.entityIdProperty && !cfg.idExtractor) {
      cfg.idExtractor = (entity: any) => entity[cfg.entityIdProperty!];
    }
    if (cfg.entityIdProperty && !cfg.detector) {
      cfg.detector = (data: any[]) =>
        data.length > 0 && data[0][cfg.entityIdProperty!] !== undefined;
    }
    this.entityConfigs.set(entityType, cfg);
  }

  configureEntityTypes(configs: Record<string, EntityTypeConfig>): void {
    for (const [type, cfg] of Object.entries(configs)) {
      this.configureEntityType(type, cfg);
    }
  }

  setAutoDetection(enabled: boolean): void {
    this.autoDetectionEnabled = enabled;
  }

  setDebugLogs(enabled: boolean): void {
    this.debugLogs = enabled;
  }

  detectEntityArray(rootId: string, data: any[]): { isEntity: boolean; entityType?: string } {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return { isEntity: false };
    }

    if (this.entityConfigs.has(rootId)) {
      const config = this.entityConfigs.get(rootId)!;
      if (config.detector && config.detector(data)) {
        if (this.debugLogs) {
          console.log(`[Adapter] root=${rootId}: custom => entity array`);
        }
        return { isEntity: true, entityType: rootId };
      }
    }

    if (this.autoDetectionEnabled) {
      for (const [type, cfg] of this.entityConfigs.entries()) {
        if (cfg.detector && cfg.detector(data)) {
          if (this.debugLogs) {
            console.log(`[Adapter] auto-detected => ${type}`);
          }
          return { isEntity: true, entityType: type };
        }
      }
      if (this.isGenericEntityArray(data, rootId)) {
        if (this.debugLogs) {
          console.log(`[Adapter] fallback => entity, root=${rootId}`);
        }
        return { isEntity: true, entityType: 'auto-detected' };
      }
    }

    if (this.debugLogs) {
      console.log(`[Adapter] root=${rootId}: not entity array`);
    }
    return { isEntity: false };
  }

  extractEntityId(entityType: string | undefined, entity: any): any {
    if (entityType && this.entityConfigs.has(entityType)) {
      const cfg = this.entityConfigs.get(entityType)!;
      if (cfg.idExtractor) {
        return cfg.idExtractor(entity);
      }
      if (cfg.entityIdProperty && entity[cfg.entityIdProperty] !== undefined) {
        return entity[cfg.entityIdProperty];
      }
    }
    return this.detectEntityId(entity);
  }

  private isGenericEntityArray(data: any[], rootId: string): boolean {
    if (!data || data.length === 0) return false;
    // If single-item, skip:
    if (data.length === 1) return false;
    // Must find an ID-like property
    const idProp = this.findCommonIdProperty(data);
    if (!idProp) return false;
    // Must have nested objects
    let hasNested = false;
    for (const item of data) {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        for (const p in item) {
          if (item[p] && typeof item[p] === 'object') {
            hasNested = true;
            break;
          }
        }
        if (hasNested) break;
      }
    }
    return hasNested;
  }

  private findCommonIdProperty(data: any[]): string | undefined {
    const patterns = ['id','code','key','num','uuid','guid','ref'];
    const sample = Math.min(data.length, 5);
    const propNames = new Set<string>();

    for (let i=0; i<sample; i++) {
      const it = data[i];
      if (it && typeof it === 'object' && !Array.isArray(it)) {
        Object.keys(it).forEach(k => propNames.add(k));
      }
    }
    const candidateProps: string[] = [];
    propNames.forEach(prop => {
      const lower = prop.toLowerCase();
      const isIdLike = patterns.some(p => lower.includes(p));
      if (isIdLike) {
        // check if it exists in all sampled
        let existInAll = true;
        for (let i=0; i<sample; i++) {
          if (!data[i] || data[i][prop] === undefined) {
            existInAll = false; 
            break;
          }
        }
        if (existInAll) candidateProps.push(prop);
      }
    });
    if (!candidateProps.length) return undefined;

    // check uniqueness
    for (const prop of candidateProps) {
      const seen = new Set();
      let unique = true;
      for (let i=0; i<Math.min(data.length,20); i++) {
        const val = data[i][prop];
        if (seen.has(val)) {
          unique = false; break;
        }
        seen.add(val);
      }
      if (unique) return prop;
    }
    return candidateProps[0];
  }

  private detectEntityId(obj: any): any {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      return this.generateFallbackId(obj);
    }
    const pats = ['id','aeid','code','key','uuid','guid','Id','ID','Key','Code'];
    for (const pat of pats) {
      if (obj[pat] !== undefined) return obj[pat];
    }
    const keys = Object.keys(obj);
    for (const k of keys) {
      const lower = k.toLowerCase();
      if (pats.some(p =>
        lower === p.toLowerCase() ||
        lower.endsWith(p.toLowerCase()) ||
        lower.startsWith(p.toLowerCase())
      )) {
        return obj[k];
      }
    }
    if (obj.name !== undefined) return `name-${obj.name}`;
    if (obj.title !== undefined) return `title-${obj.title}`;
    return this.generateFallbackId(obj);
  }

  private generateFallbackId(entity: any): string {
    let hash=0;
    const str = JSON.stringify(entity);
    for (let i=0; i<str.length; i++) {
      hash = ((hash<<5)-hash)+str.charCodeAt(i);
      hash|=0;
    }
    return `gen-${Math.abs(hash).toString(36)}`;
  }

  private initializeDefaultDetectors(): void {
    // no built-in
  }
}