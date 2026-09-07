import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CurrenciesService } from './currencies.service';
import { CouponsService } from './coupons.service';
import { WishlistService } from './wishlist.service';
import { ReferralsService } from './referrals.service';
import { CommerceController } from './commerce.controller';
import { WishlistController } from './wishlist.controller';
import { ReferralsController } from './referrals.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [CommerceController, WishlistController, ReferralsController],
  providers: [PaymentsService, CurrenciesService, CouponsService, WishlistService, ReferralsService],
  exports: [PaymentsService, CurrenciesService, CouponsService, ReferralsService],
})
export class CommerceModule {}