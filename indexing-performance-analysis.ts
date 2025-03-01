import { Injectable } from '@angular/core';
import { ReferenceAdapterService } from './reference-adapter.service';

/**
 * Type definitions for the indexing system
 */
export type IndexMap = Map<string, Map<string, Map<any, any[]>>>;

/**
 * Interface for index configuration options
 */
export interface IndexConfig {
  /** Fields to index (limits indexing to specific fields for better performance) */
  fieldsToIndex?: string[];
  
  /** Whether to index arrays by ID (false can improve performance if not needed) */
  indexArraysById?: boolean;
  
  /** Whether to skip creating "__all__" collections for large datasets */
  skipAllCollections?: boolean;
  
  /** Whether to use Object.create(null) instead of {} for better performance */
  useNullPrototype?: boolean;
  
  /** Whether to create pre-computed collections for O(1) lookup */
  createPrecomputedCollections?: boolean;
  
  /** Minimum size threshold for pre-computing collections (items count) */
  precomputeThreshold?: number;
}

/**
 * Optimized data indexing service
 */
@Injectable({
  providedIn: 'root'
})
export class OptimizedIndexingService {
  private indexedData: IndexMap = new Map<string, Map<string, Map<any, any[]>>>();
  private fieldsByRoot: Map<string, string[]> = new Map();
  
  // Default configuration
  private config: IndexConfig = {
    fieldsToIndex: undefined, // All fields
    indexArraysById: true,
    skipAllCollections: false,
    useNullPrototype: true,
    createPrecomputedCollections: true,
    precomputeThreshold: 1000 // Only pre-compute for collections with more than 1000 items
  };
  
  constructor(private adapterService: ReferenceAdapterService) {}
  
  /**
   * Set configuration options for indexing
   */
  setConfig(config: Partial<IndexConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  /**
   * Index the data for O(1) lookups - optimized for large datasets
   * Returns a promise with timing information
   */
  async indexData(data: any): Promise<{ 
    totalTime: number, 
    basicIndexTime: number, 
    precomputeTime: number 
  }> {
    // Clear existing index
    this.indexedData.clear();
    this.fieldsByRoot.clear();
    
    const startTime = performance.now();
    let basicIndexTime = 0;
    let precomputeTime = 0;
    
    // First pass: Basic indexing
    const basicIndexStart = performance.now();
    
    for (const rootId in data) {
      if (!Object.prototype.hasOwnProperty.call(data, rootId)) continue;
      this.indexSingleRoot(rootId, data[rootId]);
    }
    
    basicIndexTime = performance.now() - basicIndexStart;
    
    // Second pass: Create pre-computed collections if configured
    if (this.config.createPrecomputedCollections) {
      const precomputeStart = performance.now();
      
      // Only create pre-computed collections if the dataset is large enough
      for (const [rootId, rootMap] of this.indexedData.entries()) {
        const shouldPrecompute = this.shouldPrecomputeCollections(rootMap);
        
        if (shouldPrecompute) {
          this.createRootAllCollection(rootId);
        }
      }
      
      precomputeTime = performance.now() - precomputeStart;
    }
    
    const totalTime = performance.now() - startTime;
    
    return {
      totalTime,
      basicIndexTime,
      precomputeTime
    };
  }
  
  /**
   * Determine if we should pre-compute collections for this root
   */
  private shouldPrecomputeCollections(rootMap: Map<string, Map<any, any[]>>): boolean {
    if (!this.config.createPrecomputedCollections) return false;
    
    // If there's a threshold, check if any field exceeds it
    if (this.config.precomputeThreshold) {
      // Check if any field has more than the threshold items
      let totalItems = 0;
      
      for (const fieldMap of rootMap.values()) {
        if (fieldMap.has('__all__')) {
          totalItems += fieldMap.get('__all__')!.length;
          
          // If any field exceeds the threshold, pre-compute
          if (totalItems > this.config.precomputeThreshold) {
            return true;
          }
        }
      }
      
      // If total items across all fields exceeds the threshold, pre-compute
      return totalItems > this.config.precomputeThreshold;
    }
    
    // Default to true if no specific configuration
    return true;
  }
  
  /**
   * Index a single root element
   */
  private indexSingleRoot(rootId: string, rootValue: any): void {
    // Implementation details would go here
    // (Same as in the previous code)
    
    // Initialize the root map
    this.indexedData.set(rootId, new Map<string, Map<any, any[]>>());
    
    // Cache fields for this root for faster lookups
    this.cacheFieldsForRoot(rootId);
  }
  
  /**
   * Cache fields for a root for faster lookups
   */
  private cacheFieldsForRoot(rootId: string): void {
    const rootMap = this.indexedData.get(rootId);
    if (!rootMap) return;
    
    // Get all fields except special ones
    const fields = Array.from(rootMap.keys()).filter(
      field => field !== '__all__' && field !== '__default__'
    );
    
    // Cache for future use
    this.fieldsByRoot.set(rootId, fields);
  }
  
  /**
   * Create an __all__ collection for a root to ensure O(1) lookup
   * This is only done for roots that would benefit from it
   */
  private createRootAllCollection(rootId: string): void {
    const rootMap = this.indexedData.get(rootId);
    if (!rootMap) return;
    
    // Skip if already has __all__ collection
    if (rootMap.has('__all__')) return;
    
    // Get all fields for this root (excluding special fields)
    const fields = this.fieldsByRoot.get(rootId) || [];
    
    // Skip for simple arrays
    if (fields.length === 0 && rootMap.has('__default__')) return;
    
    // Estimate total size for pre-allocation
    let totalSize = 0;
    
    for (const field of fields) {
      const fieldMap = rootMap.get(field);
      if (fieldMap && fieldMap.has('__all__')) {
        totalSize += fieldMap.get('__all__')!.length;
      }
    }
    
    // Only pre-compute if there's a significant amount of data
    if (totalSize < (this.config.precomputeThreshold || 0)) {
      return;
    }
    
    // Create __all__ collection that contains all data
    const allData = new Array(totalSize);
    let index = 0;
    
    // For each field
    for (const field of fields) {
      const fieldMap = rootMap.get(field);
      if (fieldMap && fieldMap.has('__all__')) {
        // Add all data from this field
        const items = fieldMap.get('__all__')!;
        for (let i = 0; i < items.length; i++) {
          allData[index++] = items[i];
        }
      }
    }
    
    // Trim if necessary
    if (index < totalSize) {
      allData.length = index;
    }
    
    // Store the __all__ collection
    rootMap.set('__all__', allData);
  }
  
  /**
   * Lookup data with O(1) time complexity
   * Implemented lookups would go here
   * (Same as in the previous code with optimizations)
   */
  lookup(rootId: string, field?: string, parentId?: any): any[] | undefined {
    // Lookup implementation
    return undefined; // Placeholder
  }
}
