import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',')
      : ['http://localhost:3000'],
    credentials: true,
  },
})
export class BookingsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  emitTicketUpdate(eventId: string, remainingTickets: number) {
    this.server.emit('ticketUpdate', { eventId, remainingTickets });
  }
}
