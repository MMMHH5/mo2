import { Module } from '@nestjs/common';
import { PaymentGatewaysController } from './payment-gateways.controller';
import { PaymentGatewaysService } from './payment-gateways.service';

@Module({
  controllers: [PaymentGatewaysController],
  providers: [PaymentGatewaysService]
})
export class PaymentGatewaysModule {}
