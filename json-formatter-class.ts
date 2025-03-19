import beautify from './typescript-beautifier';

/**
 * Interface for formatting options
 */
interface FormattingOptions {
  /**
   * Indentation spaces or character(s)
   */
  indent?: number | string;
  
  /**
   * Character limit per line before applying line breaks
   */
  lineLimit?: number;
  
  /**
   * Custom replacer function or array of keys to include
   */
  replacer?: ((key: string, value: any) => any) | string[] | null;
}

/**
 * Class for formatting JSON data with various options
 */
class JSONFormatter {
  private defaultOptions: FormattingOptions;

  /**
   * Creates a new JSONFormatter instance
   * @param defaultOptions Default formatting options to use
   */
  constructor(defaultOptions: FormattingOptions = {}) {
    this.defaultOptions = {
      indent: 2,
      lineLimit: 80,
      replacer: null,
      ...defaultOptions
    };
  }

  /**
   * Format a JSON object or value with given options
   * @param data JSON object or value to format
   * @param options Formatting options (overrides defaults)
   * @returns Formatted JSON string
   */
  public format(data: any, options: Partial<FormattingOptions> = {}): string {
    const resolvedOptions = { ...this.defaultOptions, ...options };
    
    return beautify(
      data,
      resolvedOptions.replacer || null,
      resolvedOptions.indent,
      resolvedOptions.lineLimit
    );
  }
  
  /**
   * Format JSON with compact style (no indentation)
   * @param data JSON object or value to format
   * @returns Formatted JSON string with no indentation
   */
  public formatCompact(data: any): string {
    return this.format(data, { indent: 0, lineLimit: 0 });
  }
  
  /**
   * Format JSON with readable style (2-space indentation)
   * @param data JSON object or value to format
   * @returns Formatted JSON string with 2-space indentation
   */
  public formatReadable(data: any): string {
    return this.format(data, { indent: 2, lineLimit: 80 });
  }
  
  /**
   * Format JSON with only specified fields
   * @param data JSON object or value to format
   * @param fields Array of field names to include in the output
   * @returns Formatted JSON string with only specified fields
   */
  public formatWithFields(data: any, fields: string[]): string {
    return this.format(data, { replacer: fields });
  }
}

// Example usage
function demonstrateJSONFormatter(): void {
  const formatter = new JSONFormatter();
  
  const sampleData = {
    name: "John Doe",
    age: 30,
    address: {
      street: "123 Main St",
      city: "Anytown",
      state: "CA",
      zip: "12345"
    },
    hobbies: ["reading", "hiking", "programming"],
    contact: {
      email: "john.doe@example.com",
      phone: "555-123-4567"
    }
  };
  
  // Format with default options (2-space indent)
  console.log("Default formatting:");
  console.log(formatter.format(sampleData));
  
  // Format with compact style
  console.log("\nCompact formatting:");
  console.log(formatter.formatCompact(sampleData));
  
  // Format with custom indentation
  console.log("\nCustom indentation (4 spaces):");
  console.log(formatter.format(sampleData, { indent: 4 }));
  
  // Format with tab indentation
  console.log("\nTab indentation:");
  console.log(formatter.format(sampleData, { indent: "\t" }));
  
  // Format with line limit
  console.log("\nWith line limit (40 characters):");
  console.log(formatter.format(sampleData, { lineLimit: 40 }));
  
  // Format with field selection
  console.log("\nWith specific fields only:");
  console.log(formatter.formatWithFields(sampleData, ["name", "age", "hobbies"]));
  
  // Format with custom replacer function
  console.log("\nWith custom replacer function (hiding email):");
  const hideEmailReplacer = (key: string, value: any) => {
    if (key === "email") return "[REDACTED]";
    return value;
  };
  console.log(formatter.format(sampleData, { replacer: hideEmailReplacer }));
}

// Run the demonstration
// demonstrateJSONFormatter();

export default JSONFormatter;