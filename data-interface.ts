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
   * Returns a new, transformed data structure.
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
   *  1. Transform the raw data
   *  2. Index the data
   * 
   * Returns the transformed data so you can inspect or store it.
   */
  initialize(data: any, config?: Partial<IndexConfig>): Promise<any>;
}