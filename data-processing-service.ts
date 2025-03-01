  /**
   * Log performance metrics if enabled
   * @param operation The operation name
   * @param startTime The start time
   * @param extraInfo Optional extra info to log
   */
  private logPerformanceMetric(operation: string, startTime: number, extraInfo: Record<string, any> = {}): void {
    if (!this.config.logPerformance) return;
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    console.log(`[Performance] ${operation}: ${duration.toFixed(2)}ms`, {
      ...extraInfo,
      duration
    });
  }import { Injectable } from '@angular/core';
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
    useNullPrototype: true,
    createPrecomputedCollections: true,
    precomputeThreshold: 10000, // Only precompute for collections with > 10K items
    logPerformance: false
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
    const startTime = performance.now();
    
    // Create result object with null prototype for better performance
    const result = this.config.useNullPrototype ? Object.create(null) : {};
    
    // Process each root element
    for (const rootId in data) {
      if (!Object.prototype.hasOwnProperty.call(data, rootId)) continue;
      
      // Use adapter service to get the mapped field name
      const mappedRootId = this.adapterService.getFieldName(rootId);
      const rootValue = data[rootId];
      
      // Check if this is an entity array
      let isEntityArray = false;
      let entityType: string | undefined;
      
      if (Array.isArray(rootValue)) {
        const detectionStart = performance.now();
        const detection = this.adapterService.detectEntityArray(rootId, rootValue);
        isEntityArray = detection.isEntity;
        entityType = detection.entityType;
        this.logPerformanceMetric(`Entity detection for ${rootId}`, detectionStart, { isEntity: isEntityArray, entityType });
      }
      
      // Handle entity arrays - only apply special processing if it's actually an entity array
      if (isEntityArray && Array.isArray(rootValue)) {
        // Create transformed structure for entity data
        result[mappedRootId] = this.config.useNullPrototype ? Object.create(null) : {};
        
        const entityCount = rootValue.length;
        
        // Process all entities
        for (let i = 0; i < entityCount; i++) {
          const entity = rootValue[i];
          const entityId = this.adapterService.extractEntityId(entityType, entity);
          
          // Skip entities without ID (shouldn't happen with fallback generation)
          if (entityId === undefined) continue;
          
          // Process each property of the entity
          for (const prop in entity) {
            // Get property value
            const propValue = entity[prop];
            
            // Skip if this property is the ID property (check by comparing values)
            if (propValue === entityId && this.isPrimitiveValue(propValue)) {
              continue;
            }
            
            // Skip fields not in fieldsToIndex if specified
            if (this.config.fieldsToIndex && !this.config.fieldsToIndex.includes(prop)) continue;
            
            // Initialize the property in the result if needed
            if (!result[mappedRootId][prop]) {
              result[mappedRootId][prop] = this.config.useNullPrototype ? Object.create(null) : {};
            }
            
            // Process the property based on its type
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
        // No special transformation for flat data structures
        result[mappedRootId] = rootValue;
      }
    }
    
    this.logPerformanceMetric('Transform data', startTime, { 
      rootCount: Object.keys(result).length,
      originalSize: JSON.stringify(data).length, 
      transformedSize: JSON.stringify(result).length 
    });
    
    return result;
  }
    
    return result;
  }
  
  /**
   * Check if a value is a primitive value
   * @param value The value to check
   * @returns True if the value is a primitive
   */
  private isPrimitiveValue(value: any): boolean {
    return value === null || 
           typeof value === 'undefined' ||
           typeof value === 'string' ||
           typeof value === 'number' ||
           typeof value === 'boolean';
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
    const startTime = performance.now();
    
    // Clear existing index
    this.indexedData.clear();
    
    // Clear fields cache
    this.fieldsByRoot.clear();
    
    return new Promise<void>((resolve) => {
      // For immediate indexing, process all at once
      const basicIndexStart = performance.now();
      let precomputeTime = 0;
      let totalRoots = 0;
      let totalFields = 0;
      let totalEntities = 0;
      
      // First pass: Basic indexing (fast)
      for (const rootId in data) {
        if (!Object.prototype.hasOwnProperty.call(data, rootId)) {
          continue;
        }
        
        const rootStart = performance.now();
        this.indexSingleRoot(rootId, data[rootId]);
        totalRoots++;
        
        // Count fields and entities for logging
        const rootMap = this.indexedData.get(rootId);
        if (rootMap) {
          totalFields += rootMap.size;
          
          rootMap.forEach(fieldMap => {
            totalEntities += fieldMap.size;
          });
        }
        
        this.logPerformanceMetric(`Indexing root: ${rootId}`, rootStart);
      }
      
      const basicIndexTime = performance.now() - basicIndexStart;
      
      // Second pass: Create pre-computed collections if configured
      // This is optional and can be skipped to prioritize indexing speed
      if (this.config.createPrecomputedCollections) {
        const precomputeStart = performance.now();
        
        const rootIds = Array.from(this.indexedData.keys());
        let precomputedRoots = 0;
        
        for (const rootId of rootIds) {
          const rootMap = this.indexedData.get(rootId)!;
          
          // Only create pre-computed collections if the dataset is large enough
          // to benefit from the optimization
          if (this.shouldPrecomputeCollections(rootMap)) {
            const rootPrecomputeStart = performance.now();
            this.createRootAllCollection(rootId);
            this.logPerformanceMetric(`Precomputing root: ${rootId}`, rootPrecomputeStart);
            precomputedRoots++;
          }
        }
        
        precomputeTime = performance.now() - precomputeStart;
        
        this.logPerformanceMetric('Precomputation phase', precomputeStart, {
          precomputedRoots,
          totalRoots
        });
      }
      
      const totalTime = performance.now() - startTime;
      
      if (this.config.logPerformance) {
        console.log(`[Performance] Indexing summary:`, {
          totalTime: `${totalTime.toFixed(2)}ms`,
          basicIndexTime: `${basicIndexTime.toFixed(2)}ms`,
          precomputeTime: `${precomputeTime.toFixed(2)}ms`,
          totalRoots,
          totalFields,
          totalEntities,
          memoryUsage: this.getMemoryUsage()
        });
      }
      
      resolve();
    });
  }
  
  /**
   * Determine if we should pre-compute collections for this root
   * This helps balance indexing speed vs lookup performance
   */
  private shouldPrecomputeCollections(rootMap: Map<string, Map<any, any[]>>): boolean {
    if (!this.config.createPrecomputedCollections) return false;
    
    // Skip for very simple structures
    if (rootMap.size <= 2) return false;
    
    // If there's a threshold, check if any field exceeds it
    if (this.config.precomputeThreshold) {
      // Check if any field has more than the threshold items
      let totalItems = 0;
      
      for (const fieldMap of rootMap.values()) {
        if (fieldMap.has('__all__')) {
          totalItems += fieldMap.get('__all__')!.length;
          
          // If any field exceeds the threshold, pre-compute
          if (totalItems > this.config.precomputeThreshold) {
            return true;
          }
        }
      }
      
      // If total items across all fields exceeds the threshold, pre-compute
      return totalItems > this.config.precomputeThreshold;
    }
    
    // Default to true if no specific configuration
    return true;
  }
  
  /**
   * Create an __all__ collection for a root to ensure O(1) lookup
   * @param rootId The root ID
   */
  private createRootAllCollection(rootId: string): void {
    const rootMap = this.indexedData.get(rootId);
    if (!rootMap) return;
    
    // Skip if already has __all__ collection
    if (rootMap.has('__all__')) return;
    
    // Get all fields for this root (excluding special fields)
    const fields = this.getFieldsForRoot(rootId);
    
    // If it's a simple array, don't need special handling
    if (fields.length === 0 && rootMap.has('__default__')) return;
    
    // Create __all__ collection that contains all data
    const allData: any[] = [];
    
    // For each field
    for (let i = 0; i < fields.length; i++) {
      const fieldName = fields[i];
      const fieldMap = rootMap.get(fieldName);
      
      if (fieldMap && fieldMap.has('__all__')) {
        // Add all data from this field
        allData.push(...fieldMap.get('__all__')!);
      }
    }
    
    // Store the __all__ collection
    rootMap.set('__all__', allData);
  }
  
  /**
   * Append new data to existing indexed data
   * Allows incremental updates without reindexing everything
   * @param data New data to append to the existing index
   */
  appendData(data: any): Promise<any> {
    return new Promise<any>((resolve) => {
      // Transform the new data
      const transformedData = this.transformData(data);
      
      // Index the new data without clearing existing index
      const startTime = performance.now();
      
      for (const rootId in transformedData) {
        if (Object.prototype.hasOwnProperty.call(transformedData, rootId)) {
          // If this root doesn't exist yet, create it
          if (!this.indexedData.has(rootId)) {
            this.indexSingleRoot(rootId, transformedData[rootId]);
          } else {
            // Merge with existing data
            this.mergeAndIndexRoot(rootId, transformedData[rootId]);
          }
        }
      }
      
      const endTime = performance.now();
      console.log(`Appending completed in ${Math.round(endTime - startTime)}ms`);
      
      resolve(transformedData);
    });
  }
  
  /**
   * Merge new data with existing indexed data for a specific root
   * @param rootId The root ID
   * @param newRootValue The new data to merge
   */
  private mergeAndIndexRoot(rootId: string, newRootValue: any): void {
    const rootMap = this.indexedData.get(rootId)!;
    
    // Handle object types at root level
    if (newRootValue !== null && typeof newRootValue === 'object' && !Array.isArray(newRootValue)) {
      // For each field in the new root object
      for (const field in newRootValue) {
        if (!Object.prototype.hasOwnProperty.call(newRootValue, field)) continue;
        
        // Skip fields not in fieldsToIndex if specified
        if (this.config.fieldsToIndex && !this.config.fieldsToIndex.includes(field)) continue;
        
        // Create the field map if it doesn't exist
        if (!rootMap.has(field)) {
          rootMap.set(field, new Map<any, any[]>());
        }
        
        const fieldMap = rootMap.get(field)!;
        const fieldValue = newRootValue[field];
        
        // Handle objects with entity IDs as keys
        if (fieldValue !== null && typeof fieldValue === 'object' && !Array.isArray(fieldValue)) {
          const entityIds = Object.keys(fieldValue);
          
          // Add new entities to the index
          for (const entityId of entityIds) {
            const entityValues = fieldValue[entityId];
            fieldMap.set(entityId, entityValues);
            
            // Update __all__ collection if it exists
            if (fieldMap.has('__all__')) {
              const allValues = fieldMap.get('__all__')!;
              allValues.push(...entityValues);
            }
          }
        } 
        // Handle arrays
        else if (Array.isArray(fieldValue)) {
          // Update __all__ collection
          if (fieldMap.has('__all__')) {
            const allValues = fieldMap.get('__all__')!;
            allValues.push(...fieldValue);
          } else {
            fieldMap.set('__all__', fieldValue);
          }
          
          // Only index by ID if configured to do so
          if (this.config.indexArraysById) {
            const len = fieldValue.length;
            
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
    else if (Array.isArray(newRootValue)) {
      // Make sure we have a default map
      if (!rootMap.has('__default__')) {
        rootMap.set('__default__', new Map<any, any[]>());
      }
      
      const defaultMap = rootMap.get('__default__')!;
      
      // Update __all__ collection
      if (defaultMap.has('__all__')) {
        const allValues = defaultMap.get('__all__')!;
        allValues.push(...newRootValue);
      } else {
        defaultMap.set('__all__', newRootValue);
      }
      
      // Only index by ID if configured to do so
      if (this.config.indexArraysById) {
        const len = newRootValue.length;
        
        for (let i = 0; i < len; i++) {
          const item = newRootValue[i];
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
   * @param rootId The root ID to look up
   * @param field Optional field within the root
   * @param parentId Optional parent ID to filter by
   * @returns The matching data or undefined if not found
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
   * This is optimized for performance by pre-allocating the result array
   */
  private collectAllData(rootMap: Map<string, Map<any, any[]>>): any[] {
    // Fast path: if we already have a cached __all__ collection, use it
    if (rootMap.has('__all__')) {
      return rootMap.get('__all__')!;
    }
    
    // Estimate total size to pre-allocate array (avoids expensive resizing)
    let totalSize = 0;
    rootMap.forEach(fieldMap => {
      if (fieldMap.has('__all__')) {
        totalSize += fieldMap.get('__all__')!.length;
      }
    });
    
    // Pre-allocate result array
    const allData = new Array(totalSize);
    let index = 0;
    
    // Use direct iteration instead of forEach for better performance
    const fieldMaps = Array.from(rootMap.values());
    for (let i = 0; i < fieldMaps.length; i++) {
      const fieldMap = fieldMaps[i];
      if (fieldMap.has('__all__')) {
        const items = fieldMap.get('__all__')!;
        // Use direct array copy instead of push for better performance
        for (let j = 0; j < items.length; j++) {
          allData[index++] = items[j];
        }
      }
    }
    
    // Trim if necessary
    if (index < totalSize) {
      allData.length = index;
    }
    
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
