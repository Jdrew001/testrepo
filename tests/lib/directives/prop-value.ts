import {safeStringify} from "../logger.annotation";

export function GetPropertyValue(target: any, propertyKey: string): void { // no usages ♦ Drew Atkison
    let value: any;
    const parentClassName: any = target.constructor.name;
    
    Object.defineProperty(target, propertyKey, {
        get: function (): any {
            console.log(`Property: ${propertyKey} from class ${parentClassName} with Value: ${value}; Parent: ${this.parentField}`);
            return value;
        },
        set: function (newValue: any): void {
            value = newValue;
            if (this.parentField) {
                console.log(`Setting Property: ${propertyKey} from class ${parentClassName} with Value: ${safeStringify(newValue)}`);
            }
        },
        enumerable: true,
        configurable: true
    });
}