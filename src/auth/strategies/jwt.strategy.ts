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
            // Pin the algorithm instead of letting the token's own header pick it.
            // jsonwebtoken already rejects "none", but an allow-list means no
            // future header value can talk us into a different verification path
            // without someone editing this file on purpose.
            algorithms: ['HS256'],
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

        // Revocation. `tv` is stamped into every access token at sign time; a
        // logout, a password change, or a detected refresh-token replay bumps
        // the row's tokenVersion, so already-issued tokens stop matching. A
        // token minted before this claim existed has no `tv`, which reads as 0
        // -- the same default the column starts at -- so nothing is logged out
        // by deploying this.
        const tokenVersion = typeof payload.tv === 'number' ? payload.tv : 0;
        if (tokenVersion !== user.tokenVersion) {
            throw new UnauthorizedException('Session has been revoked');
        }

        return { userId: user.id, email: user.email, role: user.role };
    }
}
