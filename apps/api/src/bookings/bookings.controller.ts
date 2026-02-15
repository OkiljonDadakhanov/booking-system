import { Controller, Post, Get, Delete, Body, Param } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller()
export class BookingsController {
  constructor(private bookingsService: BookingsService) {}

  @Post('book')
  createBooking(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateBookingDto,
  ) {
    return this.bookingsService.createBooking(userId, dto.eventId);
  }

  @Get('bookings')
  getUserBookings(@CurrentUser('id') userId: string) {
    return this.bookingsService.getUserBookings(userId);
  }

  @Delete('bookings/:id')
  cancelBooking(
    @CurrentUser('id') userId: string,
    @Param('id') bookingId: string,
  ) {
    return this.bookingsService.cancelBooking(userId, bookingId);
  }
}
