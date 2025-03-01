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
   * Example: { entity: "aeGrid", test: "testItem" }.
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
   * Given a rootId and an array of items, return whether it’s likely an entity array,
   * and if so, what the entity type is (e.g., "entity" or "auto-detected").
   */
  detectEntityArray(
    rootId: string,
    data: any[]
  ): { isEntity: boolean; entityType?: string };

  /**
   * Extracts or infers the ID from an entity object.
   * If an entity type is known, it uses the configured logic;
   * otherwise, it applies fallback heuristics.
   */
  extractEntityId(entityType: string | undefined, entity: any): any;
}