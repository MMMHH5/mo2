import { IsString, IsOptional, IsNumber, Min, IsInt, IsDateString, IsEnum } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DeliveryMode } from '@prisma/client';

export class CreateOpeningDto {
    @ApiPropertyOptional({ description: 'Optional Arabic label for this opening (e.g. "دفعة سبتمبر")' })
    @IsOptional()
    @IsString()
    nameAr?: string;

    @ApiPropertyOptional({ description: 'Optional English label for this opening (e.g. "September batch")' })
    @IsOptional()
    @IsString()
    nameEn?: string;

    @ApiProperty({ description: 'Instructor teaching this opening/batch' })
    @IsString()
    instructorId!: string;

    @ApiPropertyOptional({ description: 'Opening start date (ISO)' })
    @IsOptional()
    @IsDateString()
    @Transform(({ value }) => (value ? new Date(value).toISOString() : value))
    startDate?: string;

    @ApiPropertyOptional({ description: 'Opening end date (ISO)' })
    @IsOptional()
    @IsDateString()
    @Transform(({ value }) => (value ? new Date(value).toISOString() : value))
    endDate?: string;

    @ApiPropertyOptional({ description: 'Enrollment deadline (ISO)' })
    @IsOptional()
    @IsDateString()
    @Transform(({ value }) => (value ? new Date(value).toISOString() : value))
    enrollmentDeadline?: string;

    @ApiProperty({ description: 'Price of this opening', example: 199.99 })
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    price!: number;

    @ApiPropertyOptional({ description: 'Original price before discount', example: 299.99 })
    @Type(() => Number)
    @IsOptional()
    @IsNumber()
    @Min(0)
    priceOld?: number;

    @ApiPropertyOptional({ description: 'Maximum number of students for this opening' })
    @Type(() => Number)
    @IsOptional()
    @IsInt()
    @Min(1)
    maxStudents?: number;

    @ApiPropertyOptional({ description: 'Announcement banner start (ISO)' })
    @IsOptional()
    @IsDateString()
    @Transform(({ value }) => (value ? new Date(value).toISOString() : value))
    announcementStartAt?: string;

    @ApiPropertyOptional({ description: 'Announcement banner end (ISO)' })
    @IsOptional()
    @IsDateString()
    @Transform(({ value }) => (value ? new Date(value).toISOString() : value))
    announcementEndAt?: string;

    @ApiPropertyOptional({
        description: 'ONLINE when the batch is taught remotely, IN_PERSON otherwise',
        enum: DeliveryMode,
        default: DeliveryMode.IN_PERSON,
    })
    @IsOptional()
    @IsEnum(DeliveryMode, { message: 'deliveryMode must be IN_PERSON or ONLINE' })
    deliveryMode?: DeliveryMode;

    @ApiPropertyOptional({
        description:
            'Classroom link for an ONLINE batch (Google Meet / Zoom / Teams, https only). ' +
            'Stored as typed but only served to students with an APPROVED enrollment. ' +
            'Cleared automatically when the batch is switched back to IN_PERSON.',
        example: 'https://meet.google.com/abc-defg-hij',
    })
    @IsOptional()
    @IsString()
    meetLink?: string;
}
