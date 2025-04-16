import {HttpParams} from "@angular/http";
import * as _ from "lodash";
import {IGenericStrategyInterface} from "../strategies/field-strategies/generic-strategy.interface";

export const getReducedRecord = (data: any, arr: any[]): Record<string, any> => {
  return arr.reduce((acc: Record<string, any>, key: any): Record<string, any> => {
    const actualKey: any = getClosestKey(data, key);
    acc[key] = data[actualKey];
    return acc;
  }, {} as Record<string, any>);
}

export const getReducedHttpParams = (data: any, arr: any[]): HttpParams => {
  return arr.reduce((acc: HttpParams, key: any): HttpParams => {
    const actualKey: any = getClosestKey(data, key);
    acc = acc.append(key, data[actualKey] ?? "");
    return acc;
  }, new HttpParams() as HttpParams);
}

export const getClosestKey = (obj: Record<string, any>, searchKey: string): any => {
  const lowerSearchKey: string = searchKey.toLowerCase();
  
  const exactMatch: string | undefined = Object.keys(obj).find(key => key.toLowerCase() === lowerSearchKey);
  if (exactMatch) return exactMatch;
  
  return Object.keys(obj).reduce((closestMatch: any, currentKey: string): any => {
    const lowerCurrentKey: string = currentKey.toLowerCase();
    const distance: number = levenshteinDistance(lowerSearchKey, lowerCurrentKey);
    
    // this allows for minor mistakes (1 character distance)
    if (distance <= 1) {
      return currentKey;
    }
    
    return closestMatch;
  }, null);
}

export const extractValue = (item: string | Partial<any>, key: string): string | null => {
    return typeof item === 'object' && item[key] !== undefined
      ? item[key] : item;
  }
  
  export const checkPartialObjKey = (object: any, searchKey: string): string | null => {
    return Object.keys(object).find((key: any) => key.includes(searchKey)) ?? null;
  }
  
  export const flattenOneLevel = (obj: any): any => { // Show usages & Drew Atkison
    const result: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value: any = obj[key];
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          Object.assign(result, value);
        } else {
          result[key] = value;
        }
      }
    }
    return result;
  }
  
  export const mapHasObjectByStructure = (set: Set<any>, target: any): boolean => { // Show usages & Drew
    if (!set) return false;
    for (const item of set) {
      console.log('check', item.config, target);
      if (_.isEqual(item.config, target)) {
        return true;
      }
    }
    return false;
  }

  export const levenshteinDistance = (a: string, b: string): number => { // Show usages & Drew...
    const lenA = a.length, lenB = b.length;
    
    // Step 1: Create a 2D array (matrix) to store the distances.
    const dp: number[][] = Array(lenA + 1).fill(null).map(() => Array(lenB + 1).fill(0));
    
    //Step 2: Initialize the first row and column
    // this represents transforming '' (empty string) to/from 'a' or 'b'
    for (let i = 0; i <= lenA; i++) dp[i][0] = i; // cost of deleting all characters from 'a'
    for (let j = 0; j <= lenB; j++) dp[0][j] = j; // cost of inserting all characters from 'b'
    
    // Step 3: Fill the matrix by comparing characters in 'a' and 'b'
    for (let i = 1; i <= lenA; i++) {
      for (let j = 1; j <= lenB; j++) {
        
        if (a[i - 1] === b[j - 1]) {
          // If characters are the same, no cost (copy previous diagonal value)
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          // If characters are different, find the minimum edit operation
          dp[i][j] = Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]) + 1;
        }
      }
    }
    
    return dp[lenA][lenB];
  }