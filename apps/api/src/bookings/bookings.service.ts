import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { BookingsGateway } from './bookings.gateway';

interface RawEvent {
  id: string;
  title: string;
  description: string;
  date: Date;
  venue: string;
  totalTickets: number;
  remainingTickets: number;
  price: number;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class BookingsService {
  constructor(
    private prisma: PrismaService,
    private bookingsGateway: BookingsGateway,
  ) {}

  async createBooking(userId: string, eventId: string) {
    let booking;
    try {
      booking = await this.prisma.$transaction(
        async (tx) => {
          // 1. Lock and read event row with SELECT FOR UPDATE
          const events = await tx.$queryRaw<RawEvent[]>`
            SELECT * FROM "Event" WHERE id::text = ${eventId} FOR UPDATE
          `;
          const event = events[0];

          // 2. Check event exists
          if (!event) {
            throw new NotFoundException('Event not found');
          }

          // 3. Check remaining tickets
          if (event.remainingTickets <= 0) {
            throw new ConflictException('No tickets available');
          }

          // 4. Check user not already booked
          const existingBooking = await tx.booking.findUnique({
            where: {
              userId_eventId: { userId, eventId },
            },
          });
          if (existingBooking && existingBooking.status === 'CONFIRMED') {
            throw new ConflictException('Already booked');
          }

          // 5. Artificial delay (1 second) to demonstrate concurrency handling
          await new Promise((resolve) => setTimeout(resolve, 1000));

          // 6. Decrement remainingTickets
          await tx.event.update({
            where: { id: eventId },
            data: { remainingTickets: { decrement: 1 } },
          });

          // 7. Create or update booking
          if (existingBooking && existingBooking.status === 'CANCELLED') {
            return tx.booking.update({
              where: { id: existingBooking.id },
              data: { status: 'CONFIRMED' },
              include: { event: true },
            });
          }

          return tx.booking.create({
            data: { userId, eventId, status: 'CONFIRMED' },
            include: { event: true },
          });
        },
        { isolationLevel: 'RepeatableRead' },
      );
    } catch (error) {
      // Re-throw NestJS HTTP exceptions as-is
      if (error instanceof NotFoundException || error instanceof ConflictException || error instanceof ForbiddenException) {
        throw error;
      }
      // Prisma transaction serialization failures → 409 (concurrent booking conflict)
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new ConflictException('No tickets available');
      }
      throw error;
    }

    // Emit real-time update
    const updatedEvent = await this.prisma.event.findUnique({
      where: { id: eventId },
    });
    if (updatedEvent) {
      this.bookingsGateway.emitTicketUpdate(
        eventId,
        updatedEvent.remainingTickets,
      );
    }

    return booking;
  }

  async getUserBookings(userId: string) {
    return this.prisma.booking.findMany({
      where: { userId, status: 'CONFIRMED' },
      include: { event: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async cancelBooking(userId: string, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { event: true },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.userId !== userId) {
      throw new ForbiddenException('Not your booking');
    }

    if (booking.status === 'CANCELLED') {
      throw new ConflictException('Booking already cancelled');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedBooking = await tx.booking.update({
        where: { id: bookingId },
        data: { status: 'CANCELLED' },
        include: { event: true },
      });

      await tx.event.update({
        where: { id: booking.eventId },
        data: { remainingTickets: { increment: 1 } },
      });

      return updatedBooking;
    });

    // Emit real-time update
    const updatedEvent = await this.prisma.event.findUnique({
      where: { id: booking.eventId },
    });
    if (updatedEvent) {
      this.bookingsGateway.emitTicketUpdate(
        booking.eventId,
        updatedEvent.remainingTickets,
      );
    }

    return updated;
  }
}
