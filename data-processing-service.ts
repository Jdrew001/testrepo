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

@Injectable({
  providedIn: 'root'
})
export class DataProcessingService {
  private indexedData: IndexMap = new Map<string, Map<string, Map<any, any[]>>>();
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

  /**
   * If logPerformance is true, we log timing info. Optionally also log data if printDataInLogs is true.
   */
  private logPerformanceMetric(operation: string, startTime: number, extraInfo: Record<string, any> = {}, data?: any): void {
    if (!this.config.logPerformance) return;
    const endTime = performance.now();
    const duration = endTime - startTime;
    console.log(`[Performance] ${operation}: ${duration.toFixed(2)}ms`, { ...extraInfo, duration });
    if (this.config.printDataInLogs && data !== undefined) {
      console.log(`[Performance] ${operation} - data:`, data);
    }
  }

  /**
   * Main transform function:
   *  - Asks adapter if an array is an entity array
   *  - If false, just store it as-is
   *  - If true, store it as { field -> { entityId -> [ arrayOfItems ] } }
   */
  transformData(data: any): any {
    const startTime = performance.now();
    const result = this.config.useNullPrototype ? Object.create(null) : {};

    for (const rootId in data) {
      if (!Object.prototype.hasOwnProperty.call(data, rootId)) continue;

      const mappedRootId = this.adapterService.getFieldName(rootId);
      const rootValue = data[rootId];

      let isEntity = false;
      let entityType: string | undefined;

      if (Array.isArray(rootValue)) {
        const detection = this.adapterService.detectEntityArray(rootId, rootValue);
        isEntity = detection.isEntity;
        entityType = detection.entityType;
      }

      if (isEntity && Array.isArray(rootValue)) {
        // *** SPECIAL "entity array" transform ***
        const mappedObj = this.config.useNullPrototype ? Object.create(null) : {};

        for (const entity of rootValue) {
          const entityId = this.adapterService.extractEntityId(entityType, entity);
          if (!entityId) continue;

          // For each property in the entity, store it under mappedObj[prop][entityId]
          for (const prop in entity) {
            if (!Object.prototype.hasOwnProperty.call(entity, prop)) continue;
            const value = entity[prop];

            // If fieldsToIndex is set, skip if not included
            if (this.config.fieldsToIndex && !this.config.fieldsToIndex.includes(prop)) {
              continue;
            }

            if (!mappedObj[prop]) {
              mappedObj[prop] = this.config.useNullPrototype ? Object.create(null) : {};
            }
            if (!mappedObj[prop][entityId]) {
              mappedObj[prop][entityId] = [];
            }

            // If it's an object, attach parentId
            if (value && typeof value === 'object' && !Array.isArray(value)) {
              const cloned = this.cloneWithParentId(value, [entityId]);
              mappedObj[prop][entityId].push(cloned);
            }
            // If it's an array, attach parentId to each item
            else if (Array.isArray(value)) {
              const arrWithParent = this.fastAddParentIds(value, [entityId]);
              mappedObj[prop][entityId].push(...arrWithParent);
            }
            // Otherwise it's primitive
            else {
              mappedObj[prop][entityId].push({
                value,
                parentId: [entityId]
              });
            }
          }
        }
        result[mappedRootId] = mappedObj;
      } else {
        // *** NOT an entity array => store as-is ***
        result[mappedRootId] = rootValue;
      }
    }

    this.logPerformanceMetric('Transform data', startTime, {
      rootCount: Object.keys(result).length,
      originalSize: JSON.stringify(data).length,
      transformedSize: JSON.stringify(result).length
    }, this.config.printDataInLogs ? result : undefined);

    return result;
  }

  private cloneWithParentId(obj: any, parentIds: any[]): any {
    const result = this.config.useNullPrototype ? Object.create(null) : {};
    for (const k in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, k)) {
        result[k] = obj[k];
      }
    }
    result.parentId = parentIds;
    return result;
  }

  private fastAddParentIds(arr: any[], parentIds: any[]): any[] {
    const len = arr.length;
    const result = new Array(len);
    for (let i = 0; i < len; i++) {
      const item = arr[i];
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const cloned = this.cloneWithParentId(item, parentIds);
        // if item has children => do it recursively
        if (Array.isArray(item.children)) {
          cloned.children = this.fastAddParentIds(item.children, parentIds);
        }
        result[i] = cloned;
      } else {
        // primitive or array
        result[i] = { value: item, parentId: parentIds };
      }
    }
    return result;
  }

  /**
   * Index the data for O(1) lookups. The data should already be transformed.
   */
  async indexData(data: any): Promise<void> {
    const startTime = performance.now();
    this.indexedData.clear();
    this.fieldsByRoot.clear();

    for (const rootId in data) {
      if (!Object.prototype.hasOwnProperty.call(data, rootId)) continue;
      const rootVal = data[rootId];
      const rootStart = performance.now();

      this.indexSingleRoot(rootId, rootVal);

      this.logPerformanceMetric(`Indexing root: ${rootId}`, rootStart);
    }

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

    this.logPerformanceMetric('Index data', startTime, {}, data);
  }

  private indexSingleRoot(rootId: string, rootVal: any): void {
    this.indexedData.set(rootId, new Map<string, Map<any, any[]>>());
    const rootMap = this.indexedData.get(rootId)!;

    if (rootVal && typeof rootVal === 'object' && !Array.isArray(rootVal)) {
      // expected shape: { fieldName -> { entityId -> arrayOfItems } }
      for (const field in rootVal) {
        if (!Object.prototype.hasOwnProperty.call(rootVal, field)) continue;
        this.addFieldForRoot(rootId, field);

        rootMap.set(field, new Map<any, any[]>());
        const fieldMap = rootMap.get(field)!;
        const fieldValue = rootVal[field];

        if (fieldValue && typeof fieldValue === 'object' && !Array.isArray(fieldValue)) {
          // fieldValue: { entityId -> [ items ] }
          const entityIds = Object.keys(fieldValue);
          let totalItems = 0;
          for (const entityId of entityIds) {
            const items = fieldValue[entityId];
            fieldMap.set(entityId, items);
            totalItems += (items?.length || 0);
          }
          // create __all__ if not skipping
          if (!this.config.skipAllCollections && totalItems < 100000) {
            const allArr: any[] = [];
            allArr.length = totalItems;
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
        } else if (Array.isArray(fieldValue)) {
          fieldMap.set('__all__', fieldValue);
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
          // single object or primitive
          fieldMap.set('__single__', [fieldValue]);
        }
      }
    } else if (Array.isArray(rootVal)) {
      // store as default
      rootMap.set('__default__', new Map<any, any[]>());
      const defaultMap = rootMap.get('__default__')!;
      defaultMap.set('__all__', rootVal);
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
    } else {
      // single object or primitive
      rootMap.set('__default__', new Map<any, any[]>());
      rootMap.get('__default__')!.set('__single__', [rootVal]);
    }
  }

  private addFieldForRoot(rootId: string, field: string): void {
    if (!this.fieldsByRoot.has(rootId)) {
      this.fieldsByRoot.set(rootId, new Set<string>());
    }
    this.fieldsByRoot.get(rootId)!.add(field);
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

  private createRootAllCollection(rootId: string): void {
    const rootMap = this.indexedData.get(rootId);
    if (!rootMap) return;
    if (rootMap.has('__all__')) return;
    const fields = this.fieldsByRoot.get(rootId) || [];
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
        const items = fm.get('__all__')!;
        for (const it of items) {
          allData[idx++] = it;
        }
      }
    }
    rootMap.set('__all__', new Map<any, any[]>());
    rootMap.get('__all__')!.set('__all__', allData);
  }

  /**
   * Append new data to the existing index:
   *  1. Transform the data
   *  2. Merge it into the in-memory index
   */
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

    this.logPerformanceMetric('Append data', startTime, {}, this.config.printDataInLogs ? data : undefined);
    return transformedData;
  }

  private mergeRoot(rootId: string, newRootVal: any): void {
    const rootMap = this.indexedData.get(rootId);
    if (!rootMap) return;

    if (newRootVal && typeof newRootVal === 'object' && !Array.isArray(newRootVal)) {
      // shape: { field -> { entityId -> [items] } }
      for (const field in newRootVal) {
        if (!Object.prototype.hasOwnProperty.call(newRootVal, field)) continue;
        this.addFieldForRoot(rootId, field);

        if (!rootMap.has(field)) {
          rootMap.set(field, new Map<any, any[]>());
        }
        const fieldMap = rootMap.get(field)!;
        const fieldValue = newRootVal[field];

        if (fieldValue && typeof fieldValue === 'object' && !Array.isArray(fieldValue)) {
          // { entityId -> [items] }
          for (const entityId of Object.keys(fieldValue)) {
            const items = fieldValue[entityId];
            if (!fieldMap.has(entityId)) {
              fieldMap.set(entityId, []);
            }
            fieldMap.get(entityId)!.push(...items);
            // update __all__ if it exists
            if (fieldMap.has('__all__')) {
              fieldMap.get('__all__')!.push(...items);
            }
          }
        } else if (Array.isArray(fieldValue)) {
          if (!fieldMap.has('__all__')) {
            fieldMap.set('__all__', []);
          }
          fieldMap.get('__all__')!.push(...fieldValue);
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
          // single object
          if (!fieldMap.has('__single__')) {
            fieldMap.set('__single__', []);
          }
          fieldMap.get('__single__')!.push(fieldValue);
        }
      }
    } else if (Array.isArray(newRootVal)) {
      // push into __default__
      if (!rootMap.has('__default__')) {
        rootMap.set('__default__', new Map<any, any[]>());
      }
      const defaultMap = rootMap.get('__default__')!;
      if (!defaultMap.has('__all__')) {
        defaultMap.set('__all__', []);
      }
      defaultMap.get('__all__')!.push(...newRootVal);

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
    } else {
      // single object
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
   * Convenience: transform + index in one go.
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
   * Lookup data in O(1) from the indexed structure.
   */
  lookup(rootId: string, field?: string, id?: any): any[] | undefined {
    const mappedRootId = this.adapterService.getFieldName(rootId);
    if (!this.indexedData.has(mappedRootId)) {
      return undefined;
    }
    const rootMap = this.indexedData.get(mappedRootId)!;

    if (!field) {
      // no field => return all from __all__ or collectAll
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
}