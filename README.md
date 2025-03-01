# Dynamic JSON Indexing & Adapter Pattern Service for Angular

This project provides a dynamic JSON data transformation and indexing solution for Angular. It uses an adapter pattern to remap root keys and automatically detect “entity arrays” (arrays of objects with unique ID-like fields) to build a nested, Map-based index for fast O(1) lookups.

## Features

- **Dynamic Adapter Service**
  - Remaps root keys (e.g. "entity" → "aeGrid") via a configurable mapping.
  - Dynamically detects if an array is an “entity array” by scanning for unique ID-like properties (e.g. `id`, `aeId`, `code`, `key`, etc.).
  - Fully dynamic detection without hard-coding; even single-item arrays are treated as entity arrays if an ID is detected.
  - Optionally enables debug logs to trace detection steps.

- **Data Processing & Indexing Service**
  - Transforms raw JSON data using the adapter.
  - For nested entity arrays, converts the data into a Map-based structure (`Map<field, Map<entityId, any[]>>`) with `parentId` attached to nested objects.
  - Leaves flat arrays or tree structures as plain arrays.
  - Builds an in-memory index for O(1) lookups by root, field, and optionally by entity ID.
  - Supports incremental appends.

- **Performance**
  - Uses efficient loops and JavaScript Maps to achieve indexing times well under 500ms on modern hardware—even for large datasets.
  - Lookup operations are constant time (O(1)).

## Installation

1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build your Angular project:
   ```bash
   ng build
   ```

## Configuration

### Adapter Service

Configure the adapter to remap root keys and enable debugging if desired. For example:

```ts
// In your component or initialization code:
this.adapterService.registerFieldMapping('entity', 'aeGrid');
this.adapterService.setDebugLogs(true);
```

### Data Processing Service

Force specific root keys to remain flat (i.e. not transformed into Map-based indexes) by specifying them in the `flatRoots` array. For example, if you want `"caSubUnit"`, `"geography"`, and `"grcTaxonomy"` to remain as plain arrays:

```ts
this.dataService.setConfig({
  flatRoots: ['caSubUnit', 'geography', 'grcTaxonomy'],
  logPerformance: true,
  printDataInLogs: true
});
```

## Usage Example

Below is an example Angular component demonstrating the use of both services:

```ts
import { Component, OnInit } from '@angular/core';
import { DataProcessingService } from './data-processing.service';
import { ReferenceAdapterService } from './reference-adapter.service';

@Component({
  selector: 'app-example',
  template: `<p>Check console for output</p>`
})
export class ExampleComponent implements OnInit {
  constructor(
    private dataService: DataProcessingService,
    private adapterService: ReferenceAdapterService
  ) {}

  async ngOnInit() {
    // Configure the adapter: remap "entity" to "aeGrid" and enable debug logs.
    this.adapterService.registerFieldMapping('entity', 'aeGrid');
    this.adapterService.setDebugLogs(true);

    // Configure the data service to leave these roots flat.
    this.dataService.setConfig({
      flatRoots: ['caSubUnit', 'geography', 'grcTaxonomy'],
      logPerformance: true,
      printDataInLogs: true
    });

    // Sample raw data
    const rawData = {
      entity: [
        {
          aeId: "ae123",
          legalEntity: {
            code: "some label",
            value: "123",
            className: "",
            disabled: false
          }
        }
      ],
      caSubUnit: [
        {
          id: 12,
          value: "some value",
          code: null,
          parentUnitId: 3,
          showRed: false
        }
      ]
    };

    // Initialize the data
    const transformedData = await this.dataService.initialize(rawData);
    console.log('Transformed Data:', transformedData);
  }
}
```
