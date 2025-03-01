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
  
  /**
   * Defines the public API for the data/index service, which:
   *  - Transforms raw data using the ReferenceAdapterService.
   *  - Potentially converts "entity arrays" into a Map-based structure:
   *      Map<string, Map<any, any[]>>
   *    (where the outer key is the field name and the inner key is the entity ID).
   *  - Builds an O(1) lookup structure (IndexMap) if desired.
   *  - Allows incremental appends.
   *
   * The transformData method returns an object where each root is either:
   *  - A Map<string, Map<any, any[]>> if it is detected as an entity array,
   *  - Or a plain array/object if it is not.
   *
   * The result can be used directly as an index or passed to indexData for further processing.
   */
  export interface IDataProcessingService {
    /**
     * Overwrite or extend the current configuration.
     */
    setConfig(config: Partial<IndexConfig>): void;
  
    /**
     * Transform the raw data:
     *  - Remap root keys via the adapter.
     *  - For arrays detected as "entity arrays", convert each property into a Map keyed by the entity ID
     *    (with parentId attached to nested objects).
     *  - Otherwise, keep plain arrays or objects.
     *
     * Returns an object where each root is either:
     *  - A Map<string, Map<any, any[]>> (if it's an entity array),
     *  - Or a plain array/object (if it's not an entity array).
     *
     * This result can be used directly as an index or further processed by indexData.
     */
    transformData(data: any): any;
  
    /**
     * Create an in-memory Map-based index (IndexMap) for O(1) lookups.
     * Typically you pass the output of transformData to this method.
     */
    indexData(data: any): Promise<void>;
  
    /**
     * Append new data to the existing index:
     *  1. Transform the new data (which may yield some Map-based structure).
     *  2. Merge it into the existing in-memory index.
     */
    appendData(data: any): Promise<any>;
  
    /**
     * O(1) lookup by (rootId, field?, id?).
     *
     * If no field is provided, it returns all items for that root.
     * If no id is provided, it returns all items for that field.
     */
    lookup(rootId: string, field?: string, id?: any): any[] | undefined;
  
    /**
     * Convenience method: transform raw data and index it in one call.
     * Returns the transformed data (which might be a mix of Maps and plain arrays/objects).
     */
    initialize(data: any, config?: Partial<IndexConfig>): Promise<any>;
  }