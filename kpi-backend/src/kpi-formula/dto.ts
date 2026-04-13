import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsObject,
  ValidateIf,
} from 'class-validator';

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

  @IsOptional()
  @ValidateIf((_, v) => v != null)
  @IsObject()
  scoringRules?: object | null;
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

  @IsOptional()
  @ValidateIf((_, v) => v != null)
  @IsObject()
  scoringRules?: object | null;
}
