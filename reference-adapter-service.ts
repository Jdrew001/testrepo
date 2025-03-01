import { Injectable } from '@angular/core';

/**
 * Type definitions for the adapter pattern
 */
export type AdapterMapping = Map<string, string>;

export interface EntityTypeConfig {
  /** Property name used as entity ID */
  entityIdProperty?: string;
  
  /** Function to identify entity arrays of this type */
  detector?: (data: any[]) => boolean;
  
  /** Function to extract the entity ID from an entity object */
  idExtractor?: (entity: any) => any;
}

@Injectable({
  providedIn: 'root'
})
export class ReferenceAdapterService {
  private fieldMappings: AdapterMapping = new Map<string, string>();
  private entityConfigs: Map<string, EntityTypeConfig> = new Map();
  private autoDetectionEnabled = true;

  constructor() {
    this.initializeDefaultDetectors();
  }

  registerFieldMapping(rootId: string, fieldName: string): void {
    this.fieldMappings.set(rootId, fieldName);
  }

  registerFieldMappings(mappings: Record<string, string>): void {
    for (const [rootId, fieldName] of Object.entries(mappings)) {
      this.registerFieldMapping(rootId, fieldName);
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
    this.fieldMappings.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  configureEntityType(entityType: string, config: EntityTypeConfig): void {
    if (config.entityIdProperty && !config.idExtractor) {
      config.idExtractor = (entity: any) => entity[config.entityIdProperty!];
    }
    if (config.entityIdProperty && !config.detector) {
      config.detector = (data: any[]) =>
        data.length > 0 && data[0][config.entityIdProperty!] !== undefined;
    }
    this.entityConfigs.set(entityType, config);
  }

  configureEntityTypes(configs: Record<string, EntityTypeConfig>): void {
    for (const [entityType, config] of Object.entries(configs)) {
      this.configureEntityType(entityType, config);
    }
  }

  setAutoDetection(enabled: boolean): void {
    this.autoDetectionEnabled = enabled;
  }

  detectEntityArray(rootId: string, data: any[]): { isEntity: boolean, entityType?: string } {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return { isEntity: false };
    }
    
    // 1) Check if we have an explicit config for this root
    if (this.entityConfigs.has(rootId)) {
      const cfg = this.entityConfigs.get(rootId)!;
      if (cfg.detector && cfg.detector(data)) {
        return { isEntity: true, entityType: rootId };
      }
    }
    
    // 2) If auto-detection is enabled, run the heuristics
    if (this.autoDetectionEnabled) {
      // 2a) See if it matches any known entityType config's detector
      for (const [entityType, cfg] of this.entityConfigs.entries()) {
        if (cfg.detector && cfg.detector(data)) {
          return { isEntity: true, entityType };
        }
      }
      // 2b) Fallback to generic detection
      if (this.isGenericEntityArray(data)) {
        return { isEntity: true, entityType: 'auto-detected' };
      }
    }
    
    return { isEntity: false };
  }

  extractEntityId(entityType: string | undefined, entity: any): any {
    if (entityType && this.entityConfigs.has(entityType)) {
      const config = this.entityConfigs.get(entityType)!;
      if (config.idExtractor) {
        return config.idExtractor(entity);
      }
      if (config.entityIdProperty && entity[config.entityIdProperty] !== undefined) {
        return entity[config.entityIdProperty];
      }
    }
    // Fallback
    return this.detectEntityId(entity);
  }

  /**
   * CORE HEURISTICS:
   *  1) Must have more than one item (otherwise skip).
   *  2) Must have a recognized ID property unique across items.
   *  3) Must have at least some nested object property (not purely flat).
   *  4) Optionally, check if at least one item has "children" or "childrent" or similarly nested structure.
   */
  private isGenericEntityArray(data: any[]): boolean {
    if (!data || data.length === 0) {
      return false;
    }

    // 1) If there's only 1 item, treat it as a plain array. 
    if (data.length === 1) {
      return false;
    }
    
    // Quick check: if the first item is not an object or is an array, skip
    const firstItem = data[0];
    if (!firstItem || typeof firstItem !== 'object' || Array.isArray(firstItem)) {
      return false;
    }

    // 2) Find an ID-like property across items and check for uniqueness
    const idProperty = this.findCommonIdProperty(data);
    if (!idProperty) {
      return false; // No ID-like property found
    }

    // 3) Check if there's at least some nested property to justify "entity" logic
    //    For instance, an object property, or a "children" array, etc.
    //    We'll check each item for an object prop or known nested patterns.
    let hasNested = false;
    for (const item of data) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        continue;
      }
      for (const prop in item) {
        if (!Object.prototype.hasOwnProperty.call(item, prop)) continue;
        const val = item[prop];
        if (val && typeof val === 'object') {
          hasNested = true;
          break;
        }
      }
      if (hasNested) break;
    }

    if (!hasNested) {
      return false; 
    }

    // Optional extra: if you want to ensure there's a "children" or "childrent" for truly hierarchical data,
    // you could do:
    // let hasChildren = data.some(item => (item.children && Array.isArray(item.children)) || (item.childrent && Array.isArray(item.childrent)));
    // if (!hasChildren) return false;
    
    // If we reach here, it has multiple items, a unique ID property, and nested structure => treat as entity array
    return true;
  }

  private findCommonIdProperty(data: any[]): string | undefined {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return undefined;
    }
    
    const idPatterns = ['id', 'code', 'key', 'num', 'uuid', 'guid', 'ref'];
    
    // Check first 5 items for candidate property names
    const sampleSize = Math.min(5, data.length);
    const propertyNames = new Set<string>();
    
    for (let i = 0; i < sampleSize; i++) {
      const item = data[i];
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        for (const k of Object.keys(item)) {
          propertyNames.add(k);
        }
      }
    }
    
    const candidateProps: string[] = [];
    propertyNames.forEach(prop => {
      const propLower = prop.toLowerCase();
      const isIdLike = idPatterns.some(pattern => propLower.includes(pattern));
      if (isIdLike) {
        // Check if it exists in all sampled items
        const existsInAll = data.slice(0, sampleSize).every(obj => 
          obj && typeof obj === 'object' && obj[prop] !== undefined
        );
        if (existsInAll) {
          candidateProps.push(prop);
        }
      }
    });
    
    if (candidateProps.length === 0) {
      return undefined;
    }
    
    // For each candidate, check if it is unique across up to 20 items
    for (const prop of candidateProps) {
      const seen = new Set();
      let isUnique = true;
      for (let i = 0; i < Math.min(data.length, 20); i++) {
        const val = data[i][prop];
        if (seen.has(val)) {
          isUnique = false;
          break;
        }
        seen.add(val);
      }
      if (isUnique) {
        return prop;
      }
    }

    // If none is truly unique, fallback to the first candidate
    return candidateProps[0];
  }

  private detectEntityId(entity: any): any {
    if (!entity || typeof entity !== 'object' || Array.isArray(entity)) {
      return this.generateFallbackId(entity);
    }
    
    const idPatterns = ['id', 'key', 'code', 'uuid', 'guid', 'Id', 'ID', 'Key', 'Code'];

    // Direct matches
    for (const pat of idPatterns) {
      if (entity[pat] !== undefined) {
        return entity[pat];
      }
    }
    
    // Partial matches
    const props = Object.keys(entity);
    for (const prop of props) {
      const pl = prop.toLowerCase();
      if (idPatterns.some(p => 
          pl === p.toLowerCase() || 
          pl.endsWith(p.toLowerCase()) || 
          pl.startsWith(p.toLowerCase()))
      ) {
        return entity[prop];
      }
    }
    
    // Fallback to name or title
    if (entity.name !== undefined) return `name-${entity.name}`;
    if (entity.title !== undefined) return `title-${entity.title}`;
    
    // If all else fails
    return this.generateFallbackId(entity);
  }

  private generateFallbackId(entity: any): string {
    let hash = 0;
    const str = JSON.stringify(entity);
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return `gen-${Math.abs(hash).toString(36)}`;
  }

  private initializeDefaultDetectors(): void {
    // No built-in detectors; you can add if needed
  }
}