// Type definitions
type ReplacerFunction = (key: string, value: any) => any;
type ReplacerArray = string[];
type Replacer = ReplacerFunction | ReplacerArray | null;
type HolderType = { [key: string]: any };

interface MetaTable {
  [key: string]: string;
}

const rx_escapable = /[\\\"\u0000-\u001f\u007f-\u009f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;

let gap = '';
let indent = '';
const meta: MetaTable = { // table of character substitutions
  '\b': '\\b',
  '\t': '\\t',
  '\n': '\\n',
  '\f': '\\f',
  '\r': '\\r',
  '"': '\\"',
  '\\': '\\\\'
};
let rep: Replacer;

function quote(string: string): string {
  // If the string contains no control characters, no quote characters, and no
  // backslash characters, then we can safely slap some quotes around it.
  // Otherwise we must also replace the offending characters with safe escape
  // sequences.

  rx_escapable.lastIndex = 0;
  return rx_escapable.test(string)
    ? '"' + string.replace(rx_escapable, function (a: string): string {
      const c: string | undefined = meta[a];
      return typeof c === 'string'
        ? c
        : '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
    }) + '"'
    : '"' + string + '"';
}

function str(key: string, holder: HolderType, limit: number): string {
  // Produce a string from holder[key].

  let i: number;          // The loop counter.
  let k: string;          // The member key.
  let v: string;          // The member value.
  let length: number;
  const mind: string = gap;
  let partial: string[] = [];
  let value: any = holder[key];

  // If the value has a toJSON method, call it to obtain a replacement value.
  if (value && typeof value === 'object' &&
    typeof value.toJSON === 'function') {
    value = value.toJSON(key);
  }

  // If we were called with a replacer function, then call the replacer to
  // obtain a replacement value.
  if (typeof rep === 'function') {
    value = (rep as ReplacerFunction).call(holder, key, value);
  }

  // What happens next depends on the value's type.
  switch (typeof value) {
    case 'string':
      return quote(value);

    case 'number':
      // JSON numbers must be finite. Encode non-finite numbers as null.
      return isFinite(value)
        ? String(value)
        : 'null';

    case 'boolean':
    case 'null':
      // If the value is a boolean or null, convert it to a string. Note:
      // typeof null does not produce 'null'. The case is included here in
      // the remote chance that this gets fixed someday.
      return String(value);

    // If the type is 'object', we might be dealing with an object or an array or
    // null.
    case 'object':
      // Due to a specification blunder in ECMAScript, typeof null is 'object',
      // so watch out for that case.
      if (!value) {
        return 'null';
      }

      // Make an array to hold the partial results of stringifying this object value.
      gap += indent;
      partial = [];

      // Is the value an array?
      if (Object.prototype.toString.apply(value) === '[object Array]') {
        // The value is an array. Stringify every element. Use null as a placeholder
        // for non-JSON values.
        length = value.length;
        for (i = 0; i < length; i += 1) {
          partial[i] = str(i.toString(), value as HolderType, limit) || 'null';
        }

        // Join all of the elements together, separated with commas, and wrap them in
        // brackets.
        v = partial.length === 0
          ? '[]'
          : gap
            ? (
              gap.length + partial.join(', ').length + 4 > limit ?
                '[\n' + gap + partial.join(',\n' + gap) + '\n' + mind + ']' :
                '[ ' + partial.join(', ') + ' ]'
            )
            : '[' + partial.join(',') + ']';
        gap = mind;
        return v;
      }

      // If the replacer is an array, use it to select the members to be stringified.
      if (rep && typeof rep === 'object') {
        length = (rep as ReplacerArray).length;
        for (i = 0; i < length; i += 1) {
          if (typeof (rep as ReplacerArray)[i] === 'string') {
            k = (rep as ReplacerArray)[i];
            v = str(k, value as HolderType, limit);
            if (v) {
              partial.push(quote(k) + (
                gap
                  ? ': '
                  : ':'
              ) + v);
            }
          }
        }
      } else {
        // Otherwise, iterate through all of the keys in the object.
        for (k in value) {
          if (Object.prototype.hasOwnProperty.call(value, k)) {
            v = str(k, value as HolderType, limit);
            if (v) {
              partial.push(quote(k) + (
                gap
                  ? ': '
                  : ':'
              ) + v);
            }
          }
        }
      }

      // Join all of the member texts together, separated with commas,
      // and wrap them in braces.
      v = partial.length === 0
        ? '{}'
        : gap
          ? (
            gap.length + partial.join(', ').length + 4 > limit ?
              '{\n' + gap + partial.join(',\n' + gap) + '\n' + mind + '}' :
              '{ ' + partial.join(', ') + ' }'
          )
          : '{' + partial.join(',') + '}';
      gap = mind;
      return v;
    
    default:
      return '';
  }
}

// Options for the beautify function
interface BeautifyOptions {
  replacer?: Replacer;
  space?: number | string;
  limit?: number;
  preserveOrder?: boolean;
}

function beautify(value: any, options?: BeautifyOptions | Replacer, space?: number | string, limit?: number): string {
  // The stringify method takes a value and an optional replacer, and an optional
  // space parameter, and returns a JSON text. The replacer can be a function
  // that can replace values, or an array of strings that will select the keys.
  // A default replacer method can be provided. Use of the space parameter can
  // produce text that is more easily readable.

  let i: number;
  gap = '';
  indent = '';
  
  // Handle the case where options is passed as a replacer (for backward compatibility)
  let replacer: Replacer = null;
  let preserveOrder = false;
  
  if (options) {
    if (typeof options === 'function' || Array.isArray(options)) {
      // Old-style calling with replacer as second parameter
      replacer = options;
      // Use the other parameters as provided
    } else {
      // New-style calling with options object
      replacer = options.replacer || null;
      space = options.space !== undefined ? options.space : space;
      limit = options.limit !== undefined ? options.limit : limit;
      preserveOrder = options.preserveOrder || false;
    }
  }

  if (!limit) limit = 0;

  if (typeof limit !== "number")
    throw new Error("beautifier: limit must be a number");

  // If the space parameter is a number, make an indent string containing that
  // many spaces.
  if (typeof space === 'number') {
    for (i = 0; i < space; i += 1) {
      indent += ' ';
    }

    // If the space parameter is a string, it will be used as the indent string.
  } else if (typeof space === 'string') {
    indent = space;
  }

  // If there is a replacer, it must be a function or an array.
  // Otherwise, throw an error.
  rep = replacer;
  if (replacer && typeof replacer !== 'function' &&
    (typeof replacer !== 'object' ||
      typeof (replacer as ReplacerArray).length !== 'number')) {
    throw new Error('beautifier: wrong replacer parameter');
  }

  // If preserving order, use Object.keys to get the keys in their defined order
  if (preserveOrder && typeof value === 'object' && value !== null) {
    const orderedValue = preserveObjectOrder(value);
    return str('', { '': orderedValue } as HolderType, limit);
  }

  // Make a fake root object containing our value under the key of ''.
  // Return the result of stringifying the value.
  return str('', { '': value } as HolderType, limit);
}

// Helper function to preserve object property order
function preserveObjectOrder(obj: any): any {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return obj;
  }
  
  // Create a new object with the same prototype
  const ordered: any = Object.create(Object.getPrototypeOf(obj));
  
  // Get keys and iterate in order they were defined
  const keys = Object.keys(obj);
  
  // Add each property in order
  keys.forEach(key => {
    const value = obj[key];
    
    // Recursively preserve order for nested objects
    if (value !== null && typeof value === 'object') {
      ordered[key] = preserveObjectOrder(value);
    } else {
      ordered[key] = value;
    }
  });
  
  return ordered;
}

export default beautify;