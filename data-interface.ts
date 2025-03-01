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
  
    /**
     * An optional array of root keys that should be treated as flat.
     * When a root key is included here, its data is left untransformed.
     */
    flatRoots?: string[];
  }
  
  /**
   * Public API for the DataProcessingService.
   * - transformData: converts raw data into either a Map-based structure (for nested entity arrays)
   *   or returns the original plain array/object (for flat arrays).
   * - indexData: builds an in-memory nested Map index (IndexMap) for O(1) lookups.
   * - lookup: performs O(1) retrieval by root, field, and optionally entityId.
   * - appendData: merges new data into the existing index.
   * - initialize: convenience method to transform and index data in one call.
   */
  export interface IDataProcessingService {
    setConfig(config: Partial<IndexConfig>): void;
    transformData(data: any): any;
    indexData(data: any): Promise<void>;
    appendData(data: any): Promise<any>;
    lookup(rootId: string, field?: string, id?: any): any[] | undefined;
    initialize(data: any, config?: Partial<IndexConfig>): Promise<any>;
  }