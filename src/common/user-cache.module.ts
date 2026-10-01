import { Global, Module } from '@nestjs/common';
import { UserCacheService } from './user-cache.service';

/**
 * Global because the cache is needed in three places that have no business
 * importing each other: JwtStrategy (reads), UsersService and AuthService
 * (invalidate). Making it global avoids a circular import between AuthModule and
 * UsersModule just to hand out one service.
 */
@Global()
@Module({
    providers: [UserCacheService],
    exports: [UserCacheService],
})
export class UserCacheModule { }
