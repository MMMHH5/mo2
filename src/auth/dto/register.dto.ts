import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
    @ApiProperty({ description: 'User email address', example: 'newuser@laxalab.com' })
    @IsEmail()
    @IsNotEmpty()
    email!: string;

    @ApiProperty({ description: 'User password (min 8 chars, must contain uppercase, lowercase, and number)', example: 'MySecret123' })
    @IsString()
    @IsNotEmpty()
    @MinLength(8, { message: 'Password must be at least 8 characters long' })
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
        message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
    })
    password!: string;

    @ApiPropertyOptional({ description: 'Full name', example: 'Jane Doe' })
    @IsOptional()
    @IsString()
    @MaxLength(120)
    fullName?: string;

    @ApiPropertyOptional({ description: 'Phone number', example: '+1 234 567 890' })
    @IsOptional()
    @IsString()
    @MaxLength(40)
    phone?: string;

    @ApiPropertyOptional({ description: 'Professional title (e.g. Engineer, Dr.)', example: 'Engineer' })
    @IsOptional()
    @IsString()
    @MaxLength(60)
    title?: string;

    @ApiPropertyOptional({ description: 'Field of study / specialty', example: 'Computer Science' })
    @IsOptional()
    @IsString()
    @MaxLength(120)
    specialty?: string;

    @ApiPropertyOptional({ description: 'Study status (STUDENT | GRADUATE | OTHER)', enum: ['STUDENT', 'GRADUATE', 'OTHER'] })
    @IsOptional()
    @IsString()
    studyStatus?: string;

    @ApiPropertyOptional({ description: 'Current study level / year', example: 'Third Year' })
    @IsOptional()
    @IsString()
    @MaxLength(80)
    studyLevel?: string;
}