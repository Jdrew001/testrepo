import {DataType} from "../../model/request-model/data-type.enum";

export type TransformFn = (value: any) => any;

export class Transformer {
    private static transformers: Record<DataType, TransformFn> = {
        [DataType.ARRAY]: (value: any): any => (value === undefined || value === null ? [] : [value]),
        [DataType.STRING]: (value: any): string => (value === undefined || value === null ? "" : String(value || "")),
        [DataType.NUMBER]: (value: any): number => (value === undefined || value === null ? "" : Number(value || 0)),
        [DataType.BOOLEAN]: (value: any): boolean => (value === undefined || value === null ? "" : Boolean(value)),
        [DataType.JSON]: (value: any): any => {
            try {
                return typeof value === "string" ? JSON.parse(value) : value;
            } catch (e) {
                console.error("ERROR INSIDE CATCH BLOCK: Transformer")
                return null;
            }
        },
        [DataType.DEFAULT]: (value: any): any => value
    };

    public static transform(dataType: DataType, value: any): any {
        return Transformer.transformers[dataType](value);
    }
}