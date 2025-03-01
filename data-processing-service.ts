import { Injectable } from '@angular/core';
import { ReferenceAdapterService } from './reference-adapter.service';

/**
 * We store the final index in a nested Map for O(1) lookups:
 *  - outer map: Map<rootName, Map<fieldName, Map<entityId, any[]>>>
 */
export type IndexMap = Map<string, Map<string, Map<any, any[]>>>;

/**
 * Interface for indexing configuration
 */
export interface IndexConfig {
  fieldsToIndex?: string[];
  indexArraysById?: boolean;
  chunkSize?: number;
  skipAllCollections?: boolean;
  useNullPrototype?: boolean;
  createPrecomputedCollections?: boolean;
  precomputeThreshold?: number;
  logPerformance?: boolean;
  printDataInLogs?: boolean;
}

@Injectable({ providedIn: 'root' })
export class DataProcessingService {
  /**
   * Our main property to store the final in-memory index:
   */
  private indexedData: IndexMap = new Map();

  /**
   * Configuration for how we transform & index data
   */
  private config: IndexConfig = {
    fieldsToIndex: undefined,
    indexArraysById: true,
    chunkSize: 5000,
    skipAllCollections: false,
    useNullPrototype: true,
    createPrecomputedCollections: true,
    precomputeThreshold: 10000,
    logPerformance: false,
    printDataInLogs: false
  };

  constructor(private adapterService: ReferenceAdapterService) {}

  /**
   * Overwrite or extend the current indexing configuration
   */
  setConfig(config: Partial<IndexConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Helper: logs performance info if logPerformance=true
   */
  private logPerformanceMetric(
    operation: string,
    startTime: number,
    extraInfo: Record<string, any> = {},
    data?: any
  ): void {
    if (!this.config.logPerformance) return;

    const endTime = performance.now();
    const duration = endTime - startTime;
    console.log(`[Performance] ${operation}: ${duration.toFixed(2)}ms`, {
      ...extraInfo,
      duration
    });
    if (this.config.printDataInLogs && data !== undefined) {
      console.log(`[Performance] ${operation} - data:`, data);
    }
  }

  /**
   * transformData(...) checks each root:
   *  - If adapter says "isEntity=true", we build Map<field, Map<entityId, any[]>>
   *  - Otherwise we keep the root as a plain array/object.
   * 
   * We also attach parentId to nested objects for hierarchical references.
   */
  transformData(data: any): any {
    const startTime = performance.now();

    // We'll return an object whose keys are the mappedRootId,
    // values are either a Map<field, Map<entityId, any[]>> or a plain array/object
    const result = this.config.useNullPrototype ? Object.create(null) : {};

    for (const rootId in data) {
      if (!Object.prototype.hasOwnProperty.call(data, rootId)) {
        continue;
      }

      const mappedRootId = this.adapterService.getFieldName(rootId);
      const rootValue = data[rootId];

      let isEntity = false;
      let entityType: string|undefined;

      // If this root is an array, check if it's an entity array
      if (Array.isArray(rootValue)) {
        const detection = this.adapterService.detectEntityArray(rootId, rootValue);
        isEntity = detection.isEntity;
        entityType = detection.entityType;
      }

      if (isEntity && Array.isArray(rootValue)) {
        // We'll build a Map<fieldName, Map<entityId, any[]>> 
        const rootMap = new Map<string, Map<any, any[]>>();

        // For each entity in the array
        for (const entity of rootValue) {
          const entityId = this.adapterService.extractEntityId(entityType, entity);
          if (!entityId) continue;

          // For each property of the entity
          for (const prop in entity) {
            if (!Object.prototype.hasOwnProperty.call(entity, prop)) {
              continue;
            }
            const val = entity[prop];

            // If fieldsToIndex is set, skip properties not in it
            if (this.config.fieldsToIndex && !this.config.fieldsToIndex.includes(prop)) {
              continue;
            }

            // Make sure we have a Map for this property
            if (!rootMap.has(prop)) {
              rootMap.set(prop, new Map<any, any[]>());
            }
            const fieldMap = rootMap.get(prop)!;

            // Make sure we have an array at [entityId]
            if (!fieldMap.has(entityId)) {
              fieldMap.set(entityId, []);
            }
            const itemsArray = fieldMap.get(entityId)!;

            // If val is an object, attach parentId
            if (val && typeof val === 'object' && !Array.isArray(val)) {
              const clonedObj = this.cloneWithParentId(val, [entityId]);
              itemsArray.push(clonedObj);
            }
            // If val is an array, attach parentId to each sub-item
            else if (Array.isArray(val)) {
              const arrWithParent = this.fastAddParentIds(val, [entityId]);
              itemsArray.push(...arrWithParent);
            }
            // Otherwise, it's primitive
            else {
              itemsArray.push({
                value: val,
                parentId: [entityId]
              });
            }
          }
        }

        result[mappedRootId] = rootMap;
      } else {
        // Not an entity array => store the rootValue as is
        result[mappedRootId] = rootValue;
      }
    }

    this.logPerformanceMetric(
      'Transform data',
      startTime,
      {
        rootCount: Object.keys(result).length,
        originalSize: JSON.stringify(data).length,
        transformedSize: JSON.stringify(result).length
      },
      result
    );

    return result;
  }

  /**
   * cloneWithParentId: shallow clone the object and add parentId
   */
  private cloneWithParentId(obj: any, parentIds: any[]): any {
    const newObj = this.config.useNullPrototype ? Object.create(null) : {};
    for (const k in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, k)) {
        newObj[k] = obj[k];
      }
    }
    newObj.parentId = parentIds;
    return newObj;
  }

  /**
   * fastAddParentIds: for each item in arr, attach parentId. If item.children is an array, do so recursively.
   */
  private fastAddParentIds(arr: any[], parentIds: any[]): any[] {
    const len = arr.length;
    const out = new Array(len);
    for (let i = 0; i < len; i++) {
      const item = arr[i];
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const cloned = this.cloneWithParentId(item, parentIds);
        if (Array.isArray(item.children)) {
          cloned.children = this.fastAddParentIds(item.children, parentIds);
        }
        out[i] = cloned;
      } else {
        out[i] = { value: item, parentId: parentIds };
      }
    }
    return out;
  }

  /**
   * indexData: stores the transformed structure into this.indexedData in O(1) style.
   * If the transformed root is a Map, we copy it; if it's a plain array or object, we put it under a default map.
   */
  async indexData(transformedData: any): Promise<void> {
    const startTime = performance.now();
    // Clear any old data
    this.indexedData.clear();

    // We'll also track fields for optional precomputation
    this.fieldsByRoot.clear();

    // For each top-level root in transformedData
    for (const rootKey in transformedData) {
      if (!Object.prototype.hasOwnProperty.call(transformedData, rootKey)) {
        continue;
      }
      const val = transformedData[rootKey];
      const rootStart = performance.now();

      this.indexSingleRoot(rootKey, val);

      this.logPerformanceMetric(`Indexing root: ${rootKey}`, rootStart);
    }

    // Optional: create precomputed __all__ arrays
    if (this.config.createPrecomputedCollections) {
      const precomputeStart = performance.now();
      for (const rootK of Array.from(this.indexedData.keys())) {
        const rootMap = this.indexedData.get(rootK)!;
        if (this.shouldPrecomputeCollections(rootMap)) {
          this.createRootAllCollection(rootK);
        }
      }
      this.logPerformanceMetric('Precomputation phase', precomputeStart);
    }

    this.logPerformanceMetric('Index data', startTime, {}, transformedData);
  }

  private indexSingleRoot(rootKey: string, rootVal: any): void {
    // We'll store a Map<fieldName, Map<entityId, any[]>> for entity arrays,
    // or a default structure for plain arrays/objects.

    this.indexedData.set(rootKey, new Map<string, Map<any, any[]>>());
    const rootMap = this.indexedData.get(rootKey)!;

    // If rootVal is a Map => it came from an "entity array" transform
    if (rootVal instanceof Map) {
      // For each field in the map
      for (const [fieldName, entityIdMap] of rootVal.entries()) {
        this.addFieldForRoot(rootKey, fieldName);

        // Create fieldMap
        rootMap.set(fieldName, new Map<any, any[]>());
        const fieldMap = rootMap.get(fieldName)!;

        // entityIdMap is Map<entityId, any[]>
        if (entityIdMap instanceof Map) {
          let totalCount = 0;
          for (const [idVal, items] of entityIdMap.entries()) {
            fieldMap.set(idVal, items);
            totalCount += (items?.length || 0);
          }
          // If we want a combined __all__
          if (!this.config.skipAllCollections && totalCount < 100000) {
            const allArr: any[] = [];
            allArr.length = totalCount;
            let idx = 0;
            for (const arr of entityIdMap.values()) {
              for (const it of arr) {
                allArr[idx++] = it;
              }
            }
            fieldMap.set('__all__', allArr);
          }
        }
      }
    }
    // Else if it's an array => store under __default__
    else if (Array.isArray(rootVal)) {
      rootMap.set('__default__', new Map<any, any[]>());
      const defMap = rootMap.get('__default__')!;
      defMap.set('__all__', rootVal);

      // Optionally index by item.id
      if (this.config.indexArraysById) {
        for (const item of rootVal) {
          if (item && item.id !== undefined) {
            if (!defMap.has(item.id)) {
              defMap.set(item.id, []);
            }
            defMap.get(item.id)!.push(item);
          }
        }
      }
    }
    // Else if it's a plain object => store it as single
    else if (rootVal && typeof rootVal === 'object') {
      rootMap.set('__default__', new Map<any, any[]>());
      rootMap.get('__default__')!.set('__single__', [rootVal]);
    }
    // Else it's primitive
    else {
      rootMap.set('__default__', new Map<any, any[]>());
      rootMap.get('__default__')!.set('__single__', [rootVal]);
    }
  }

  private fieldsByRoot: Map<string, Set<string>> = new Map();

  private addFieldForRoot(rootKey: string, fieldName: string): void {
    if (!this.fieldsByRoot.has(rootKey)) {
      this.fieldsByRoot.set(rootKey, new Set<string>());
    }
    this.fieldsByRoot.get(rootKey)!.add(fieldName);
  }

  private shouldPrecomputeCollections(rootMap: Map<string, Map<any, any[]>>): boolean {
    if (!this.config.createPrecomputedCollections) return false;
    if (rootMap.size <= 1) return false;

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

  private createRootAllCollection(rootKey: string): void {
    const rootMap = this.indexedData.get(rootKey);
    if (!rootMap) return;
    if (rootMap.has('__all__')) return;

    const fields = this.fieldsByRoot.get(rootKey) || [];
    let total = 0;
    for (const f of fields) {
      const fm = rootMap.get(f);
      if (fm && fm.has('__all__')) {
        total += fm.get('__all__')!.length;
      }
    }
    const allData = new Array(total);
    let idx=0;
    for (const f of fields) {
      const fm = rootMap.get(f);
      if (fm && fm.has('__all__')) {
        const arr = fm.get('__all__')!;
        for (const it of arr) {
          allData[idx++] = it;
        }
      }
    }
    // store at rootMap.set("__all__", new Map<any, any[]>())...
    rootMap.set('__all__', new Map<any, any[]>());
    rootMap.get('__all__')!.set('__all__', allData);
  }

  /**
   * appendData(...) transforms the new data & merges it into the existing index
   */
  async appendData(data: any): Promise<any> {
    const startTime = performance.now();
    const transformedData = this.transformData(data);

    // Merge each root
    for (const rootKey in transformedData) {
      if (!Object.prototype.hasOwnProperty.call(transformedData, rootKey)) {
        continue;
      }
      const val = transformedData[rootKey];
      if (!this.indexedData.has(rootKey)) {
        // brand-new root
        this.indexSingleRoot(rootKey, val);
      } else {
        this.mergeRoot(rootKey, val);
      }
    }

    this.logPerformanceMetric('Append data', startTime, {}, data);
    return transformedData;
  }

  /**
   * mergeRoot(...) merges a new transformed root into the existing index.
   */
  private mergeRoot(rootKey: string, newVal: any): void {
    const rootMap = this.indexedData.get(rootKey)!;
    // If newVal is a Map => entity array
    if (newVal instanceof Map) {
      // For each field => entityId => items
      for (const [fieldName, entityIdMap] of newVal.entries()) {
        this.addFieldForRoot(rootKey, fieldName);
        if (!rootMap.has(fieldName)) {
          rootMap.set(fieldName, new Map<any, any[]>());
        }
        const fieldMap = rootMap.get(fieldName)!;

        if (entityIdMap instanceof Map) {
          for (const [entId, items] of entityIdMap.entries()) {
            if (!fieldMap.has(entId)) {
              fieldMap.set(entId, []);
            }
            fieldMap.get(entId)!.push(...items);

            // update __all__ if present
            if (fieldMap.has('__all__')) {
              fieldMap.get('__all__')!.push(...items);
            }
          }
        }
      }
    }
    // If it's an array => store in __default__
    else if (Array.isArray(newVal)) {
      if (!rootMap.has('__default__')) {
        rootMap.set('__default__', new Map<any, any[]>());
      }
      const defMap = rootMap.get('__default__')!;
      if (!defMap.has('__all__')) {
        defMap.set('__all__', []);
      }
      defMap.get('__all__')!.push(...newVal);

      if (this.config.indexArraysById) {
        for (const item of newVal) {
          if (item && item.id !== undefined) {
            if (!defMap.has(item.id)) {
              defMap.set(item.id, []);
            }
            defMap.get(item.id)!.push(item);
          }
        }
      }
    }
    // If it's an object => store single
    else if (newVal && typeof newVal === 'object') {
      if (!rootMap.has('__default__')) {
        rootMap.set('__default__', new Map<any, any[]>());
      }
      const defMap = rootMap.get('__default__')!;
      if (!defMap.has('__single__')) {
        defMap.set('__single__', []);
      }
      defMap.get('__single__')!.push(newVal);
    } else {
      // primitive
      if (!rootMap.has('__default__')) {
        rootMap.set('__default__', new Map<any, any[]>());
      }
      const defMap = rootMap.get('__default__')!;
      if (!defMap.has('__single__')) {
        defMap.set('__single__', []);
      }
      defMap.get('__single__')!.push(newVal);
    }
  }

  /**
   * initialize(...) => transform + index
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

  /**
   * lookup(rootId, field?, id?): O(1) retrieval.
   */
  lookup(rootId: string, field?: string, id?: any): any[] | undefined {
    const mappedRoot = this.adapterService.getFieldName(rootId);
    if (!this.indexedData.has(mappedRoot)) {
      return undefined;
    }
    const rootMap = this.indexedData.get(mappedRoot)!;

    // If no field => gather everything or check if there's a root-level __all__
    if (!field) {
      if (rootMap.has('__all__')) {
        return rootMap.get('__all__')!.get('__all__') || [];
      }
      return this.collectAllData(rootMap);
    }

    if (!rootMap.has(field)) {
      return undefined;
    }
    const fieldMap = rootMap.get(field)!;

    // If no id => return the entire field array
    if (id === undefined) {
      return fieldMap.get('__all__') || [];
    }
    return fieldMap.get(id);
  }

  private collectAllData(rootMap: Map<string, Map<any, any[]>>): any[] {
    let total = 0;
    for (const fm of rootMap.values()) {
      const arr = fm.get('__all__');
      if (arr) total += arr.length;
    }
    const out = new Array(total);
    let idx = 0;
    for (const fm of rootMap.values()) {
      const arr = fm.get('__all__');
      if (arr) {
        for (const it of arr) {
          out[idx++] = it;
        }
      }
    }
    return out;
  }
}