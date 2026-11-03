import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RefundMethod } from '@prisma/client';

export class CreateRefundRequestDto {
    @ApiProperty({ description: 'The exact paid payment to refund' })
    @IsString()
    paymentId!: string;

    @ApiProperty({ enum: RefundMethod, description: 'WALLET (e-wallet) or BANK transfer' })
    @IsEnum(RefundMethod)
    method!: RefundMethod;

    @ApiProperty({ description: 'Account holder name' })
    @IsString()
    @MinLength(2)
    @MaxLength(120)
    accountName!: string;

    @ApiProperty({ description: 'Account number / IBAN / wallet number' })
    @IsString()
    @MinLength(4)
    @MaxLength(120)
    accountNumber!: string;

    @ApiPropertyOptional({ description: 'Optional note from the student' })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    studentNote?: string;
}

const REVIEW_STATUSES = ['APPROVED', 'REJECTED'] as const;

export class ReviewRefundRequestDto {
    @ApiProperty({ enum: REVIEW_STATUSES })
    @IsEnum(REVIEW_STATUSES)
    status!: 'APPROVED' | 'REJECTED';

    @ApiPropertyOptional({ description: 'Reason / note shown to the student' })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    reviewerNote?: string;
}

export class CompleteRefundRequestDto {
    @ApiPropertyOptional({ description: 'External bank/wallet/Stripe transaction reference' })
    @IsOptional()
    @IsString()
    @MaxLength(120)
    payoutReference?: string;
}
