import { Type } from 'class-transformer';
import {
    IsEnum,
    IsNumber,
    IsOptional,
    IsString,
    Matches,
    Max,
    MaxLength,
    Min,
    ValidateIf,
} from 'class-validator';
import {
    FinanceExpenseCategory,
    FinanceExpenseType,
} from '@prisma/client';

export class SetInstructorShareDto {
    @ValidateIf((_object, value) => value !== null)
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0)
    @Max(100)
    sharePercent?: number | null;
}

export class CreateFinanceExpenseDto {
    @IsEnum(FinanceExpenseType)
    type!: FinanceExpenseType;

    @IsOptional()
    @IsEnum(FinanceExpenseCategory)
    category?: FinanceExpenseCategory;

    @IsString()
    @MaxLength(160)
    title!: string;

    @IsOptional()
    @IsString()
    @MaxLength(160)
    vendor?: string;

    @IsOptional()
    @IsString()
    @MaxLength(2000)
    notes?: string;

    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0.01)
    amount!: number;

    @IsString()
    @Matches(/^[A-Z]{3}$/)
    currency!: string;

    @IsOptional()
    @IsString()
    openingId?: string;

    @IsOptional()
    @IsString()
    instructorId?: string;
}

export class MarkFinanceExpensePaidDto {
    @IsString()
    @MaxLength(160)
    paymentReference!: string;
}
