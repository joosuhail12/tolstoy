import { IsNotEmpty, IsString, IsUrl } from 'class-validator';

export class CreateToolDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsUrl()
  @IsNotEmpty()
  baseUrl: string;

  @IsString()
  @IsNotEmpty()
  authType: string;
}
