import { Injectable } from '@angular/core';

/**
 * Type definitions for the adapter pattern
 */
export type AdapterMapping = Map<string, string>;

/**
 * Interface for dynamic entity configuration
 */
export interface EntityTypeConfig {
  /** Property name used as entity ID (e.g., 'aeId' or 'id') */
  entityIdProperty?: string;
  
  /** Function to identify entity arrays of this type */
  detector?: (data: any[]) => boolean;
  
  /** Function to extract the entity ID from an entity object */
  idExtractor?: (entity: any) => any;
}

/**
 * ReferenceAdapterService handles field name mappings and transformations
 * This service is responsible for the adapter pattern functionality only
 */
@Injectable({
  providedIn: 'root'
})
export class ReferenceAdapterService {
  private fieldMappings: AdapterMapping = new Map<string, string>();
  
  // Map of entity type configurations (key = entity type name or root ID)
  private entityConfigs: Map<string, EntityTypeConfig> = new Map();
  
  // Auto-detection enabled flag
  private autoDetectionEnabled = true;
  
  constructor() {
    // Initialize with default entity detectors and extractors
    this.initializeDefaultDetectors();
  }

  /**
   * Register a rootId to field name mapping in the adapter
   * @param rootId The original root ID to be replaced
   * @param fieldName The field name to replace it with
   */
  registerFieldMapping(rootId: string, fieldName: string): void {
    this.fieldMappings.set(rootId, fieldName);
  }

  /**
   * Register multiple field mappings at once
   * @param mappings Object containing rootId to fieldName mappings
   */
  registerFieldMappings(mappings: Record<string, string>): void {
    for (const [rootId, fieldName] of Object.entries(mappings)) {
      this.registerFieldMapping(rootId, fieldName);
    }
  }

  /**
   * Get the transformed field name for a given rootId
   * @param rootId The original root ID
   * @returns The mapped field name or the original if no mapping exists
   */
  getFieldName(rootId: string): string {
    return this.fieldMappings.get(rootId) || rootId;
  }

  /**
   * Clear all registered field mappings
   */
  clearMappings(): void {
    this.fieldMappings.clear();
  }

  /**
   * Get all registered field mappings
   * @returns Object containing all rootId to fieldName mappings
   */
  getAllMappings(): Record<string, string> {
    const result: Record<string, string> = {};
    this.fieldMappings.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }
  
  /**
   * Configure an entity type
   * @param entityType The entity type name or root ID
   * @param config The configuration for this entity type
   */
  configureEntityType(entityType: string, config: EntityTypeConfig): void {
    // Create default extractors based on property name if provided
    if (config.entityIdProperty && !config.idExtractor) {
      config.idExtractor = (entity: any) => entity[config.entityIdProperty!];
    }
    
    if (config.entityIdProperty && !config.detector) {
      config.detector = (data: any[]) => 
        data.length > 0 && data[0][config.entityIdProperty!] !== undefined;
    }
    
    this.entityConfigs.set(entityType, config);
  }
  
  /**
   * Configure multiple entity types at once
   * @param configs Map of entity type names to configurations
   */
  configureEntityTypes(configs: Record<string, EntityTypeConfig>): void {
    for (const [entityType, config] of Object.entries(configs)) {
      this.configureEntityType(entityType, config);
    }
  }
  
  /**
   * Enable or disable automatic entity detection
   * @param enabled Whether auto-detection should be enabled
   */
  setAutoDetection(enabled: boolean): void {
    this.autoDetectionEnabled = enabled;
  }
  
  /**
   * Check if an array is an entity array and identify its type
   * @param rootId The root ID (can be used to identify entity type)
   * @param data The array to check
   * @returns Object with isEntity flag and entityType if detected
   */
  detectEntityArray(rootId: string, data: any[]): { isEntity: boolean, entityType?: string } {
    // If no data or empty array, not an entity array
    if (!data || !Array.isArray(data) || data.length === 0) {
      return { isEntity: false };
    }
    
    // First check if we have a specific configuration for this root
    if (this.entityConfigs.has(rootId)) {
      const config = this.entityConfigs.get(rootId)!;
      if (config.detector && config.detector(data)) {
        return { isEntity: true, entityType: rootId };
      }
    }
    
    // If auto-detection is enabled, try to detect entity arrays automatically
    if (this.autoDetectionEnabled) {
      // Check if this matches any configured entity types
      for (const [entityType, config] of this.entityConfigs.entries()) {
        if (config.detector && config.detector(data)) {
          return { isEntity: true, entityType };
        }
      }
      
      // Try generic detection heuristics if no specific match
      if (this.isGenericEntityArray(data)) {
        return { isEntity: true, entityType: 'auto-detected' };
      }
    }
    
    return { isEntity: false };
  }
  
  /**
   * Try to extract an entity ID using the best matching extractor or heuristics
   * @param entityType Entity type if known, or undefined for auto-detection
   * @param entity The entity object
   * @returns The extracted entity ID
   */
  extractEntityId(entityType: string | undefined, entity: any): any {
    // If we have a specific configuration for this entity type, use it
    if (entityType && this.entityConfigs.has(entityType)) {
      const config = this.entityConfigs.get(entityType)!;
      if (config.idExtractor) {
        return config.idExtractor(entity);
      }
      if (config.entityIdProperty && entity[config.entityIdProperty] !== undefined) {
        return entity[config.entityIdProperty];
      }
    }
    
    // Otherwise, use generic ID detection heuristics
    return this.detectEntityId(entity);
  }
  
  /**
   * Detect if an array is likely an entity array using heuristics.
   * UPDATE: we only treat it as an entity array if it has nested objects (not flat).
   */
  private isGenericEntityArray(data: any[]): boolean {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return false;
    }
    
    const firstItem = data[0];
    
    // If not an object or it's itself an array, it's not an entity array
    if (!firstItem || typeof firstItem !== 'object' || Array.isArray(firstItem)) {
      return false;
    }

    // 1) Check if at least one item has nested object properties (meaning it's truly hierarchical).
    let hasNested = false;
    for (const item of data) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        continue;
      }
      // Check properties
      for (const prop in item) {
        if (!Object.prototype.hasOwnProperty.call(item, prop)) continue;
        const val = item[prop];
        // If we find a nested object/array, break
        if (val && typeof val === 'object') {
          hasNested = true;
          break;
        }
      }
      if (hasNested) break;
    }
    
    // If no nested structure, skip entity array logic
    if (!hasNested) {
      return false;
    }
    
    // 2) If there's a property that looks like an ID, we treat this as an entity array
    const idProperty = this.findCommonIdProperty(data);
    if (idProperty) {
      return true;
    }
    
    // 3) Otherwise, check for consistent structure across items
    const sampleProperties = Object.keys(firstItem);
    if (sampleProperties.length > 0) {
      const consistent = data.slice(1, Math.min(10, data.length)).every(item => {
        if (!item || typeof item !== 'object') return false;
        const itemProps = Object.keys(item);
        // Require at least 75% property overlap as a heuristic
        const matching = itemProps.filter(p => sampleProperties.includes(p));
        return matching.length >= sampleProperties.length * 0.75;
      });
      
      return consistent;
    }
    
    return false;
  }
  
  /**
   * Find a common ID-like property across an array of objects
   * @param data Array of objects to check
   * @returns The name of the common ID property, or undefined if none found
   */
  private findCommonIdProperty(data: any[]): string | undefined {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return undefined;
    }
    
    // Common ID patterns
    const idPatterns = ['id', 'code', 'key', 'num', 'uuid', 'guid', 'ref'];
    
    // Get all property names from the first few items
    const sampleSize = Math.min(5, data.length);
    const propertyNames = new Set<string>();
    
    for (let i = 0; i < sampleSize; i++) {
      const item = data[i];
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        Object.keys(item).forEach(key => propertyNames.add(key));
      }
    }
    
    // Find properties that match ID patterns and exist in all sampled items
    const candidateProps: string[] = [];
    
    propertyNames.forEach(prop => {
      const propLower = prop.toLowerCase();
      const isIdLike = idPatterns.some(pattern => propLower.includes(pattern));
      if (isIdLike) {
        const existsInAll = data.slice(0, sampleSize).every(
          item => item && typeof item === 'object' && item[prop] !== undefined
        );
        if (existsInAll) {
          candidateProps.push(prop);
        }
      }
    });
    
    // Check for uniqueness in potential ID-like properties
    if (candidateProps.length > 0) {
      for (const prop of candidateProps) {
        const values = new Set();
        let isUnique = true;
        
        for (let i = 0; i < Math.min(data.length, 20); i++) {
          const value = data[i][prop];
          if (values.has(value)) {
            isUnique = false;
            break;
          }
          values.add(value);
        }
        
        if (isUnique) {
          return prop;
        }
      }
      // If no property is truly unique, return the first candidate
      return candidateProps[0];
    }
    
    return undefined;
  }
  
  /**
   * Detect an entity ID from an object using heuristics
   * @param entity The entity object
   * @returns The detected entity ID, or a generated ID if none found
   */
  private detectEntityId(entity: any): any {
    if (!entity || typeof entity !== 'object' || Array.isArray(entity)) {
      return this.generateFallbackId(entity);
    }
    
    // Common ID patterns
    const idPatterns = ['id', 'key', 'code', 'uuid', 'guid', 'Id', 'ID', 'Key', 'Code'];
    
    // Check direct matches
    for (const pattern of idPatterns) {
      if (entity[pattern] !== undefined) {
        return entity[pattern];
      }
    }
    
    // Check partial matches
    const props = Object.keys(entity);
    for (const prop of props) {
      const propLower = prop.toLowerCase();
      if (idPatterns.some(pattern =>
            propLower === pattern.toLowerCase() ||
            propLower.endsWith(pattern.toLowerCase()) ||
            propLower.startsWith(pattern.toLowerCase())
         )) {
        return entity[prop];
      }
    }
    
    // Fallback to name or title
    if (entity.name !== undefined) return `name-${entity.name}`;
    if (entity.title !== undefined) return `title-${entity.title}`;
    
    // Generate fallback ID
    return this.generateFallbackId(entity);
  }
  
  /**
   * Generate a fallback ID when no natural ID can be detected
   * @param entity The entity object
   * @returns A generated ID string
   */
  private generateFallbackId(entity: any): string {
    let hash = 0;
    const str = JSON.stringify(entity);
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0; // Convert to 32-bit integer
    }
    return `gen-${Math.abs(hash).toString(36)}`;
  }
  
  /**
   * Initialize default entity detectors and extractors (empty by default)
   */
  private initializeDefaultDetectors(): void {
    // No built-in detectors out of the box
  }
}