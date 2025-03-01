import { Injectable } from '@angular/core';
import { ReferenceAdapterService } from './reference-adapter.service';

/**
 * Type definitions for the indexing system
 */
export type IndexMap = Map<string, Map<string, Map<any, any[]>>>;

/**
 * Interface for index configuration options
 */
export interface IndexConfig {
  /**
   * Fields to index (limits indexing to specific fields for better performance)
   */
  fieldsToIndex?: string[];
  
  /**
   * Whether to index arrays by ID (false can improve performance if not needed)
   */
  indexArraysById?: boolean;
  
  /**
   * Chunk size for processing large arrays (batches work for better performance)
   */
  chunkSize?: number;
  
  /**
   * Whether to skip creating "__all__" collections for large datasets
   */
  skipAllCollections?: boolean;
  
  /**
   * Whether to use Object.create(null) instead of {} for better performance
   */
  useNullPrototype?: boolean;
}

/**
 * DataProcessingService handles the transformation, indexing, and lookup of data
 * This service uses the ReferenceAdapterService for field name mappings
 */
@Injectable({
  providedIn: 'root'
})
export class DataProcessingService {
  private indexedData: IndexMap = new Map<string, Map<string, Map<any, any[]>>>();
  
  // Default configuration
  private config: IndexConfig = {
    fieldsToIndex: undefined, // All fields
    indexArraysById: true,
    chunkSize: 5000,
    skipAllCollections: false,
    useNullPrototype: true
  };

  constructor(private adapterService: ReferenceAdapterService) {}

  /**
   * Set configuration options for indexing
   */
  setConfig(config: Partial<IndexConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Transform the original data structure based on registered mappings from adapter service
   * Optimized for performance with large datasets
   */
  transformData(data: any): any {
    // Create result object with null prototype for better performance
    const result = this.config.useNullPrototype ? Object.create(null) : {};
    
    // Process each root element
    for (const rootId in data) {
      if (!Object.prototype.hasOwnProperty.call(data, rootId)) continue;
      
      // Use adapter service to get the mapped field name
      const mappedRootId = this.adapterService.getFieldName(rootId);
      const rootValue = data[rootId];
      
      // Handle special entity array case
      if (rootId === 'entity' || (Array.isArray(rootValue) && rootValue.length > 0 && rootValue[0].aeId !== undefined)) {
        // Create transformed structure for entity data
        result[mappedRootId] = this.config.useNullPrototype ? Object.create(null) : {};
        
        const entityCount = rootValue.length;
        
        // Process all entities
        for (let i = 0; i < entityCount; i++) {
          const entity = rootValue[i];
          const entityId = entity.aeId;
          
          // Process each property of the entity
          for (const prop in entity) {
            // Skip aeId property
            if (prop === 'aeId' || !Object.prototype.hasOwnProperty.call(entity, prop)) continue;
            
            // Skip fields not in fieldsToIndex if specified
            if (this.config.fieldsToIndex && !this.config.fieldsToIndex.includes(prop)) continue;
            
            // Initialize the property in the result if needed
            if (!result[mappedRootId][prop]) {
              result[mappedRootId][prop] = this.config.useNullPrototype ? Object.create(null) : {};
            }
            
            const propValue = entity[prop];
            
            // Fast type checking for optimization
            if (propValue !== null && typeof propValue === 'object') {
              if (Array.isArray(propValue)) {
                // Handle array properties
                result[mappedRootId][prop][entityId] = this.fastAddParentIds(propValue, [entityId]);
              } else {
                // Handle object properties - avoid spread for performance
                const objWithParentId = this.cloneWithParentId(propValue, [entityId]);
                result[mappedRootId][prop][entityId] = [objWithParentId];
              }
            } else {
              // Handle primitive properties
              result[mappedRootId][prop][entityId] = [{ value: propValue, parentId: [entityId] }];
            }
          }
        }
      } else {
        // For regular arrays or other structures, just assign directly
        result[mappedRootId] = rootValue;
      }
    }
    
    return result;
  }

  /**
   * Efficiently clone an object and add parentId without using spread operator
   * This is more performant for large objects
   */
  private cloneWithParentId(obj: any, parentIds: any[]): any {
    // Use Object.create for performance over spread operator
    const result = this.config.useNullPrototype ? Object.create(null) : {};
    
    // Copy all properties
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        result[key] = obj[key];
      }
    }
    
    // Add parentId
    result.parentId = parentIds;
    
    return result;
  }

  /**
   * Fast implementation to add parentIds to all elements in an array
   * Optimized for performance with large arrays
   */
  private fastAddParentIds(arr: any[], parentIds: any[]): any[] {
    const len = arr.length;
    const result = new Array(len);
    
    // Fast for-loop instead of map
    for (let i = 0; i < len; i++) {
      const item = arr[i];
      
      // Clone item and add parentId
      const newItem = this.cloneWithParentId(item, parentIds);
      
      // Process children recursively if they exist
      if (item.children && Array.isArray(item.children)) {
        newItem.children = this.fastAddParentIds(item.children, parentIds);
      }
      
      result[i] = newItem;
    }
    
    return result;
  }

  /**
   * Index the data for O(1) lookups - optimized for large datasets
   */
  indexData(data: any): Promise<void> {
    // Clear existing index
    this.indexedData.clear();
    
    return new Promise<void>((resolve) => {
      // For immediate indexing, process all at once
      const startTime = performance.now();
      
      for (const rootId in data) {
        if (Object.prototype.hasOwnProperty.call(data, rootId)) {
          this.indexSingleRoot(rootId, data[rootId]);
        }
      }
      
      const endTime = performance.now();
      console.log(`Indexing completed in ${Math.round(endTime - startTime)}ms`);
      
      resolve();
    });
  }
  
  /**
   * Index a single root element - extracted for better code organization
   */
  private indexSingleRoot(rootId: string, rootValue: any): void {
    // Initialize the root map
    this.indexedData.set(rootId, new Map<string, Map<any, any[]>>());
    const rootMap = this.indexedData.get(rootId)!;
    
    // Handle object types at root level
    if (rootValue !== null && typeof rootValue === 'object' && !Array.isArray(rootValue)) {
      // For each field in the root object
      for (const field in rootValue) {
        if (!Object.prototype.hasOwnProperty.call(rootValue, field)) continue;
        
        // Skip fields not in fieldsToIndex if specified
        if (this.config.fieldsToIndex && !this.config.fieldsToIndex.includes(field)) continue;
        
        rootMap.set(field, new Map<any, any[]>());
        const fieldMap = rootMap.get(field)!;
        
        const fieldValue = rootValue[field];
        
        // Handle objects with entity IDs as keys
        if (fieldValue !== null && typeof fieldValue === 'object' && !Array.isArray(fieldValue)) {
          const entityIds = Object.keys(fieldValue);
          const entityCount = entityIds.length;
          
          // For large datasets, skip creating all collections if configured
          const skipAllCollection = this.config.skipAllCollections && entityCount > 10000;
          
          if (!skipAllCollection) {
            // Create a flat collection of all items
            // Pre-allocate approximate size for better performance
            const allValues: any[] = [];
            let approxSize = 0;
            
            for (const entityId of entityIds) {
              const entityValues = fieldValue[entityId];
              fieldMap.set(entityId, entityValues);
              
              if (entityValues && entityValues.length) {
                approxSize += entityValues.length;
              }
            }
            
            // Only gather all values if the collection isn't too large
            if (approxSize < 100000) {
              allValues.length = approxSize; // Pre-allocate
              
              let index = 0;
              for (const entityId of entityIds) {
                const entityValues = fieldValue[entityId];
                if (entityValues && entityValues.length) {
                  // Manual copy is faster than push for pre-allocated arrays
                  for (let i = 0; i < entityValues.length; i++) {
                    allValues[index++] = entityValues[i];
                  }
                }
              }
              
              // Trim if necessary
              if (index < approxSize) {
                allValues.length = index;
              }
              
              fieldMap.set('__all__', allValues);
            }
          } else {
            // For very large datasets, just index by entity ID
            for (const entityId of entityIds) {
              fieldMap.set(entityId, fieldValue[entityId]);
            }
          }
        } 
        // Handle arrays
        else if (Array.isArray(fieldValue)) {
          fieldMap.set('__all__', fieldValue);
          
          // Only index by ID if configured to do so
          if (this.config.indexArraysById) {
            const len = fieldValue.length;
            
            // Fast path for common case of objects with id property
            for (let i = 0; i < len; i++) {
              const item = fieldValue[i];
              if (item && item.id !== undefined) {
                if (!fieldMap.has(item.id)) {
                  fieldMap.set(item.id, []);
                }
                fieldMap.get(item.id)!.push(item);
              }
            }
          }
        }
      }
    } 
    // Handle arrays at root level
    else if (Array.isArray(rootValue)) {
      rootMap.set('__default__', new Map<any, any[]>());
      const defaultMap = rootMap.get('__default__')!;
      
      defaultMap.set('__all__', rootValue);
      
      // Only index by ID if configured to do so
      if (this.config.indexArraysById) {
        const len = rootValue.length;
        
        for (let i = 0; i < len; i++) {
          const item = rootValue[i];
          if (item && item.id !== undefined) {
            if (!defaultMap.has(item.id)) {
              defaultMap.set(item.id, []);
            }
            defaultMap.get(item.id)!.push(item);
          }
        }
      }
    }
  }

  /**
   * Lookup data from the indexed structure with O(1) time complexity
   * Uses adapter service to handle field name mappings
   */
  lookup(rootId: string, field?: string, parentId?: any): any[] | undefined {
    // Get the mapped root ID using the adapter service
    const mappedRootId = this.adapterService.getFieldName(rootId);
    
    // Fast path return for non-existent roots
    if (!this.indexedData.has(mappedRootId)) {
      return undefined;
    }
    
    const rootMap = this.indexedData.get(mappedRootId)!;
    
    // Handle lookup with no field specified
    if (!field) {
      if (rootMap.has('__default__')) {
        return rootMap.get('__default__')!.get('__all__');
      }
      
      // Only collect all data if necessary
      return this.collectAllData(rootMap);
    }
    
    // Fast path return for non-existent fields
    if (!rootMap.has(field)) {
      return undefined;
    }
    
    const fieldMap = rootMap.get(field)!;
    
    // Direct lookup by parent ID
    if (parentId !== undefined) {
      return fieldMap.has(parentId) ? fieldMap.get(parentId) : undefined;
    }
    
    // Return all data for this field
    return fieldMap.get('__all__');
  }
  
  /**
   * Helper method to collect all data from a root map
   */
  private collectAllData(rootMap: Map<string, Map<any, any[]>>): any[] {
    const allData: any[] = [];
    
    rootMap.forEach(fieldMap => {
      if (fieldMap.has('__all__')) {
        allData.push(...fieldMap.get('__all__')!);
      }
    });
    
    return allData;
  }

  /**
   * Initialize the service with data
   * Returns transformed data and completes indexing
   */
  async initialize(data: any, config?: Partial<IndexConfig>): Promise<any> {
    // Set configuration if provided
    if (config) {
      this.setConfig(config);
    }
    
    console.time('transform');
    // Transform data (optimized for performance)
    const transformedData = this.transformData(data);
    console.timeEnd('transform');
    
    console.time('index');
    // Index the data
    await this.indexData(transformedData);
    console.timeEnd('index');
    
    return transformedData;
  }
  
  /**
   * Get approximate memory usage of the index
   */
  getMemoryUsage(): number {
    let size = 0;
    let keysCount = 0;
    let valuesCount = 0;
    
    this.indexedData.forEach((rootMap) => {
      keysCount++;
      
      rootMap.forEach((fieldMap) => {
        keysCount++;
        
        fieldMap.forEach((values) => {
          keysCount++;
          valuesCount += values ? values.length : 0;
        });
      });
    });
    
    // Very rough approximation: 32 bytes per key, 200 bytes per value
    size = (keysCount * 32) + (valuesCount * 200);
    
    return size;
  }
}
