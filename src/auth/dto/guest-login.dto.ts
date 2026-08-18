import { IsOptional, IsString, MaxLength } from 'class-validator';

export class GuestLoginDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  name?: string;
}
