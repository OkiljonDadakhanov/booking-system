import { Module } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { BookingsGateway } from './bookings.gateway';
import { PrismaService } from '../common/prisma.service';

@Module({
  controllers: [BookingsController],
  providers: [BookingsService, BookingsGateway, PrismaService],
})
export class BookingsModule {}
