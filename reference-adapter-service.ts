import { Injectable } from '@angular/core';

/**
 * Type definitions for the adapter pattern
 */
export type AdapterMapping = Map<string, string>;

/**
 * ReferenceAdapterService handles field name mappings and transformations
 * This service is responsible for the adapter pattern functionality only
 */
@Injectable({
  providedIn: 'root'
})
export class ReferenceAdapterService {
  private fieldMappings: AdapterMapping = new Map<string, string>();

  constructor() {}

  /**
   * Register a rootId to field name mapping in the adapter
   * @param rootId The original root ID to be replaced
   * @param fieldName The field name to replace it with
   */
  registerFieldMapping(rootId: string, fieldName: string): void {
    this.fieldMappings.set(rootId, fieldName);
  }

  /**
   * Register multiple field mappings at once
   * @param mappings Object containing rootId to fieldName mappings
   */
  registerFieldMappings(mappings: Record<string, string>): void {
    for (const [rootId, fieldName] of Object.entries(mappings)) {
      this.registerFieldMapping(rootId, fieldName);
    }
  }

  /**
   * Get the transformed field name for a given rootId
   * @param rootId The original root ID
   * @returns The mapped field name or the original if no mapping exists
   */
  getFieldName(rootId: string): string {
    return this.fieldMappings.get(rootId) || rootId;
  }

  /**
   * Clear all registered field mappings
   */
  clearMappings(): void {
    this.fieldMappings.clear();
  }

  /**
   * Get all registered field mappings
   * @returns Object containing all rootId to fieldName mappings
   */
  getAllMappings(): Record<string, string> {
    const result: Record<string, string> = {};
    this.fieldMappings.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }
}
