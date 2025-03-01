import { Injectable } from '@angular/core';

/**
 * Type definitions for the adapter pattern
 */
export type AdapterMapping = Map<string, string>;

/**
 * Interface for dynamic entity configuration
 */
export interface EntityTypeConfig {
  /** Property name used as entity ID */
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

  constructor() {}

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
  /**
   * Initialize default entity detectors and extractors
   */
  private initializeDefaultDetectors(): void {
    // No predefined entity types - everything is auto-detected
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
   * Detect if an array is likely an entity array using heuristics
   * @param data The array to check
   * @returns True if the array appears to be an entity array
   */
  private isGenericEntityArray(data: any[]): boolean {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return false;
    }
    
    const firstItem = data[0];
    
    // If not an object, not an entity array
    if (!firstItem || typeof firstItem !== 'object' || Array.isArray(firstItem)) {
      return false;
    }
    
    // Check if all items have a common structure that suggests entities
    
    // 1. Check if items have a common ID-like property
    const idProperty = this.findCommonIdProperty(data);
    if (idProperty) {
      // Additional check: is this array meant for grouping?
      // If it's just a flat list with IDs, we may not want to treat it as an entity array
      // for special transformation - this check helps distinguish cases where grouping is needed
      
      // Check if there are object-type properties or array properties
      // that would benefit from the parent-child relationship
      const hasComplexProperties = Object.keys(firstItem).some(prop => {
        const value = firstItem[prop];
        return value !== null && typeof value === 'object';
      });
      
      // If there are complex properties, this is likely an entity array that needs grouping
      // If all properties are primitives, it might just be a flat list that doesn't need special processing
      return hasComplexProperties;
    }
    
    // 2. Check if items have consistent properties across the array
    // This suggests a collection of similar entities
    const sampleProperties = Object.keys(firstItem);
    if (sampleProperties.length > 0) {
      // Check if most items have the same properties
      // This is a heuristic that suggests these are similar entities
      const consistentStructure = data.slice(1, Math.min(10, data.length)).every(item => {
        if (!item || typeof item !== 'object') return false;
        const itemProps = Object.keys(item);
        // At least 75% of properties should match for structure to be considered consistent
        const matchingProps = itemProps.filter(p => sampleProperties.includes(p));
        return matchingProps.length >= sampleProperties.length * 0.75;
      });
      
      // Additional check for complex properties that would benefit from grouping
      if (consistentStructure) {
        const hasComplexProperties = sampleProperties.some(prop => {
          const value = firstItem[prop];
          return value !== null && typeof value === 'object';
        });
        
        return hasComplexProperties;
      }
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
      
      // Check if property name contains an ID pattern
      const isIdLike = idPatterns.some(pattern => propLower.includes(pattern));
      
      if (isIdLike) {
        // Check if this property exists in all sampled items
        const existsInAll = data.slice(0, sampleSize).every(item => 
          item && typeof item === 'object' && item[prop] !== undefined);
          
        if (existsInAll) {
          candidateProps.push(prop);
        }
      }
    });
    
    // If we have candidates, check if values are unique (a good ID property should have unique values)
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
      
      // If no property has unique values, return the first candidate
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
    
    // Common ID patterns in priority order
    const idPatterns = [
      // Exact matches
      'id', 'key', 'code', 'uuid', 'guid',
      // Pattern matches
      'Id', 'ID', 'Key', 'Code'
    ];
    
    // Check for exact matches first
    for (const pattern of idPatterns.slice(0, 5)) {
      if (entity[pattern] !== undefined) {
        return entity[pattern];
      }
    }
    
    // Then check for pattern matches
    const props = Object.keys(entity);
    for (const prop of props) {
      const propLower = prop.toLowerCase();
      
      // Check for properties ending with ID patterns
      if (idPatterns.some(pattern => 
        propLower === pattern || 
        propLower.endsWith(pattern.toLowerCase()) ||
        propLower.startsWith(pattern.toLowerCase()))) {
        return entity[prop];
      }
    }
    
    // Last resort: If it has a name or title, use that
    if (entity.name !== undefined) return `name-${entity.name}`;
    if (entity.title !== undefined) return `title-${entity.title}`;
    
    // If all else fails, generate a fallback ID
    return this.generateFallbackId(entity);
  }
  
  /**
   * Generate a fallback ID when no natural ID can be detected
   * @param entity The entity object
   * @returns A generated ID string
   */
  private generateFallbackId(entity: any): string {
    // Create a hash from the stringified entity
    let hash = 0;
    const str = JSON.stringify(entity);
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0; // Convert to 32-bit integer
    }
    return `gen-${Math.abs(hash).toString(36)}`;
  }
}
