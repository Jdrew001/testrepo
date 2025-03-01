/**
 * Configuration for how data is transformed and indexed.
 */
export interface IndexConfig {
    /** Which fields to index. If undefined, all fields are indexed. */
    fieldsToIndex?: string[];
  
    /**
     * Whether to index arrays by an "id"-like property.
     * If true, we also store items keyed by item.id for direct lookups.
     */
    indexArraysById?: boolean;
  
    /** Chunk size for processing large arrays in batches. */
    chunkSize?: number;
  
    /** If true, skip creating aggregated "__all__" arrays for large datasets. */
    skipAllCollections?: boolean;
  
    /** If true, uses Object.create(null) for object creation. */
    useNullPrototype?: boolean;
  
    /** If true, create aggregated "__all__" arrays for each root/field. */
    createPrecomputedCollections?: boolean;
  
    /** Only build __all__ if item count exceeds this threshold. */
    precomputeThreshold?: number;
  
    /** If true, logs performance metrics to the console. */
    logPerformance?: boolean;
  
    /** If true, also prints transformed/indexed data (may be large). */
    printDataInLogs?: boolean;
  }
  
  /**
   * Defines the public API for the data/index service, which:
   *  - Transforms raw data using ReferenceAdapterService.
   *  - For "entity arrays," converts each property into a Map<entityId, any[]> 
   *    (with parentId attached).
   *  - For flat arrays or objects, stores the data as-is.
   *  - Builds an in-memory index for O(1) lookups.
   *  - Allows incremental appends.
   */
  export interface IDataProcessingService {
    /**
     * Update or extend the current configuration.
     */
    setConfig(config: Partial<IndexConfig>): void;
  
    /**
     * Transform raw data:
     *  - Remaps root keys via the adapter.
     *  - If an array is detected as an "entity array" (and is non-flat),
     *    converts it into a Map<field, Map<entityId, any[]>> with parentId attached.
     *  - Otherwise, leaves the data as-is.
     *
     * Returns an object where each root is either:
     *  - A Map<string, Map<any, any[]>> if it's an entity array, or
     *  - A plain array/object if it's not.
     */
    transformData(data: any): any;
  
    /**
     * Build an in-memory index (IndexMap) for O(1) lookups.
     * Typically, you pass the output of transformData to this method.
     */
    indexData(data: any): Promise<void>;
  
    /**
     * Append new data to the existing index:
     *  1. Transform the new data.
     *  2. Merge it into the existing index.
     */
    appendData(data: any): Promise<any>;
  
    /**
     * O(1) lookup by (rootId, field?, id?).
     * If no field is provided, returns all items for that root.
     * If no id is provided, returns all items for that field.
     */
    lookup(rootId: string, field?: string, id?: any): any[] | undefined;
  
    /**
     * Convenience method to transform and index data in one call.
     * Returns the transformed data (which may be a mix of Maps and plain arrays/objects).
     */
    initialize(data: any, config?: Partial<IndexConfig>): Promise<any>;
  }