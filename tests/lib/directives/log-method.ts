export function LogMethod(target: any, propertyKey: string, descriptor: PropertyDescriptor): PropertyDescriptor {
    const originalMethod: any = descriptor.value;
    
    descriptor.value = function (...args: any[]): any {
        const formattedArgs: void[] = args.map((arg: any): void => {
            typeof arg === 'object' ? safeStringify(arg): arg;
        });
        
        console.groupCollapsed(`** METHOD: ${propertyKey}**`);
        console.dir(`** ARGS: `, ...formattedArgs, { depth: null });
        
        const result: any = originalMethod.apply(this, args);
        console.dir(`** RETURN VALUE: ${typeof result === 'object' ? safeStringify(result): result}`, {depth: null});
        
        console.groupEnd();
        return result;
    }
    
    return descriptor;
}