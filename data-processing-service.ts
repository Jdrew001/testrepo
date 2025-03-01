import { Injectable } from '@angular/core';
import { ReferenceAdapterService } from './reference-adapter.service';

export type IndexMap = Map<string, Map<string, Map<any, any[]>>>;

export interface IndexConfig {
  /** Which fields to index. If undefined, all fields are indexed. */
  fieldsToIndex?: string[];

  /**
   * Whether to index arrays by an "id"-like property.
   * If true, we store items keyed by item.id as well.
   */
  indexArraysById?: boolean;

  /** Chunk size if you want to process large arrays in small batches. */
  chunkSize?: number;

  /** If true, skip creating aggregated "__all__" arrays for large datasets. */
  skipAllCollections?: boolean;

  /** If true, uses Object.create(null) for object creation for performance. */
  useNullPrototype?: boolean;

  /** If true, create aggregated "__all__" arrays for each root/field. */
  createPrecomputedCollections?: boolean;

  /** Only build __all__ if item count exceeds this threshold. */
  precomputeThreshold?: number;

  /** If true, logs performance times (transform, index) to the console. */
  logPerformance?: boolean;

  /** If true, also prints the transformed/indexed data. Beware of large logs. */
  printDataInLogs?: boolean;
}

@Injectable({ providedIn: 'root' })
export class DataProcessingService {
  private indexedData: IndexMap = new Map();
  private fieldsByRoot: Map<string, Set<string>> = new Map();

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

  setConfig(config: Partial<IndexConfig>): void {
    this.config = { ...this.config, ...config };
  }

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
   * Helper: Determines if an item is "flat" (i.e. all properties are primitives).
   */
  private isFlat(item: any): boolean {
    if (item === null) return true;
    if (typeof item !== 'object') return true;
    for (const key in item) {
      if (!Object.prototype.hasOwnProperty.call(item, key)) continue;
      const val = item[key];
      if (val !== null && typeof val === 'object') {
        return false;
      }
    }
    return true;
  }

  /**
   * Helper: Determines if every item in an array is flat.
   */
  private isFlatArray(arr: any[]): boolean {
    return arr.every(item => this.isFlat(item));
  }

  /**
   * transformData:
   * - Uses the adapter to decide if a root is an entity array.
   * - If yes and if the array is not flat, creates a Map<field, Map<entityId, any[]>>
   *   structure with parentId attached to nested objects.
   * - If not (i.e. the array is flat), returns the root as-is.
   */
  transformData(data: any): any {
    const startTime = performance.now();
    const result = this.config.useNullPrototype ? Object.create(null) : {};

    for (const rootId in data) {
      if (!Object.prototype.hasOwnProperty.call(data, rootId)) continue;
      const rootValue = data[rootId];
      const mappedRootId = this.adapterService.getFieldName(rootId);

      let isEntity = false;
      let entityType: string | undefined;
      if (Array.isArray(rootValue)) {
        const detection = this.adapterService.detectEntityArray(rootId, rootValue);
        isEntity = detection.isEntity;
        entityType = detection.entityType;
      }

      // If it's an array and detected as entity and NOT flat, then transform to a Map
      if (isEntity && Array.isArray(rootValue) && !this.isFlatArray(rootValue)) {
        const rootMap = new Map<string, Map<any, any[]>>();
        for (const entity of rootValue) {
          const entityId = this.adapterService.extractEntityId(entityType, entity);
          if (!entityId) continue;
          for (const prop in entity) {
            if (!Object.prototype.hasOwnProperty.call(entity, prop)) continue;
            // Respect fieldsToIndex if set
            if (this.config.fieldsToIndex && !this.config.fieldsToIndex.includes(prop)) continue;
            const val = entity[prop];

            if (!rootMap.has(prop)) {
              rootMap.set(prop, new Map<any, any[]>());
            }
            const fieldMap = rootMap.get(prop)!;
            if (!fieldMap.has(entityId)) {
              fieldMap.set(entityId, []);
            }
            const itemsArray = fieldMap.get(entityId)!;
            if (val && typeof val === 'object' && !Array.isArray(val)) {
              const cloned = this.cloneWithParentId(val, [entityId]);
              itemsArray.push(cloned);
            } else if (Array.isArray(val)) {
              const arrWithParent = this.fastAddParentIds(val, [entityId]);
              itemsArray.push(...arrWithParent);
            } else {
              itemsArray.push({ value: val, parentId: [entityId] });
            }
          }
        }
        result[mappedRootId] = rootMap;
      } else {
        // For flat arrays or non-arrays, store as-is.
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
   * indexData:
   * Takes the output from transformData and stores it in a nested Map (this.indexedData)
   * for O(1) lookups. For flat arrays (non-entity arrays), stores them under a "__default__" key.
   */
  async indexData(transformedData: any): Promise<void> {
    const startTime = performance.now();
    this.indexedData.clear();
    this.fieldsByRoot.clear();

    for (const rootKey in transformedData) {
      if (!Object.prototype.hasOwnProperty.call(transformedData, rootKey)) continue;
      const rootVal = transformedData[rootKey];
      const rootStart = performance.now();
      this.indexSingleRoot(rootKey, rootVal);
      this.logPerformanceMetric(`Indexing root: ${rootKey}`, rootStart);
    }

    if (this.config.createPrecomputedCollections) {
      const precStart = performance.now();
      for (const rootKey of Array.from(this.indexedData.keys())) {
        const rootMap = this.indexedData.get(rootKey)!;
        if (this.shouldPrecomputeCollections(rootMap)) {
          this.createRootAllCollection(rootKey);
        }
      }
      this.logPerformanceMetric('Precomputation phase', precStart);
    }

    this.logPerformanceMetric('Index data', startTime, {}, transformedData);
  }

  private indexSingleRoot(rootKey: string, rootVal: any): void {
    this.indexedData.set(rootKey, new Map<string, Map<any, any[]>>());
    const rootMap = this.indexedData.get(rootKey)!;

    // If rootVal is a Map (entity array structure)
    if (rootVal instanceof Map) {
      for (const [field, entityMap] of rootVal.entries()) {
        this.addFieldForRoot(rootKey, field);
        if (!rootMap.has(field)) {
          rootMap.set(field, new Map<any, any[]>());
        }
        const fieldMap = rootMap.get(field)!;
        if (entityMap instanceof Map) {
          let totalCount = 0;
          for (const [entityId, items] of entityMap.entries()) {
            fieldMap.set(entityId, items);
            totalCount += items?.length || 0;
          }
          if (!this.config.skipAllCollections && totalCount < 100000) {
            const allArr: any[] = [];
            allArr.length = totalCount;
            let idx = 0;
            for (const arr of entityMap.values()) {
              for (const item of arr) {
                allArr[idx++] = item;
              }
            }
            fieldMap.set('__all__', allArr);
          }
        }
      }
    }
    // If rootVal is an array (flat array), store it under "__default__"
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
    }
    // If rootVal is an object, store it as a single object.
    else if (rootVal && typeof rootVal === 'object') {
      rootMap.set('__default__', new Map<any, any[]>());
      rootMap.get('__default__')!.set('__single__', [rootVal]);
    } else {
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
      for (const fieldMap of rootMap.values()) {
        const arr = fieldMap.get('__all__');
        if (Array.isArray(arr)) totalCount += arr.length;
        if (totalCount > this.config.precomputeThreshold) return true;
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
    let totalSize = 0;
    for (const f of fields) {
      const fm = rootMap.get(f);
      if (fm && fm.has('__all__')) {
        totalSize += fm.get('__all__')!.length;
      }
    }
    const allData = new Array(totalSize);
    let idx = 0;
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

  async appendData(data: any): Promise<any> {
    const startTime = performance.now();
    const transformedData = this.transformData(data);
    for (const rootKey in transformedData) {
      if (!Object.prototype.hasOwnProperty.call(transformedData, rootKey)) continue;
      const val = transformedData[rootKey];
      if (!this.indexedData.has(rootKey)) {
        this.indexSingleRoot(rootKey, val);
      } else {
        this.mergeRoot(rootKey, val);
      }
    }
    this.logPerformanceMetric('Append data', startTime, {}, data);
    return transformedData;
  }

  private mergeRoot(rootKey: string, newVal: any): void {
    const rootMap = this.indexedData.get(rootKey);
    if (!rootMap) return;
    if (newVal instanceof Map) {
      for (const [field, entityMap] of newVal.entries()) {
        this.addFieldForRoot(rootKey, field);
        if (!rootMap.has(field)) {
          rootMap.set(field, new Map<any, any[]>());
        }
        const fieldMap = rootMap.get(field)!;
        if (entityMap instanceof Map) {
          for (const [entityId, items] of entityMap.entries()) {
            if (!fieldMap.has(entityId)) {
              fieldMap.set(entityId, []);
            }
            fieldMap.get(entityId)!.push(...items);
            if (fieldMap.has('__all__')) {
              fieldMap.get('__all__')!.push(...items);
            }
          }
        }
      }
    } else if (Array.isArray(newVal)) {
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
    } else if (newVal && typeof newVal === 'object') {
      if (!rootMap.has('__default__')) {
        rootMap.set('__default__', new Map<any, any[]>());
      }
      const defMap = rootMap.get('__default__')!;
      if (!defMap.has('__single__')) {
        defMap.set('__single__', []);
      }
      defMap.get('__single__')!.push(newVal);
    } else {
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

  lookup(rootId: string, field?: string, id?: any): any[] | undefined {
    const mappedRoot = this.adapterService.getFieldName(rootId);
    if (!this.indexedData.has(mappedRoot)) {
      return undefined;
    }
    const rootMap = this.indexedData.get(mappedRoot)!;
    if (!field) {
      if (rootMap.has('__all__')) {
        return rootMap.get('__all__')!.get('__all__') || [];
      }
      if (rootMap.has('__default__')) {
        return rootMap.get('__default__')!.get('__all__') || [];
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