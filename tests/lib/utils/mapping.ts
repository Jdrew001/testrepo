import {DataType} from "./../model/request-model/data-type.enum";

export class MappingInstruction {
  public mapFrom!: string;
  public mapTo!: string;
  public dataType: DataType = DataType.DEFAULT;
  
  constructor(mappingInstruction: MappingInstruction) {
    this.mapFrom = mappingInstruction.mapFrom;
    this.mapTo = mappingInstruction.mapTo;
    this.dataType = MappingInstruction.isDataType(mappingInstruction.dataType)
      ? mappingInstruction.dataType as DataType
      : DataType.DEFAULT;
  }
  
  private static isDataType(value: string): boolean {
    return Object.values(DataType).includes(value as DataType);
  }
  
  public toString(): string {
    return `${this.mapFrom}:${this.mapTo}:${this.dataType}`;
  }
}