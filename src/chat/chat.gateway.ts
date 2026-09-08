import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from './chat.service';
import { getFrontendUrl } from '../common/frontend-url';

@WebSocketGateway({ cors: { origin: getFrontendUrl() } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    constructor(private readonly jwtService: JwtService, private readonly chatService: ChatService) { }

@WebSocketServer()
server!: Server;

    async handleConnection(client: Socket) {
        try {
            const token = client.handshake.auth.token;
            if (!token) {
                client.disconnect();
                return;
            }
            const payload = this.jwtService.verify(token, { secret: process.env.JWT_SECRET! });
            // Attach user info to socket for later use
            (client as any).userId = payload.sub;
            (client as any).userRole = payload.role;
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