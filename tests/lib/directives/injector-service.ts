import {Type} from "@angular/core";
import {ServiceLocator} from "../../services/infrastructure/service-locator.service";

export function InjectorService<T>(service: Type<T>): (target: any, propertyKey: ...) => {
    return function (target: any, propertyKey: string): void {
        Object.defineProperty(target, propertyKey, {
            get: () => ServiceLocator.get(service),
            enumerable: true,
            configurable: true
        });
    }
}