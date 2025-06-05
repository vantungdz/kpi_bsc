export class CreateKpiFormulaDto {
  code: string;
  name: string;
  expression: string;
  description?: string;
}

export class UpdateKpiFormulaDto {
  name?: string;
  expression?: string;
  description?: string;
}
