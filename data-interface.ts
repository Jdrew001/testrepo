/**
 * Configuration for how data is transformed and indexed.
 */
export interface IndexConfig {
    /** Which fields to index. If undefined, all fields are indexed. */
    fieldsToIndex?: string[];
    
    /**
     * Whether to index arrays by an "id"-like property. If false,
     * the service won't create map entries keyed by item.id.
     */
    indexArraysById?: boolean;
    
    /** Chunk size if you want to process large arrays in batches. */
    chunkSize?: number;
    
    /** If true, skip creating __all__ arrays to save time/memory. */
    skipAllCollections?: boolean;
    
    /** If true, use `Object.create(null)` for faster object creation. */
    useNullPrototype?: boolean;
    
    /** If true, create aggregated "__all__" arrays for each field or root. */
    createPrecomputedCollections?: boolean;
    
    /** Only precompute large collections if item count exceeds this number. */
    precomputeThreshold?: number;
    
    /** If true, logs performance metrics (transform time, indexing time, etc.) to console. */
    logPerformance?: boolean;
  }
  
  /**
   * Defines the public API for the data/index service, which:
   *  - transforms raw data using ReferenceAdapterService
   *  - creates O(1) lookup structures
   *  - allows appending additional data
   */
  export interface IDataProcessingService {
    /**
     * Overwrite or extend the current indexing configuration.
     */
    setConfig(config: Partial<IndexConfig>): void;
  
    /**
     * Transform the raw data according to the adapter mappings and entity detection
     * (e.g., rename root keys, attach parentId to nested objects, etc.).
     * 
     * For flat arrays with no nested objects, this will simply pass them through;
     * for nested arrays, the service will try to identify them as "entity arrays."
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
     *  3. Optionally update precomputed collections
     */
    appendData(data: any): Promise<any>;
  
    /**
     * Lookup data with O(1) time complexity, given:
     *  - rootId (auto-mapped by adapter)
     *  - optional field
     *  - optional ID for that field
     * 
     * Returns an array of matching items, or undefined if none found.
     */
    lookup(rootId: string, field?: string, id?: any): any[] | undefined;
  
    /**
     * Initialize the service in one shot:
     *   1. Transform the raw data
     *   2. Index the data
     * 
     * Returns the transformed data so you can inspect or store it if you like.
     */
    initialize(data: any, config?: Partial<IndexConfig>): Promise<any>;
  }