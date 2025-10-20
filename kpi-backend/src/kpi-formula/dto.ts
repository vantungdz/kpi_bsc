import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateKpiFormulaDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  expression: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateKpiFormulaDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  expression?: string;

  @IsString()
  @IsOptional()
  description?: string;
}
