import { Injectable } from '@angular/core';
import { ReferenceAdapterService } from './reference-adapter.service';

/**
 * Type definitions for the indexing system
 */
export type IndexMap = Map<string, Map<string, Map<any, any[]>>>;

/**
 * Extended configuration interface to match what the code actually uses
 */
export interface IndexConfig {
  fieldsToIndex?: string[];            // Which fields to index (undefined = all)
  indexArraysById?: boolean;           // Index arrays by item.id?
  chunkSize?: number;                  // For potential batch processing
  skipAllCollections?: boolean;        // Skip creating "__all__" arrays
  useNullPrototype?: boolean;          // Use Object.create(null)
  createPrecomputedCollections?: boolean;  
  precomputeThreshold?: number;        // Only precompute if item count > this
  logPerformance?: boolean;            // Logs transform/index times to console
}

@Injectable({
  providedIn: 'root'
})
export class DataProcessingService {
  private indexedData: IndexMap = new Map<string, Map<string, Map<any, any[]>>>();

  // Keep track of which "fields" exist under each root for easier creation of __all__.
  private fieldsByRoot: Map<string, Set<string>> = new Map();

  // Default configuration
  private config: IndexConfig = {
    fieldsToIndex: undefined,
    indexArraysById: true,
    chunkSize: 5000,
    skipAllCollections: false,
    useNullPrototype: true,
    createPrecomputedCollections: true,
    precomputeThreshold: 10000,
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
   * Log performance metrics if enabled
   */
  private logPerformanceMetric(
    operation: string, 
    startTime: number, 
    extraInfo: Record<string, any> = {}
  ): void {
    if (!this.config.logPerformance) return;
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    console.log(`[Performance] ${operation}: ${duration.toFixed(2)}ms`, {
      ...extraInfo,
      duration
    });
  }

  /**
   * Main transform function: 
   *  - Renames root keys via AdapterService
   *  - For "entity arrays," transforms them into a map keyed by ID 
   *    with children referencing parentId
   */
  transformData(data: any): any {
    const startTime = performance.now();
    
    // Create result object with null prototype if desired
    const result = this.config.useNullPrototype ? Object.create(null) : {};
    
    for (const rootId in data) {
      if (!Object.prototype.hasOwnProperty.call(data, rootId)) {
        continue;
      }
      
      // Map the root ID to a new name if registered
      const mappedRootId = this.adapterService.getFieldName(rootId);
      const rootValue = data[rootId];
      
      // Detect if rootValue is an "entity array"
      let { isEntity, entityType } = { isEntity: false, entityType: undefined as string|undefined };
      if (Array.isArray(rootValue)) {
        const detectionStart = performance.now();
        const detection = this.adapterService.detectEntityArray(rootId, rootValue);
        isEntity = detection.isEntity;
        entityType = detection.entityType;
        this.logPerformanceMetric(
          `Entity detection for ${rootId}`, 
          detectionStart, 
          { isEntity, entityType }
        );
      }
      
      // If it is an entity array, we do the special transformation
      if (isEntity && Array.isArray(rootValue)) {
        // We'll store an object of fields, each key -> { entityId -> [ array of items ] }
        const mappedObj = this.config.useNullPrototype ? Object.create(null) : {};
        
        for (const entity of rootValue) {
          // Extract or detect entity ID
          const entityId = this.adapterService.extractEntityId(entityType, entity);
          if (!entityId) {
            // skip if we can't find an ID
            continue;
          }
          
          // For each property in the entity object, we place it in mappedObj[prop][entityId]
          for (const prop in entity) {
            if (!Object.prototype.hasOwnProperty.call(entity, prop)) continue;
            const value = entity[prop];
            
            // If there's a fieldsToIndex filter, skip if not included
            if (this.config.fieldsToIndex && !this.config.fieldsToIndex.includes(prop)) {
              continue;
            }
            
            // Initialize the container if not present
            if (!mappedObj[prop]) {
              mappedObj[prop] = this.config.useNullPrototype ? Object.create(null) : {};
            }
            const container = mappedObj[prop];
            
            // If it's an object (and not an array), we clone and add parentId
            if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
              const cloned = this.cloneWithParentId(value, [entityId]);
              container[entityId] = container[entityId] || [];
              container[entityId].push(cloned);
            }
            // If it's an array, we treat each item similarly
            else if (Array.isArray(value)) {
              const transformedArray = this.fastAddParentIds(value, [entityId]);
              container[entityId] = container[entityId] || [];
              container[entityId].push(...transformedArray);
            } 
            // Otherwise, it's a primitive
            else {
              container[entityId] = container[entityId] || [];
              container[entityId].push({
                value,
                parentId: [entityId]
              });
            }
          }
        }
        
        result[mappedRootId] = mappedObj;
      } else {
        // For non-entity arrays or other structures, just pass them through 
        // but rename the root ID
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

  /**
   * Clone an object and add parentId without using spread (performance reasons).
   */
  private cloneWithParentId(obj: any, parentIds: any[]): any {
    const result = this.config.useNullPrototype ? Object.create(null) : {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        result[key] = obj[key];
      }
    }
    result.parentId = parentIds;
    return result;
  }

  /**
   * For each item in an array, add a parentId. If an item has 'children',
   * also recursively update them. 
   */
  private fastAddParentIds(arr: any[], parentIds: any[]): any[] {
    const len = arr.length;
    const result = new Array(len);
    
    for (let i = 0; i < len; i++) {
      const item = arr[i];
      if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
        const cloned = this.cloneWithParentId(item, parentIds);
        // Recursively fix children if present
        if (Array.isArray(item.children)) {
          cloned.children = this.fastAddParentIds(item.children, parentIds);
        }
        result[i] = cloned;
      } else {
        // If it's a primitive or array, just wrap it
        result[i] = {
          value: item,
          parentId: parentIds
        };
      }
    }
    return result;
  }

  /**
   * Index the data for O(1) lookups. 
   * The data passed here should already be transformed by transformData(...).
   */
  async indexData(data: any): Promise<void> {
    const startTime = performance.now();
    
    // Clear existing indexes
    this.indexedData.clear();
    this.fieldsByRoot.clear();
    
    // Perform indexing in a single pass
    for (const rootId in data) {
      if (!Object.prototype.hasOwnProperty.call(data, rootId)) continue;
      const rootVal = data[rootId];
      const rootStart = performance.now();
      
      this.indexSingleRoot(rootId, rootVal);
      
      this.logPerformanceMetric(`Indexing root: ${rootId}`, rootStart);
    }
    
    // Optionally create big __all__ arrays for each root (if configured).
    if (this.config.createPrecomputedCollections) {
      const precomputeStart = performance.now();
      for (const rootKey of Array.from(this.indexedData.keys())) {
        const rootMap = this.indexedData.get(rootKey)!;
        if (this.shouldPrecomputeCollections(rootMap)) {
          this.createRootAllCollection(rootKey);
        }
      }
      this.logPerformanceMetric('Precomputation phase', precomputeStart);
    }
    
    this.logPerformanceMetric('Index data', startTime);
  }

  /**
   * Index a single root. rootVal can be:
   *  - an object of { fieldName -> { entityId -> any[] } } (transformed entity data)
   *  - an array (for simple structures)
   *  - some other object
   */
  private indexSingleRoot(rootId: string, rootVal: any): void {
    this.indexedData.set(rootId, new Map<string, Map<any, any[]>>());
    const rootMap = this.indexedData.get(rootId)!;
    
    // If it's an object that has { field -> { entityId -> arrayOfItems } }
    if (rootVal !== null && typeof rootVal === 'object' && !Array.isArray(rootVal)) {
      for (const field in rootVal) {
        if (!Object.prototype.hasOwnProperty.call(rootVal, field)) continue;
        
        this.addFieldForRoot(rootId, field);
        
        rootMap.set(field, new Map<any, any[]>());
        const fieldMap = rootMap.get(field)!;
        
        const fieldValue = rootVal[field];
        
        // If fieldValue is an object of { entityId -> arrayOfItems }
        if (fieldValue && typeof fieldValue === 'object' && !Array.isArray(fieldValue)) {
          const entityIds = Object.keys(fieldValue);
          let totalItems = 0;
          
          for (const entityId of entityIds) {
            const items = fieldValue[entityId];
            fieldMap.set(entityId, items);
            totalItems += (items?.length || 0);
          }
          
          // Create __all__ unless skipping or too large
          if (!this.config.skipAllCollections && totalItems < 100000) {
            const allArr: any[] = [];
            allArr.length = totalItems; // pre-allocate
            let idx = 0;
            for (const entityId of entityIds) {
              const items = fieldValue[entityId];
              if (Array.isArray(items)) {
                for (const it of items) {
                  allArr[idx++] = it;
                }
              }
            }
            fieldMap.set('__all__', allArr);
          }
        }
        // If it's an array
        else if (Array.isArray(fieldValue)) {
          fieldMap.set('__all__', fieldValue);
          
          // Optionally index by item.id
          if (this.config.indexArraysById) {
            for (const item of fieldValue) {
              if (item && item.id !== undefined) {
                if (!fieldMap.has(item.id)) {
                  fieldMap.set(item.id, []);
                }
                fieldMap.get(item.id)!.push(item);
              }
            }
          }
        }
        // Otherwise, single object/primitive
        else {
          fieldMap.set('__single__', [fieldValue]);
        }
      }
    }
    // If rootVal is an array
    else if (Array.isArray(rootVal)) {
      rootMap.set('__default__', new Map<any, any[]>());
      const defaultMap = rootMap.get('__default__')!;
      defaultMap.set('__all__', rootVal);
      
      // Optionally index by id
      if (this.config.indexArraysById) {
        for (const item of rootVal) {
          if (item && item.id !== undefined) {
            if (!defaultMap.has(item.id)) {
              defaultMap.set(item.id, []);
            }
            defaultMap.get(item.id)!.push(item);
          }
        }
      }
    }
    // Otherwise, store it as a single item
    else {
      rootMap.set('__default__', new Map<any, any[]>());
      rootMap.get('__default__')!.set('__single__', [rootVal]);
    }
  }

  /**
   * Append new data to the existing index:
   *  1. Transform the data
   *  2. Merge it into the in-memory index
   *  3. Optionally update precomputed collections
   */
  async appendData(data: any): Promise<any> {
    // 1) Transform new data
    const transformedData = this.transformData(data);

    // 2) Merge into existing index or create new root
    for (const rootKey in transformedData) {
      if (!Object.prototype.hasOwnProperty.call(transformedData, rootKey)) continue;

      const val = transformedData[rootKey];
      if (!this.indexedData.has(rootKey)) {
        // brand-new root
        this.indexSingleRoot(rootKey, val);
      } else {
        // existing root: merge
        this.mergeRoot(rootKey, val);
      }
    }

    // 3) Optionally re-create precomputed collections
    if (this.config.createPrecomputedCollections) {
      const rootKeys = Object.keys(transformedData);
      for (const rootKey of rootKeys) {
        const rootMap = this.indexedData.get(rootKey);
        if (rootMap && this.shouldPrecomputeCollections(rootMap)) {
          this.createRootAllCollection(rootKey);
        }
      }
    }

    return transformedData;
  }

  /**
   * Merge new data into an existing root. 
   * This is used by appendData() so we don’t re-index from scratch.
   */
  private mergeRoot(rootId: string, newRootVal: any): void {
    const rootMap = this.indexedData.get(rootId);
    if (!rootMap) return; // should not happen if we do existence check

    // If the new root is an object with { field -> { entityId -> [items] } }
    if (newRootVal !== null && typeof newRootVal === 'object' && !Array.isArray(newRootVal)) {
      for (const field in newRootVal) {
        if (!Object.prototype.hasOwnProperty.call(newRootVal, field)) continue;
        
        // Make sure the field is registered
        this.addFieldForRoot(rootId, field);

        if (!rootMap.has(field)) {
          rootMap.set(field, new Map<any, any[]>());
        }
        const fieldMap = rootMap.get(field)!;
        const fieldValue = newRootVal[field];

        // If fieldValue is { entityId -> arrayOfItems }
        if (fieldValue && typeof fieldValue === 'object' && !Array.isArray(fieldValue)) {
          for (const entityId of Object.keys(fieldValue)) {
            const items = fieldValue[entityId];
            if (!fieldMap.has(entityId)) {
              fieldMap.set(entityId, []);
            }
            fieldMap.get(entityId)!.push(...items);

            // Update __all__ if it exists
            if (fieldMap.has('__all__')) {
              fieldMap.get('__all__')!.push(...items);
            }
          }
        }
        // If fieldValue is an array
        else if (Array.isArray(fieldValue)) {
          // Merge into __all__
          if (!fieldMap.has('__all__')) {
            fieldMap.set('__all__', []);
          }
          fieldMap.get('__all__')!.push(...fieldValue);

          // If indexing by ID
          if (this.config.indexArraysById) {
            for (const item of fieldValue) {
              if (item && item.id !== undefined) {
                if (!fieldMap.has(item.id)) {
                  fieldMap.set(item.id, []);
                }
                fieldMap.get(item.id)!.push(item);
              }
            }
          }
        } else {
          // Single object/primitive
          if (!fieldMap.has('__single__')) {
            fieldMap.set('__single__', []);
          }
          fieldMap.get('__single__')!.push(fieldValue);
        }
      }
    }
    // If newRootVal is an array
    else if (Array.isArray(newRootVal)) {
      if (!rootMap.has('__default__')) {
        rootMap.set('__default__', new Map<any, any[]>());
      }
      const defaultMap = rootMap.get('__default__')!;
      if (!defaultMap.has('__all__')) {
        defaultMap.set('__all__', []);
      }
      defaultMap.get('__all__')!.push(...newRootVal);

      // Optionally index by item.id
      if (this.config.indexArraysById) {
        for (const item of newRootVal) {
          if (item && item.id !== undefined) {
            if (!defaultMap.has(item.id)) {
              defaultMap.set(item.id, []);
            }
            defaultMap.get(item.id)!.push(item);
          }
        }
      }
    }
    // Otherwise it's a single object/primitive
    else {
      if (!rootMap.has('__default__')) {
        rootMap.set('__default__', new Map<any, any[]>());
      }
      const defaultMap = rootMap.get('__default__')!;
      if (!defaultMap.has('__single__')) {
        defaultMap.set('__single__', []);
      }
      defaultMap.get('__single__')!.push(newRootVal);
    }
  }

  /**
   * Decide whether we should precompute an __all__ array across all fields in the root.
   */
  private shouldPrecomputeCollections(rootMap: Map<string, Map<any, any[]>>): boolean {
    if (!this.config.createPrecomputedCollections) return false;
    if (rootMap.size <= 1) return false;
    
    // If there's a threshold, check if any field exceeds it
    if (this.config.precomputeThreshold) {
      let totalCount = 0;
      for (const fieldMap of rootMap.values()) {
        const allItems = fieldMap.get('__all__');
        if (Array.isArray(allItems)) {
          totalCount += allItems.length;
        }
        if (totalCount > this.config.precomputeThreshold) {
          return true;
        }
      }
      return totalCount > this.config.precomputeThreshold;
    }
    return true;
  }

  /**
   * Create an __all__ array for the entire root to enable fast retrieval.
   */
  private createRootAllCollection(rootId: string): void {
    const rootMap = this.indexedData.get(rootId);
    if (!rootMap) return;
    
    // Already has a root-level __all__?
    if (rootMap.has('__all__')) return;
    
    // Combine all fieldMap.__all__ across fields
    const fields = this.fieldsByRoot.get(rootId) || [];
    let totalSize = 0;
    
    for (const fieldName of fields) {
      const fieldMap = rootMap.get(fieldName);
      if (fieldMap && fieldMap.has('__all__')) {
        totalSize += fieldMap.get('__all__')!.length;
      }
    }
    
    const allData = new Array(totalSize);
    let idx = 0;
    
    for (const fieldName of fields) {
      const fieldMap = rootMap.get(fieldName);
      if (fieldMap && fieldMap.has('__all__')) {
        const items = fieldMap.get('__all__')!;
        for (const it of items) {
          allData[idx++] = it;
        }
      }
    }
    
    rootMap.set('__all__', new Map<any, any[]>());
    // We'll store the entire array under __all__ -> __all__
    rootMap.get('__all__')!.set('__all__', allData);
  }

  /**
   * Add a field to fieldsByRoot.
   */
  private addFieldForRoot(rootId: string, field: string): void {
    if (!this.fieldsByRoot.has(rootId)) {
      this.fieldsByRoot.set(rootId, new Set<string>());
    }
    this.fieldsByRoot.get(rootId)!.add(field);
  }

  /**
   * Lookup data in O(1) time from the indexed structure.
   * 
   * @param rootId - the top-level name (will be mapped by adapter)
   * @param field - optionally the field name
   * @param id - optionally the entity ID (or parent ID)
   */
  lookup(rootId: string, field?: string, id?: any): any[] | undefined {
    // Map the rootId
    const mappedRootId = this.adapterService.getFieldName(rootId);
    
    if (!this.indexedData.has(mappedRootId)) {
      return undefined;
    }
    
    const rootMap = this.indexedData.get(mappedRootId)!;
    
    // If no field is specified, check if there's a root-level default or a root-level __all__
    if (!field) {
      if (rootMap.has('__all__')) {
        const bigMap = rootMap.get('__all__')!;
        return bigMap.get('__all__') || [];
      }
      return this.collectAllData(rootMap);
    }
    
    // If the field doesn't exist
    if (!rootMap.has(field)) {
      return undefined;
    }
    
    const fieldMap = rootMap.get(field)!;
    
    // If no id is provided, return the entire field
    if (id === undefined) {
      return fieldMap.get('__all__') || [];
    }
    
    // Otherwise, return the array stored at [id] (if any)
    return fieldMap.get(id);
  }

  /**
   * Collect all items across every field in a root (used if we haven't precomputed).
   */
  private collectAllData(rootMap: Map<string, Map<any, any[]>>): any[] {
    let totalSize = 0;
    for (const fieldMap of rootMap.values()) {
      const arr = fieldMap.get('__all__');
      if (arr) totalSize += arr.length;
    }
    
    const result = new Array(totalSize);
    let idx = 0;
    for (const fieldMap of rootMap.values()) {
      const arr = fieldMap.get('__all__');
      if (arr) {
        for (const it of arr) {
          result[idx++] = it;
        }
      }
    }
    return result;
  }

  /**
   * Convenience method to initialize everything in one go:
   *   1. Transform data
   *   2. Index data
   */
  async initialize(data: any, config?: Partial<IndexConfig>): Promise<any> {
    if (config) {
      this.setConfig(config);
    }
    
    console.time('transform');
    const transformedData = this.transformData(data);
    console.timeEnd('transform');
    
    console.time('index');
    await this.indexData(transformedData);
    console.timeEnd('index');
    
    return transformedData;
  }
}