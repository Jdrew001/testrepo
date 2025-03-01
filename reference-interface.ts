/**
 * Configuration for an entity type. Typically optional in a "fully dynamic" approach,
 * but you can override if you want to force or forbid detection for certain root IDs.
 */
export interface EntityTypeConfig {
    /** 
     * If you know the exact property name used for an ID (e.g., "aeId"), set it here. 
     * Otherwise, the adapter tries to find a suitable ID-like field dynamically.
     */
    entityIdProperty?: string;
  
    /**
     * Function to decide if an array is an entity array. If provided,
     * it overrides the default "fully dynamic" approach for that root ID.
     */
    detector?: (data: any[]) => boolean;
  
    /**
     * Function that extracts an ID from a single entity object,
     * e.g., (obj) => obj["aeId"].
     * If omitted, the adapter uses heuristics for ID detection.
     */
    idExtractor?: (entity: any) => any;
  }
  
  /**
   * Defines the public API for a "fully dynamic" ReferenceAdapterService,
   * which:
   *  - renames root IDs via user-defined mappings,
   *  - automatically decides if an array is an entity array by scanning for
   *    a consistent, unique ID-like property (e.g. "id", "aeId", "code", etc.),
   *  - optionally checks for nested structure if desired,
   *  - does NOT skip single-item arrays (any array with a recognized ID is considered "entity"),
   *  - extracts or infers entity IDs if no property is explicitly configured.
   */
  export interface IReferenceAdapterService {
    /**
     * Map a given rootId (like "entity") to a new field name (like "aeGrid").
     */
    registerFieldMapping(rootId: string, fieldName: string): void;
  
    /**
     * Register multiple rootId->fieldName mappings in one call.
     */
    registerFieldMappings(mappings: Record<string, string>): void;
  
    /**
     * Get the mapped field name for a rootId, or return rootId if no mapping exists.
     */
    getFieldName(rootId: string): string;
  
    /**
     * Clear all field mappings.
     */
    clearMappings(): void;
  
    /**
     * Retrieve all current mappings as a plain object.
     */
    getAllMappings(): Record<string, string>;
  
    /**
     * (Optional) If you want to force or forbid detection for a certain root,
     * you can provide a config with entityIdProperty or a custom detector.
     */
    configureEntityType(entityType: string, config: EntityTypeConfig): void;
  
    /**
     * Configure multiple entity types at once.
     */
    configureEntityTypes(configs: Record<string, EntityTypeConfig>): void;
  
    /**
     * Turn on or off the auto-detection heuristics for arrays that might be "entity arrays."
     * If set to false, only configured types or user-defined detectors will be recognized.
     */
    setAutoDetection(enabled: boolean): void;
  
    /**
     * Enable/disable debug logs for detection steps, so you can see console output
     * about ID property scanning, single-item arrays, etc.
     */
    setDebugLogs(enabled: boolean): void;
  
    /**
     * Given a rootId and array of items, decide if it's an entity array.
     * If true, also return which entityType was detected (e.g. "auto-detected").
     * 
     * In the "fully dynamic" approach, this method:
     *  - Ignores array length (single items OK),
     *  - Scans for an ID-like property across all items,
     *  - Possibly checks for nested object structure if you want,
     *  - If found, returns { isEntity: true, entityType: 'auto-detected' }.
     */
    detectEntityArray(
      rootId: string,
      data: any[]
    ): { isEntity: boolean; entityType?: string };
  
    /**
     * Extract (or infer) the ID from an entity object.
     * If an entityType is known, it uses that config; otherwise it checks typical fields
     * like "id", "aeId", "code", etc. or falls back to a hashed ID.
     */
    extractEntityId(entityType: string | undefined, entity: any): any;
  }