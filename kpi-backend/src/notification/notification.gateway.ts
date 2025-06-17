import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Notification } from '../notification/entities/notification.entity'; // Adjust the import path as necessary
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/notifications',
})
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger = new Logger(NotificationGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    this.logger.log(`Handshake details: ${JSON.stringify(client.handshake)}`);
    // Optionally, join user-specific room if userId is provided
    const { userId } = client.handshake.query;
    if (userId) {
      client.join(`user_${userId}`);
      this.logger.log(`Client ${client.id} joined room user_${userId}`);
    } else {
      this.logger.warn(`Client ${client.id} connected without userId`);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // Gửi notification tới user cụ thể
  sendNotificationToUser(userId: number, notification: Notification) {
    this.server.to(`user_${userId}`).emit('notification', notification);
  }

  // (Optional) Gửi broadcast tới tất cả client
  broadcastNotification(notification: Notification) {
    this.server.emit('notification', notification);
  }
}
