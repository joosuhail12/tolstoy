import { IsEmail, IsEnum, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({
    description: 'User email address',
    format: 'email',
    example: 'john.doe@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'User full name',
    example: 'John Doe',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    description: 'User role',
    enum: ['admin', 'member', 'viewer'],
    example: 'member',
  })
  @IsEnum(['admin', 'member', 'viewer'])
  @IsOptional()
  role?: string = 'member';

  @ApiPropertyOptional({
    description: 'User profile information',
    example: { department: 'Engineering', title: 'Software Engineer' },
  })
  @IsObject()
  @IsOptional()
  profile?: Record<string, unknown>;
}
