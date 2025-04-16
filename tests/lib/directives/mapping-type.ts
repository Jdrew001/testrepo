import "reflect-metadata";
import {OperationType} from "../../model/enums/operation-type.enum";

export function MappingType(operation: OperationType): (target: Function) => void {
    return function (target: Function): void {
        Reflect.defineMetadata("mappingType", operation, target);
    }
}