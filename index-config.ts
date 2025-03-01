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
  
  /** Only precompute large collections if item count exceeds this. */
  precomputeThreshold?: number;
  
  /** If true, logs performance metrics (transform time, indexing time, etc.). */
  logPerformance?: boolean;
}