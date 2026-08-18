import { IsString, IsOptional, IsEnum, IsDateString, MaxLength, MinLength } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(['urgent', 'high', 'medium', 'low', 'no_priority'])
  priority?: string;

  @IsOptional()
  @IsString()
  lead?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
