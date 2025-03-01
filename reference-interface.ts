/**
 * Configuration for how data is transformed and indexed.
 */
export interface IndexConfig {
    /** Which fields to index. If undefined, all fields are indexed. */
    fieldsToIndex?: string[];
  
    /** Whether to index arrays by an "id"-like property. */
    indexArraysById?: boolean;
  
    /** Chunk size if you want to process large arrays in batches. */
    chunkSize?: number;
  
    /** If true, skip creating "__all__" arrays. */
    skipAllCollections?: boolean;
  
    /** If true, use Object.create(null) for new objects. */
    useNullPrototype?: boolean;
  
    /** If true, create big "__all__" arrays per field or root. */
    createPrecomputedCollections?: boolean;
  
    /** Only precompute if item count > this threshold. */
    precomputeThreshold?: number;
  
    /** If true, logs performance (transform time, indexing time). */
    logPerformance?: boolean;
  
    /** If true, also prints the data for transform/index steps (can be large). */
    printDataInLogs?: boolean;
  }
  
  /**
   * Defines the public API for the data/index service, which:
   *  - Transforms raw data using ReferenceAdapterService
   *  - Creates O(1) lookup structures
   *  - Allows appending additional data
   * 
   * This service must respect the adapter's "isEntity" or "not entity" decision
   * (single-item arrays remain plain arrays, multi-item arrays with IDs become per-property).
   */
  export interface IDataProcessingService {
    /**
     * Overwrite or extend the current indexing configuration.
     */
    setConfig(config: Partial<IndexConfig>): void;
  
    /**
     * Transform the raw data according to the adapter mappings and entity detection.
     * - If adapter says "isEntity" for an array, it splits out fields by [entityId].
     * - Otherwise, leaves arrays or objects as-is.
     */
    transformData(data: any): any;
  
    /**
     * Create in-memory indexes (Maps) for fast O(1) lookups.
     * The data passed to `indexData` should already be transformed
     * by `transformData(...)`.
     */
    indexData(data: any): Promise<void>;
  
    /**
     * Append new data to the existing index, without re-processing everything.
     *  1. Transform the data
     *  2. Merge it into the in-memory index
     */
    appendData(data: any): Promise<any>;
  
    /**
     * Lookup data with O(1) time complexity, given:
     *  - rootId (auto-mapped by adapter)
     *  - optional field
     *  - optional ID for that field
     * 
     * Returns an array of matching items, or undefined if not found.
     */
    lookup(rootId: string, field?: string, id?: any): any[] | undefined;
  
    /**
     * Initialize the service in one shot:
     *   1. Transform the raw data (respecting single-item arrays or multi-entity arrays)
     *   2. Index the data
     * 
     * Returns the transformed data so you can inspect or store it.
     */
    initialize(data: any, config?: Partial<IndexConfig>): Promise<any>;
  }