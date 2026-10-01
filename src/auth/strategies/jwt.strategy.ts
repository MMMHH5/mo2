import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserCacheService } from '../../common/user-cache.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(private readonly userCache: UserCacheService) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: process.env.JWT_SECRET!,
        });
    }

    async validate(payload: any) {
        if (!payload.sub) {
            throw new UnauthorizedException('Invalid token payload');
        }
        // Read the user so a suspended/deactivated account is denied immediately
        // and authorization uses the CURRENT role (not a stale JWT claim).
        //
        // Served from a short-lived Redis cache when one is configured, and from
        // the database otherwise. The cache never becomes the authorization
        // boundary: every path that changes the role, the active flag, or the
        // password deletes the entry, so a stale role cannot outlive the write
        // that changed it. The TTL is only a backstop.
        const user = await this.userCache.findActiveUser(payload.sub);
        if (!user) {
            throw new UnauthorizedException('Account is not available');
        }
        return { userId: user.id, email: user.email, role: user.role };
    }
}
