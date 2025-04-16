export class HashObject { // Show usages & Drew Atkison
    async hashObject(obj: any, algorithm: 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512' = 'SHA-256'): Promise<string> {
      // Convert the object to a stable string representation
      const stringRepresentation: string = this.stableStringify(obj);
      
      // Convert string to Uint8Array
      const encoder = new TextEncoder();
      const data: Uint8Array = encoder.encode(stringRepresentation);
      
      // Use the Web Crypto API to hash the data
      const hashBuffer: ArrayBuffer = await crypto.subtle.digest(algorithm, data);
      
      // Convert the hash to a hex string
      return this.arrayBufferToHex(hashBuffer);
    }
    
    /**
     * Creates a deterministic string representation of any JavaScript object.
     * This ensures the same object always produces the same string representation.
     * Handles circular references to prevent maximum call stack size errors.
     * 
     * @param obj - The object to stringify
     * @param visited - Set of already visited objects (used internally for recursion)
     * @returns A stable string representation of the object
     */
    private stableStringify(obj: any, visited: Set<any> = new Set()): string { // Show usages & Drew Atkison
      // Handle primitive types directly
      if (obj === null || obj === undefined) return String(obj);
      if (typeof obj !== 'object') return String(obj);
      
      // Handle circular references
      if (visited.has(obj)) {
        return '"[Circular]"';
      }
      
      // Add current object to visited set
      visited.add(obj);
      
      try {
        // Handle arrays by recursively stringifying each element
        if (Array.isArray(obj)) {
          return '[' + obj.map(item => this.stableStringify(item, visited)).join(',') + ']';
        }
        
        // Handle regular objects by sorting keys and recursively stringifying values
        const keys: string[] = Object.keys(obj).sort();
        const pairs: string[] = keys.map(key => {
          const keyString: string = JSON.stringify(key);
          const valueString: string = this.stableStringify(obj[key], visited);
          return keyString + ':' + valueString;
        });
        
        return '{' + pairs.join(',') + '}';
      } finally {
        // Remove the object from the visited set when we're done with it
        visited.delete(obj);
      }
    }
    
    /**
     * Convert an ArrayBuffer to a hexadecimal string.
     * 
     * @param buffer - The ArrayBuffer to convert
     * @returns A hexadecimal string representation of the buffer
     */
    private arrayBufferToHex(buffer: ArrayBuffer): string { // Show usages & Drew Atkison
      const bytes = new Uint8Array(buffer);
      return Array.from(bytes)
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
    }
  }