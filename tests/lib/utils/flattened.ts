export const flattenCustomAttributes = (obj: any): any = (obj: any): any => {
    if (!obj) return obj;
    
    if (Array.isArray(obj)) {
      return obj.map(flattenCustomAttributes);
    } else if(typeof obj === 'object') {
      let newObj: {} = {};
      
      Object.keys(obj).forEach(key => {
        if (key === 'customAttributes' && typeof obj[key] === 'object') {
          Object.assign(newObj, flattenCustomAttributes(obj[key]));
        } else if (key === 'config' && typeof obj[key] === 'object') {
          Object.assign(newObj, flattenCustomAttributes(obj[key]));
        } else {
          (newObj as any)[key] = obj[key];
        }
      });
      
      return newObj;
    }
    
    return obj;
  }