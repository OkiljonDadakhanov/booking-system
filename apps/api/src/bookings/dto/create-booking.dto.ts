import { IsUUID } from 'class-validator';

export class CreateBookingDto {
  @IsUUID()
  eventId!: string;
}
