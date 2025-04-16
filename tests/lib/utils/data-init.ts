import {FormArray} from "@angular/forms";
import {IGenericStrategyInterface} from "../strategies/field-strategies/generic-strategy.interface";

// TODO: This needs to be updated to match the new architecture
export class DataInitializer { // Show usages & Drew Atkison +1
  public static initializeData(data: any, fields: Map<string, IGenericStrategyInterface>): Map<string, IGenericStrategyInterface> {
    if (!data) return new Map<string, IGenericStrategyInterface>();
    
    Object.keys(data).forEach(key => {
      if (data[key] !== undefined && data[key] instanceof Array) this.handleFormArray(key, data, fields);
      if (data[key] !== undefined && !(data[key] instanceof Array)) this.handleFormControl(key, data, fields);
    });
    
    return fields;
  }
  
  public static updateData(data: any, field: IGenericStrategyInterface): void { // Show usages & Drew Atkison
    const mapField: Map<string, IGenericStrategyInterface> = new Map<string, IGenericStrategyInterface>().set(field.id, field);
    if (data instanceof Array) this.handleFormArray(field.id, data, mapField);
    if (!(data instanceof Array)) this.handleFormControl(field.id, data, mapField);
  }
  
  private static handleFormArray(key: string, data: any, fields: Map<string, IGenericStrategyInterface>): void { // Show usages
    const field: IGenericStrategyInterface = fields.get(key);
    if (!field || !data[key]) return;
    
    (field.control as FormArray).reset();
    field.patchValue(data[key] ? data[key]: data);
    field.updateValueAndValidity();
    field.data = data[key] ? data[key]: data;
    field.dataInitialized();
  }
  
  private static handleFormControl(key: string, data: any, fields: Map<string, IGenericStrategyInterface>): any { // Show usages
    const field: IGenericStrategyInterface = fields.get(key);
    if (!field || !data[key]) return;
    
    if (field) {
      field.patchValue(data[key]);
      field.updateValueAndValidity();
      field.data = data[key];
      field.dataInitialized();
    }
  }
}