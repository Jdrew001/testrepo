/**
 * Configuration for an entity type.
 */
export interface EntityTypeConfig {
    /**
     * The property name used as the entity ID (e.g., "aeId", "id").
     * If not provided, the adapter attempts to dynamically detect a suitable ID.
     */
    entityIdProperty?: string;
  
    /**
     * Optional custom function to determine if an array is an entity array.
     * If provided, this overrides the default dynamic detection.
     */
    detector?: (data: any[]) => boolean;
  
    /**
     * Optional custom function to extract an ID from an entity object.
     * If omitted, the adapter uses dynamic heuristics.
     */
    idExtractor?: (entity: any) => any;
  }
  
  /**
   * Public API for the ReferenceAdapterService.
   * This service:
   *  - Remaps root IDs via user-defined mappings.
   *  - Dynamically detects if an array is an "entity array" by scanning for an ID-like property.
   *    Single-item arrays are considered entity arrays if they have a recognized ID.
   *  - Extracts the entity ID using dynamic heuristics if not explicitly configured.
   */
  export interface IReferenceAdapterService {
    registerFieldMapping(rootId: string, fieldName: string): void;
    registerFieldMappings(mappings: Record<string, string>): void;
    getFieldName(rootId: string): string;
    clearMappings(): void;
    getAllMappings(): Record<string, string>;
    configureEntityType(entityType: string, config: EntityTypeConfig): void;
    configureEntityTypes(configs: Record<string, EntityTypeConfig>): void;
    setAutoDetection(enabled: boolean): void;
    setDebugLogs(enabled: boolean): void;
    detectEntityArray(rootId: string, data: any[]): { isEntity: boolean; entityType?: string };
    extractEntityId(entityType: string | undefined, entity: any): any;
  }