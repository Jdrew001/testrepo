import {isNotNullOrUndefined} from "codelyzer/util/isNotNullOrUndefined";
import {BaseConfig} from "../../model/configs/base.config";
import {safeStringify} from "./logger.annotation";

export function ValidateConfig<T extends { new (...args: any[]): {} }>(Base: T): {new (...args: any[]): any} {
    return class extends Base {
        constructor(...args: any[]) {
            super(...args);
            
            const declaredProperties = Reflect.ownKeys(this).filter(
                (key: string|symbol) => typeof key === 'string'
            ) as string[];
            
            const missingFields: string[] = declaredProperties.filter(
                field: string => !isNotNullOrUndefined((this as any)[field])
            );
            
            const parentConfig = ((this as any)?.parentConfig as BaseConfig<any>);
            const parentField: string = ((this as any)?.parentConfig as BaseConfig<any>)?.field;
            
            // if (missingFields.length > 0) {
            //     console.error(`
            //     Validation Failed in class "${Base.name}"
            //     Parent: ${parentField}
            //     Missing fields -> ${missingFields}
            //     --------------------------------------
            //     Parent Config: 
            //     ${safeStringify(parentConfig?.customAttributes)}`);
            // }
        }
    }
}