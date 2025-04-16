export function safeStringify(obj: any, space = 2): string {
    const values = new WeakSet();
    return JSON.stringify(obj, (key: string, value: any): any => {
        if (typeof value === 'object' && value !== null) {
            if (values.has(value)) return '[Circular]';
            values.add(value);
        }
        return value;
    }, space)
}