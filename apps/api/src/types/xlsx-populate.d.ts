declare module 'xlsx-populate' {
  export interface Cell {
    value(): unknown;
    value(value: unknown): Cell;
    style(name: string, value: unknown): Cell;
  }

  export interface Range {
    value(): unknown[][];
  }

  export interface Sheet {
    name(name: string): Sheet;
    cell(address: string): Cell;
    row(index: number): { style(name: string, value: unknown): unknown };
    column(index: string | number): { width(value: number): unknown; style(name: string, value: unknown): unknown };
    usedRange(): Range;
    panes(): Record<string, unknown>;
    freezePanes(xSplit: number, ySplit: number): Sheet;
  }

  export interface Workbook {
    sheet(indexOrName: number | string): Sheet;
    outputAsync(): Promise<Buffer | Uint8Array | ArrayBuffer>;
  }

  const XlsxPopulate: {
    fromBlankAsync(): Promise<Workbook>;
    fromDataAsync(data: Buffer | Uint8Array | ArrayBuffer): Promise<Workbook>;
  };

  export default XlsxPopulate;
}
