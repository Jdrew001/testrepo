import { Injectable } from '@angular/core';
import { ReferenceAdapterService } from './reference-adapter.service';

export type IndexMap = Map<string, Map<string, Map<any, any[]>>>;

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

  constructor(private adapter: ReferenceAdapterService) {}

  setConfig(cfg: Partial<IndexConfig>): void {
    this.config = { ...this.config, ...cfg };
  }

  private logPerformance(operation: string, start: number, extra: Record<string, any> = {}, data?: any) {
    if (!this.config.logPerformance) return;
    const end = performance.now();
    const duration = end - start;
    console.log(`[Perf] ${operation}: ${duration.toFixed(2)}ms`, { ...extra, duration });
    if (this.config.printDataInLogs && data !== undefined) {
      console.log(`[Perf] ${operation} -> data:`, data);
    }
  }

  /**
   * transformData:
   *   - If the adapter says "entity array," store it in a Map<property, Map<entityId, any[]>>
   *     (attaching parentId recursively to nested objects).
   *   - Otherwise, store as a plain array/object (or a default).
   *
   * The result is an object at the top level:
   * {
   *   [mappedRootId]: Map<string, Map<any, any[]>> | any
   * }
   *
   * for entity arrays, or else just the array/object for non-entity data.
   */
  transformData(data: any): any {
    const startTime = performance.now();
    const result = this.config.useNullPrototype ? Object.create(null) : {};

    for (const rootId in data) {
      if (!Object.prototype.hasOwnProperty.call(data, rootId)) continue;

      const rootValue = data[rootId];
      const mappedRootId = this.adapter.getFieldName(rootId);

      let isEntity = false;
      let entityType: string | undefined;
      if (Array.isArray(rootValue)) {
        const detection = this.adapter.detectEntityArray(rootId, rootValue);
        isEntity = detection.isEntity;
        entityType = detection.entityType;
      }

      if (isEntity && Array.isArray(rootValue)) {
        // Build a Map<propName, Map<entityId, any[]>>
        const rootMap = new Map<string, Map<any, any[]>>();

        // For each item
        for (const entity of rootValue) {
          const entityId = this.adapter.extractEntityId(entityType, entity);
          if (!entityId) continue;

          // For each property in the entity
          for (const prop in entity) {
            if (!Object.prototype.hasOwnProperty.call(entity, prop)) continue;
            // If fieldsToIndex is set, skip fields not in it
            if (this.config.fieldsToIndex && !this.config.fieldsToIndex.includes(prop)) {
              continue;
            }
            const val = entity[prop];

            // Ensure we have a map for this property
            if (!rootMap.has(prop)) {
              rootMap.set(prop, new Map<any, any[]>());
            }
            const propMap = rootMap.get(prop)!;

            // Ensure we have an array at propMap.get(entityId)
            if (!propMap.has(entityId)) {
              propMap.set(entityId, []);
            }
            const itemsArray = propMap.get(entityId)!;

            // If it's an object, attach parentId
            if (val && typeof val === 'object' && !Array.isArray(val)) {
              const clonedObj = this.cloneWithParentId(val, [entityId]);
              itemsArray.push(clonedObj);
            }
            // If it's an array, attach parentId to each sub-item
            else if (Array.isArray(val)) {
              const arrWithParent = this.fastAddParentIds(val, [entityId]);
              itemsArray.push(...arrWithParent);
            }
            // Otherwise, primitive
            else {
              itemsArray.push({
                value: val,
                parentId: [entityId]
              });
            }
          }
        }
        // Store the Map at the top-level result
        result[mappedRootId] = rootMap;
      } else {
        // Not an entity array => store plain
        result[mappedRootId] = rootValue;
      }
    }

    this.logPerformance(
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
   * cloneWithParentId: shallow clones 'obj' and adds a parentId property.
   */
  private cloneWithParentId(obj: any, parentIds: any[]): any {
    const out = this.config.useNullPrototype ? Object.create(null) : {};
    for (const k in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, k)) {
        out[k] = obj[k];
      }
    }
    out.parentId = parentIds;
    return out;
  }

  /**
   * fastAddParentIds: for each item in 'arr', attach the same parentId. 
   * If the item has 'children', recursively do the same. 
   */
  private fastAddParentIds(arr: any[], parentIds: any[]): any[] {
    const len = arr.length;
    const result = new Array(len);
    for (let i = 0; i < len; i++) {
      const item = arr[i];
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const cloned = this.cloneWithParentId(item, parentIds);
        if (Array.isArray(item.children)) {
          cloned.children = this.fastAddParentIds(item.children, parentIds);
        }
        result[i] = cloned;
      } else {
        // primitive
        result[i] = { value: item, parentId: parentIds };
      }
    }
    return result;
  }

  /**
   * If you still want a separate "indexData" step, you can store 
   * the final shape in your own IndexMap or do lookups directly 
   * from the Map-based 'transformData' result. 
   * 
   * We'll show a simple approach that re-uses the final shape 
   * but ensures O(1) lookups by root + field + id.
   */
  async indexData(transformedData: any): Promise<void> {
    // If the 'transformedData' is already a Map for each root, 
    // you might not need a separate structure. But let's do it for consistency:
    this.indexedData.clear();
    this.fieldsByRoot.clear();
    
    const start = performance.now();
    // For each root in the transformed data
    for (const rootKey in transformedData) {
      if (!Object.prototype.hasOwnProperty.call(transformedData, rootKey)) continue;
      const val = transformedData[rootKey];
      const rootStart = performance.now();

      this.indexSingleRoot(rootKey, val);

      this.logPerformance(`Indexing root: ${rootKey}`, rootStart);
    }

    // Optionally build __all__
    if (this.config.createPrecomputedCollections) {
      const precStart = performance.now();
      for (const rootKey of this.indexedData.keys()) {
        const rootMap = this.indexedData.get(rootKey)!;
        if (this.shouldPrecomputeCollections(rootMap)) {
          this.createRootAllCollection(rootKey);
        }
      }
      this.logPerformance('Precomputation phase', precStart);
    }

    this.logPerformance('Index data', start, {}, transformedData);
  }

  private indexSingleRoot(rootKey: string, rootVal: any): void {
    // We'll store a Map<field, Map<id, any[]>> at the top level
    this.indexedData.set(rootKey, new Map<string, Map<any, any[]>>());
    const rootMap = this.indexedData.get(rootKey)!;

    // If it's a Map<prop, Map<entityId, any[]>>, it came from an entity array
    if (rootVal instanceof Map) {
      // For each property in the map
      for (const [field, entityIdMap] of rootVal.entries()) {
        this.addFieldForRoot(rootKey, field);
        // We'll store field in rootMap
        if (!rootMap.has(field)) {
          rootMap.set(field, new Map<any, any[]>());
        }
        const fieldMap = rootMap.get(field)!;

        // 'entityIdMap' is also a Map<entityId, any[]>
        if (entityIdMap instanceof Map) {
          let totalCount = 0;
          for (const [idVal, items] of entityIdMap.entries()) {
            fieldMap.set(idVal, items);
            totalCount += (items?.length || 0);
          }
          // create __all__ if not skipping
          if (!this.config.skipAllCollections && totalCount < 100000) {
            const allArr: any[] = [];
            allArr.length = totalCount;
            let idx = 0;
            for (const arr of entityIdMap.values()) {
              for (const item of arr) {
                allArr[idx++] = item;
              }
            }
            fieldMap.set('__all__', allArr);
          }
        }
      }
    }
    // If it's an array or object => store as default
    else if (Array.isArray(rootVal)) {
      rootMap.set('__default__', new Map<any, any[]>());
      const defMap = rootMap.get('__default__')!;
      defMap.set('__all__', rootVal);
      
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
    } else if (rootVal && typeof rootVal === 'object') {
      // single object
      rootMap.set('__default__', new Map<any, any[]>());
      rootMap.get('__default__')!.set('__single__', [rootVal]);
    } else {
      // primitive
      rootMap.set('__default__', new Map<any, any[]>());
      rootMap.get('__default__')!.set('__single__', [rootVal]);
    }
  }

  private addFieldForRoot(rootKey: string, field: string): void {
    if (!this.fieldsByRoot.has(rootKey)) {
      this.fieldsByRoot.set(rootKey, new Set<string>());
    }
    this.fieldsByRoot.get(rootKey)!.add(field);
  }

  private shouldPrecomputeCollections(rootMap: Map<string, Map<any, any[]>>): boolean {
    if (!this.config.createPrecomputedCollections) return false;
    if (rootMap.size <= 1) return false;
    if (this.config.precomputeThreshold) {
      let totalCount = 0;
      for (const fMap of rootMap.values()) {
        const arr = fMap.get('__all__');
        if (Array.isArray(arr)) totalCount += arr.length;
        if (totalCount > this.config.precomputeThreshold) {
          return true;
        }
      }
      return totalCount > this.config.precomputeThreshold;
    }
    return true;
  }

  private createRootAllCollection(rootKey: string): void {
    const rootMap = this.indexedData.get(rootKey)!;
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
    rootMap.set('__all__', new Map<any, any[]>());
    rootMap.get('__all__')!.set('__all__', allData);
  }

  /**
   * If you want to append more data, transform + merge similarly.
   */
  async appendData(data: any): Promise<any> {
    const start = performance.now();
    const newTransformed = this.transformData(data);

    // merge new root => indexSingleRoot or something similar
    for (const rootKey in newTransformed) {
      if (!Object.prototype.hasOwnProperty.call(newTransformed, rootKey)) continue;

      if (!this.indexedData.has(rootKey)) {
        this.indexSingleRoot(rootKey, newTransformed[rootKey]);
      } else {
        this.mergeRoot(rootKey, newTransformed[rootKey]);
      }
    }
    this.logPerformance('Append data', start, {}, data);
    return newTransformed;
  }

  private mergeRoot(rootKey: string, newVal: any): void {
    const rootMap = this.indexedData.get(rootKey)!;

    // If it's a Map => entity array structure
    if (newVal instanceof Map) {
      for (const [field, entityIdMap] of newVal.entries()) {
        this.addFieldForRoot(rootKey, field);
        if (!rootMap.has(field)) {
          rootMap.set(field, new Map<any, any[]>());
        }
        const fieldMap = rootMap.get(field)!;

        if (entityIdMap instanceof Map) {
          for (const [entityId, items] of entityIdMap.entries()) {
            if (!fieldMap.has(entityId)) {
              fieldMap.set(entityId, []);
            }
            fieldMap.get(entityId)!.push(...items);

            // update __all__ if present
            if (fieldMap.has('__all__')) {
              fieldMap.get('__all__')!.push(...items);
            }
          }
        }
      }
    }
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
    else if (newVal && typeof newVal === 'object') {
      // single object
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
   * Combine transform + index in one go:
   */
  async initialize(data: any, config?: Partial<IndexConfig>): Promise<any> {
    if (config) {
      this.setConfig(config);
    }
    console.time('transform');
    const transformed = this.transformData(data);
    console.timeEnd('transform');

    console.time('index');
    await this.indexData(transformed);
    console.timeEnd('index');

    return transformed;
  }

  /**
   * O(1) lookup by [rootId][field][id].
   */
  lookup(rootId: string, field?: string, id?: any): any[] | undefined {
    const mappedRoot = this.adapter.getFieldName(rootId);
    if (!this.indexedData.has(mappedRoot)) return undefined;
    const rootMap = this.indexedData.get(mappedRoot)!;

    if (!field) {
      // if no field, gather everything or see if there's a root-level __all__
      if (rootMap.has('__all__')) {
        return rootMap.get('__all__')!.get('__all__') || [];
      }
      return this.collectAllData(rootMap);
    }

    if (!rootMap.has(field)) {
      return undefined;
    }
    const fieldMap = rootMap.get(field)!;
    if (id === undefined) {
      return fieldMap.get('__all__') || [];
    }
    return fieldMap.get(id);
  }

  private collectAllData(rootMap: Map<string, Map<any, any[]>>): any[] {
    let total=0;
    for (const fieldMap of rootMap.values()) {
      const arr = fieldMap.get('__all__');
      if (arr) total += arr.length;
    }
    const out = new Array(total);
    let idx=0;
    for (const fieldMap of rootMap.values()) {
      const arr = fieldMap.get('__all__');
      if (arr) {
        for (const it of arr) {
          out[idx++] = it;
        }
      }
    }
    return out;
  }
}