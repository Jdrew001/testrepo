/**
 * Configuration for an entity type.
 */
export interface EntityTypeConfig {
  /** The property name used as the entity ID, e.g., "aeId" or "id". */
  entityIdProperty?: string;

  /**
   * Function that determines if an array of items belongs to this entity type.
   * If it returns `true`, it’s considered an "entity array."
   */
  detector?: (data: any[]) => boolean;

  /**
   * Function that extracts an ID from a single entity object, e.g. `(entity) => entity.aeId`.
   * If omitted, the service’s heuristics try to detect an ID automatically.
   */
  idExtractor?: (entity: any) => any;
}