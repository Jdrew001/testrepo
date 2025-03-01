/**
 * Configuration for an entity type.
 */
export interface EntityTypeConfig {
    /** The property name used as the entity ID (e.g. "aeId" or "id"). */
    entityIdProperty?: string;
  
    /**
     * Function that determines if an array of items belongs to this entity type.
     * If it returns `true`, it’s treated as an "entity array."
     */
    detector?: (data: any[]) => boolean;
  
    /**
     * Function that extracts an ID from a single entity object, e.g. `(entity) => entity.aeId`.
     * If omitted, the service’s heuristics try to detect an ID automatically.
     */
    idExtractor?: (entity: any) => any;
  }
  
  /**
   * Defines the public API for the reference/adapter service,
   * which handles field name mappings and ID detection heuristics.
   */
  export interface IReferenceAdapterService {
    /**
     * Register a single rootId-to-fieldName mapping.
     * Example: map "entity" -> "aeGrid".
     */
    registerFieldMapping(rootId: string, fieldName: string): void;
  
    /**
     * Register multiple field mappings at once.
     * Example: { "entity": "aeGrid", "test": "testItem" }.
     */
    registerFieldMappings(mappings: Record<string, string>): void;
  
    /**
     * Get the transformed field name for a given rootId.
     * If no mapping is defined, returns the original rootId.
     */
    getFieldName(rootId: string): string;
  
    /**
     * Clear all registered rootId/fieldName mappings.
     */
    clearMappings(): void;
  
    /**
     * Retrieve all current mappings as a simple object.
     */
    getAllMappings(): Record<string, string>;
  
    /**
     * Store a configuration for detecting and extracting IDs from a particular entity type.
     */
    configureEntityType(entityType: string, config: EntityTypeConfig): void;
  
    /**
     * Store multiple entity type configurations at once.
     */
    configureEntityTypes(configs: Record<string, EntityTypeConfig>): void;
  
    /**
     * Enable or disable auto-detection heuristics for arrays that might be "entity arrays."
     */
    setAutoDetection(enabled: boolean): void;
  
    /**
     * Enable or disable debug logs for detection heuristics.
     * If `true`, logs console messages about single-item skip logic,
     * ID detection, and so on.
     */
    setDebugLogs(enabled: boolean): void;
  
    /**
     * Decide if an array is an entity array, returning { isEntity, entityType? }.
     * If true, the DataProcessingService may transform it into a map keyed by entityId.
     */
    detectEntityArray(
      rootId: string,
      data: any[]
    ): { isEntity: boolean; entityType?: string };
  
    /**
     * Extracts (or infers) the ID from an entity object.
     * If an entity type is known, it uses that logic; otherwise tries heuristics
     * like "id", "key", "code", etc.
     */
    extractEntityId(entityType: string | undefined, entity: any): any;
  }