'use client';

import { useState } from 'react';
import { Event, useEventStore } from '@/store/event-store';
import { useBookingStore, Booking } from '@/store/booking-store';
import { TicketBadge } from './ticket-badge';
import toast from 'react-hot-toast';

interface EventCardProps {
  event: Event;
  userBookings: Booking[];
}

export function EventCard({ event, userBookings }: EventCardProps) {
  const { createBooking } = useBookingStore();
  const { fetchEvents } = useEventStore();
  const [bookingLoading, setBookingLoading] = useState(false);

  const existingBooking = userBookings.find(
    (b) => b.eventId === event.id && b.status === 'CONFIRMED',
  );
  const isBooked = !!existingBooking;
  const isSoldOut = event.remainingTickets === 0;

  const formattedDate = new Date(event.date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const handleBook = async () => {
    setBookingLoading(true);
    try {
      await createBooking(event.id);
      // Refresh events to get updated remaining tickets (fallback for WebSocket)
      fetchEvents();
      toast.success(`Successfully booked ${event.title}!`);
    } catch (err: unknown) {
      const error = err as {
        response?: { status?: number; data?: { message?: string[] } };
      };
      if (error.response?.status === 409) {
        const msg = error.response.data?.message?.[0] || '';
        if (msg.includes('Already booked')) {
          toast.error('You have already booked this event.');
        } else {
          toast.error(
            `Sorry, tickets for ${event.title} are no longer available.`,
          );
        }
      } else {
        toast.error('Failed to complete booking. Please try again.');
      }
    } finally {
      setBookingLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
      <div>
        <div className="flex justify-between items-start mb-3">
          <h3 className="text-lg font-semibold text-gray-900 leading-tight">
            {event.title}
          </h3>
          <TicketBadge
            remaining={event.remainingTickets}
            total={event.totalTickets}
          />
        </div>
        <p className="text-sm text-gray-500 mb-4 line-clamp-2">
          {event.description}
        </p>
        <div className="space-y-1.5 text-sm">
          <div className="flex items-center gap-2 text-gray-600">
            <svg
              className="h-4 w-4 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            {formattedDate}
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <svg
              className="h-4 w-4 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            {event.venue}
          </div>
        </div>
      </div>
      <div className="flex justify-between items-center mt-5 pt-4 border-t border-gray-100">
        <span className="text-lg font-bold text-gray-900">
          ${event.price.toFixed(2)}
        </span>
        {isBooked ? (
          <button
            disabled
            className="px-5 py-2 rounded-lg text-sm font-medium bg-green-100 text-green-700 cursor-default"
          >
            Booked
          </button>
        ) : (
          <button
            onClick={handleBook}
            disabled={isSoldOut || bookingLoading}
            className="px-5 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed bg-primary-600 text-white hover:bg-primary-700 focus:ring-4 focus:ring-primary-200"
            aria-label={`Book ${event.title}`}
          >
            {bookingLoading ? (
              <span className="flex items-center gap-2">
                <svg
                  className="animate-spin h-4 w-4"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Booking...
              </span>
            ) : isSoldOut ? (
              'Sold Out'
            ) : (
              'Book Now'
            )}
          </button>
        )}
      </div>
    </div>
  );
}
