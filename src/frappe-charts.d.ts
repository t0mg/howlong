declare module 'frappe-charts' {
  export class Chart {
    constructor(parent: string | HTMLElement, options: any);
    update(data: any): void;
    addDataPoint(label: string, value: any, index?: number): void;
    removeDataPoint(index?: number): void;
    export(): void;
  }
}
