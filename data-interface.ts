/**
 * Configuration for how data is transformed and indexed.
 */
export interface IndexConfig {
    /** Which fields to index. If undefined, all fields are indexed. */
    fieldsToIndex?: string[];
  
    /**
     * Whether to index arrays by an "id"-like property.
     * If true, we store them under a [item.id] -> item mapping as well.
     */
    indexArraysById?: boolean;
  
    /** Chunk size if you want to process large arrays in small batches. */
    chunkSize?: number;
  
    /** If true, skip creating "__all__" arrays for large datasets. */
    skipAllCollections?: boolean;
  
    /** If true, uses `Object.create(null)` for object creation for performance. */
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
  
  /**
   * Defines the public API for the data/index service, which:
   *  - Transforms raw data using ReferenceAdapterService
   *  - Potentially converts "entity arrays" into Map<field, Map<entityId, any[]>>
   *  - Builds an O(1) lookup structure (IndexMap) if desired
   *  - Allows incremental appends
   */
  export interface IDataProcessingService {
    /**
     * Overwrite or extend the current configuration.
     */
    setConfig(config: Partial<IndexConfig>): void;
  
    /**
     * Transform the raw data:
     *  - rename root keys via adapter
     *  - if an array is "entity array", store each property in a Map<entityId, any[]> 
     *    with parentId attached to nested objects
     *  - otherwise keep plain arrays or objects
     * 
     * Returns an object where each root is either:
     *  - A Map<string, Map<any, any[]>> if it's an entity array
     *  - A normal array/object if it's not
     *
     * The result can be used directly as an index, or you can do a separate `indexData` step.
     */
    transformData(data: any): any;
  
    /**
     * Create an in-memory Map-based index (IndexMap) for O(1) lookups.
     * Usually you pass the output of `transformData(...)`.
     */
    indexData(data: any): Promise<void>;
  
    /**
     * Append new data to the existing index:
     *  1. Transform the data (which may yield some Map structure)
     *  2. Merge it into the in-memory index
     */
    appendData(data: any): Promise<any>;
  
    /**
     * O(1) lookup by (rootId, field?, id?). 
     * If no field is given, it returns all items for that root.
     * If no id is given, it returns all items for that field.
     */
    lookup(rootId: string, field?: string, id?: any): any[] | undefined;
  
    /**
     * Convenience: transform + index in one shot. 
     * Returns the transformed data (which might be a mix of Maps and plain arrays).
     */
    initialize(data: any, config?: Partial<IndexConfig>): Promise<any>;
  }