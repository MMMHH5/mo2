import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from './chat.service';
import { UserCacheService } from '../common/user-cache.service';
import { getFrontendUrl } from '../common/frontend-url';

@WebSocketGateway({ cors: { origin: getFrontendUrl() } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    constructor(
        private readonly jwtService: JwtService,
        private readonly chatService: ChatService,
        private readonly userCache: UserCacheService,
    ) { }

@WebSocketServer()
server!: Server;

    /**
     * Authenticate the socket.
     *
     * A token signature proves the token was issued by us and has not expired.
     * It does NOT prove the account is still allowed to act: it says nothing
     * about a suspension, and its `role` claim is frozen at issue time.
     *
     * That matters here more than anywhere else, because isOversight() grants
     * ADMIN and COURSE_MANAGER blanket access to EVERY direct chat on the
     * platform. Reading the role straight off the token meant that demoting or
     * suspending an account did not touch chat at all -- the stale claim kept
     * working for the rest of the token's life, and revoking the session did not
     * close an already-open socket.
     *
     * So the role is taken from the database, exactly like the HTTP path does
     * via JwtStrategy. A suspended or demoted user is disconnected here.
     */
    async handleConnection(client: Socket) {
        try {
            const token = client.handshake.auth?.token;
            if (!token) {
                client.disconnect();
                return;
            }
            const payload = this.jwtService.verify(token, {
                secret: process.env.JWT_SECRET!,
                // Pin the algorithm. Without this, verification accepts whatever
                // the token's own header asks for.
                algorithms: ['HS256'],
            });
            if (!payload?.sub) {
                client.disconnect();
                return;
            }

            const user = await this.userCache.findActiveUser(payload.sub);
            if (!user) {
                client.disconnect();
                return;
            }

            // From the database, not the token.
            (client as any).userId = user.id;
            (client as any).userRole = user.role;
        } catch (err) {
            client.disconnect();
        }
    }

    handleDisconnect(client: Socket) {
        // optional: leave all rooms on disconnect
    }

    @SubscribeMessage('chat:join')
    async handleJoin(client: Socket, payload: { roomId: string }) {
        try {
            const userId = (client as any).userId;
            if (!userId || !payload?.roomId) return;
            const hasAccess = await this.chatService.userHasRoomAccess(payload.roomId, userId);
            if (hasAccess) {
                await client.join(payload.roomId);
            }
        } catch (err) {
            // ignore join errors
        }
    }

    @SubscribeMessage('direct:join')
    async handleDirectJoin(client: Socket, payload: { chatId: string }) {
        try {
            const userId = (client as any).userId;
            const role = (client as any).userRole;
            if (!userId || !payload?.chatId) return;
            const hasAccess = await this.chatService.userHasDirectAccess(payload.chatId, userId, role);
            if (hasAccess) {
                await client.join(`direct:${payload.chatId}`);
            }
        } catch (err) {
            // ignore join errors
        }
    }

    // Helper: emit a message to a room (called from service or controller)
    emitMessage(roomId: string, payload: any) {
        this.server.to(roomId).emit('chat:message', payload);
    }

    // Helper: emit a direct message to a direct chat channel (called from controller)
    emitDirectMessage(chatId: string, payload: any) {
        this.server.to(`direct:${chatId}`).emit('direct:message', payload);
    }
}