import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
    @ApiProperty({ description: 'One-time token issued by login when a password change is required' })
    @IsString()
    @IsNotEmpty()
    tempToken!: string;

    @ApiProperty({ description: 'New password, 6 chars min', example: 'NewStrongPassword123' })
    @IsString()
    @IsNotEmpty()
    @MinLength(6)
    newPassword!: string;
}