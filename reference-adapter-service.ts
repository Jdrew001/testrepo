import { Injectable } from '@angular/core';

/**
 * Type definitions for the adapter pattern
 */
export type AdapterMapping = Map<string, string>;

/**
 * Interface for dynamic entity configuration
 */
export interface EntityTypeConfig {
  /** Property name used as entity ID (e.g., "aeId" or "id") */
  entityIdProperty?: string;
  
  /**
   * Function that identifies if an array of items belongs to this entity type.
   * If it returns true, the array is treated as an "entity array."
   */
  detector?: (data: any[]) => boolean;
  
  /**
   * Function that extracts an ID from a single entity object.
   * e.g. (entity) => entity.aeId
   */
  idExtractor?: (entity: any) => any;
}

/**
 * ReferenceAdapterService handles:
 *  - root key mappings ("entity" -> "aeGrid")
 *  - entity detection heuristics (ID patterns, nested objects, etc.)
 *  - ID extraction or fallback generation
 * 
 * By default, it uses auto-detection to decide if an array is an "entity array."
 * You can customize or override that with configureEntityType(...) or setAutoDetection(false).
 */
@Injectable({
  providedIn: 'root'
})
export class ReferenceAdapterService {
  /**
   * Maps a rootId (like "entity") to a field name (like "aeGrid").
   */
  private fieldMappings: AdapterMapping = new Map<string, string>();
  
  /**
   * Stores entity configurations keyed by rootId or a custom type name.
   */
  private entityConfigs: Map<string, EntityTypeConfig> = new Map();
  
  /**
   * If true, we do auto-detection of entity arrays with heuristics.
   */
  private autoDetectionEnabled = true;

  /**
   * If true, we log debug info about the heuristic detection in the console.
   */
  private debugLogs = false;
  
  constructor() {
    this.initializeDefaultDetectors();
  }

  // -----------------------------------------------------------------------
  // PUBLIC CONFIGURATION METHODS
  // -----------------------------------------------------------------------

  /**
   * Register a single rootId -> fieldName mapping.
   * e.g. "entity" -> "aeGrid"
   */
  registerFieldMapping(rootId: string, fieldName: string): void {
    this.fieldMappings.set(rootId, fieldName);
  }

  /**
   * Register multiple rootId -> fieldName mappings at once.
   */
  registerFieldMappings(mappings: Record<string, string>): void {
    for (const [rootId, fieldName] of Object.entries(mappings)) {
      this.registerFieldMapping(rootId, fieldName);
    }
  }

  /**
   * Get the mapped field name for a given rootId.
   * If none is found, returns the original rootId.
   */
  getFieldName(rootId: string): string {
    return this.fieldMappings.get(rootId) || rootId;
  }

  /**
   * Clear all rootId -> fieldName mappings.
   */
  clearMappings(): void {
    this.fieldMappings.clear();
  }

  /**
   * Return all current mappings as a simple object.
   */
  getAllMappings(): Record<string, string> {
    const result: Record<string, string> = {};
    this.fieldMappings.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  /**
   * Configure detection/extraction for a particular entity type or rootId.
   * e.g. specify entityIdProperty to force a certain ID.
   */
  configureEntityType(entityType: string, config: EntityTypeConfig): void {
    // If they specify entityIdProperty but no idExtractor, create one
    if (config.entityIdProperty && !config.idExtractor) {
      config.idExtractor = (entity: any) => entity[config.entityIdProperty!];
    }
    // If they specify entityIdProperty but no detector, create a simple one
    if (config.entityIdProperty && !config.detector) {
      config.detector = (data: any[]) =>
        data.length > 0 && data[0][config.entityIdProperty!] !== undefined;
    }
    this.entityConfigs.set(entityType, config);
  }

  /**
   * Configure multiple entity types at once.
   */
  configureEntityTypes(configs: Record<string, EntityTypeConfig>): void {
    for (const [entityType, config] of Object.entries(configs)) {
      this.configureEntityType(entityType, config);
    }
  }

  /**
   * Enable or disable auto-detection heuristics.
   */
  setAutoDetection(enabled: boolean): void {
    this.autoDetectionEnabled = enabled;
  }

  /**
   * Toggle debug logs for detection heuristics.
   */
  setDebugLogs(enabled: boolean): void {
    this.debugLogs = enabled;
  }

  // -----------------------------------------------------------------------
  // ENTITY DETECTION & ID EXTRACTION
  // -----------------------------------------------------------------------

  /**
   * Check if an array is an entity array and identify its type.
   * Returns { isEntity, entityType? }.
   */
  detectEntityArray(rootId: string, data: any[]): { isEntity: boolean, entityType?: string } {
    // If no data or empty array, not an entity array
    if (!data || !Array.isArray(data) || data.length === 0) {
      return { isEntity: false };
    }

    // 1) If we have a config for this specific rootId, try that
    if (this.entityConfigs.has(rootId)) {
      const config = this.entityConfigs.get(rootId)!;
      if (config.detector && config.detector(data)) {
        if (this.debugLogs) {
          console.log(`[Adapter] root=${rootId}: custom detector => entity array`);
        }
        return { isEntity: true, entityType: rootId };
      }
    }
    
    // 2) If auto detection is on, use heuristics
    if (this.autoDetectionEnabled) {
      // 2a) Check if it matches any known entity type config's detector
      for (const [entityType, config] of this.entityConfigs.entries()) {
        if (config.detector && config.detector(data)) {
          if (this.debugLogs) {
            console.log(`[Adapter] auto-detected array for type=${entityType}`);
          }
          return { isEntity: true, entityType };
        }
      }
      
      // 2b) Fallback to generic detection
      const isGeneric = this.isGenericEntityArray(data, rootId);
      if (isGeneric) {
        if (this.debugLogs) {
          console.log(`[Adapter] fallback => entity array, root=${rootId}`);
        }
        return { isEntity: true, entityType: 'auto-detected' };
      }
    }
    
    // Otherwise, not an entity array
    if (this.debugLogs) {
      console.log(`[Adapter] root=${rootId}: array => not an entity array`);
    }
    return { isEntity: false };
  }

  /**
   * Extract or detect the ID for a single entity object.
   * If an entityType is known, we use its config. Otherwise fallback to heuristics.
   */
  extractEntityId(entityType: string | undefined, entity: any): any {
    // If we have a config for this entity type, use that
    if (entityType && this.entityConfigs.has(entityType)) {
      const config = this.entityConfigs.get(entityType)!;
      if (config.idExtractor) {
        return config.idExtractor(entity);
      }
      if (config.entityIdProperty && entity[config.entityIdProperty] !== undefined) {
        return entity[config.entityIdProperty];
      }
    }
    
    // Otherwise, fallback to generic detection
    return this.detectEntityId(entity);
  }

  // -----------------------------------------------------------------------
  // HELPER METHODS
  // -----------------------------------------------------------------------

  /**
   * Generic detection logic:
   *   1) Must have more than 1 item (single-item => skip).
   *   2) Must have a recognized unique ID-like property across items.
   *   3) Must have at least some nested object property.
   */
  private isGenericEntityArray(data: any[], rootId: string): boolean {
    if (this.debugLogs) {
      console.log(`[Adapter] Checking isGenericEntityArray, root=${rootId}, length=${data.length}`);
    }
    
    if (!data || data.length === 0) {
      return false;
    }
    // 1) skip if only one item
    if (data.length === 1) {
      if (this.debugLogs) {
        console.log(`[Adapter] root=${rootId} => single-item => not entity`);
      }
      return false;
    }

    // 2) check for an ID-like property
    const idProperty = this.findCommonIdProperty(data);
    if (!idProperty) {
      if (this.debugLogs) {
        console.log(`[Adapter] root=${rootId}: no ID-like property => skip`);
      }
      return false;
    }
    if (this.debugLogs) {
      console.log(`[Adapter] root=${rootId}: found ID=${idProperty}, checking nested...`);
    }
    
    // 3) check for nested objects
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
      if (this.debugLogs) {
        console.log(`[Adapter] root=${rootId}: no nested => skip`);
      }
      return false;
    }
    
    // => multiple items, has unique ID, has nested => entity array
    if (this.debugLogs) {
      console.log(`[Adapter] root=${rootId}: multi items + ID + nested => entity`);
    }
    return true;
  }

  /**
   * Find a common ID-like property across an array (e.g. "id", "code", "key", "uuid", etc.).
   * Must exist in all sampled items, and be unique among them.
   */
  private findCommonIdProperty(data: any[]): string | undefined {
    if (!data || data.length === 0) return undefined;
    
    const idPatterns = ['id', 'code', 'key', 'num', 'uuid', 'guid', 'ref'];
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
      const lower = prop.toLowerCase();
      const isIdLike = idPatterns.some(p => lower.includes(p));
      if (isIdLike) {
        // check if this prop exists in all sampled items
        const existsInAll = data.slice(0, sampleSize).every(
          obj => obj && typeof obj === 'object' && obj[prop] !== undefined
        );
        if (existsInAll) {
          candidateProps.push(prop);
        }
      }
    });
    if (candidateProps.length === 0) return undefined;
    
    // check for uniqueness among up to 20 items
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
    
    // fallback: if no truly unique property, return the first candidate
    return candidateProps[0];
  }

  /**
   * Detect an ID from a single object using heuristics:
   *  - direct properties "id", "code", "key", etc.
   *  - partial name matches
   *  - fallback to name, title
   *  - else generate a fallback
   */
  private detectEntityId(entity: any): any {
    if (!entity || typeof entity !== 'object' || Array.isArray(entity)) {
      return this.generateFallbackId(entity);
    }
    
    const idPatterns = ['id', 'aeid', 'code', 'key', 'uuid', 'guid', 'Id', 'ID', 'Key', 'Code'];
    
    // direct matches
    for (const pat of idPatterns) {
      if (entity[pat] !== undefined) {
        return entity[pat];
      }
    }
    
    // partial name matches
    const props = Object.keys(entity);
    for (const prop of props) {
      const lower = prop.toLowerCase();
      if (idPatterns.some(p => 
          lower === p.toLowerCase() ||
          lower.endsWith(p.toLowerCase()) ||
          lower.startsWith(p.toLowerCase())
      )) {
        return entity[prop];
      }
    }
    
    // fallback to name or title
    if (entity.name !== undefined) return `name-${entity.name}`;
    if (entity.title !== undefined) return `title-${entity.title}`;
    
    // fallback
    return this.generateFallbackId(entity);
  }

  /**
   * Generate a fallback ID by hashing the JSON string of the entity.
   */
  private generateFallbackId(entity: any): string {
    let hash = 0;
    const str = JSON.stringify(entity);
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0; // convert to 32-bit int
    }
    return `gen-${Math.abs(hash).toString(36)}`;
  }

  /**
   * No built-in detectors by default; can add if desired.
   */
  private initializeDefaultDetectors(): void {
    // no default
  }
}