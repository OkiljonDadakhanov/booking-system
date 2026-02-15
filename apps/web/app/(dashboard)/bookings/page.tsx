'use client';

import { useEffect, useState } from 'react';
import { useBookingStore } from '@/store/booking-store';
import { useEventStore } from '@/store/event-store';
import { BookingCard } from '@/components/booking-card';
import { ConfirmationDialog } from '@/components/confirmation-dialog';
import { EmptyState } from '@/components/empty-state';
import toast from 'react-hot-toast';

export default function BookingsPage() {
  const { bookings, loading, fetchBookings, cancelBooking } =
    useBookingStore();
  const { fetchEvents } = useEventStore();
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const handleCancelRequest = (bookingId: string) => {
    setConfirmCancelId(bookingId);
  };

  const handleCancelConfirm = async () => {
    if (!confirmCancelId) return;
    setCancellingId(confirmCancelId);
    setConfirmCancelId(null);
    try {
      await cancelBooking(confirmCancelId);
      // Refresh events to get updated ticket counts
      fetchEvents();
      toast.success('Booking cancelled successfully.');
    } catch {
      toast.error('Failed to cancel booking. Please try again.');
    } finally {
      setCancellingId(null);
    }
  };

  const cancelBookingData = confirmCancelId
    ? bookings.find((b) => b.id === confirmCancelId)
    : null;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">My Bookings</h1>
        <p className="text-gray-500">Manage your event bookings</p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-pulse"
            >
              <div className="h-5 bg-gray-200 rounded w-1/3 mb-3" />
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-1/4" />
            </div>
          ))}
        </div>
      ) : bookings.length === 0 ? (
        <EmptyState
          title="No bookings yet"
          message="You haven't booked any events yet. Browse events to get started!"
        />
      ) : (
        <div className="space-y-4">
          {bookings.map((booking) => (
            <BookingCard
              key={booking.id}
              booking={booking}
              onCancel={handleCancelRequest}
              cancelling={cancellingId === booking.id}
            />
          ))}
        </div>
      )}

      <ConfirmationDialog
        isOpen={!!confirmCancelId}
        title="Cancel Booking"
        message={`Are you sure you want to cancel your booking for "${cancelBookingData?.event.title}"? This action cannot be undone.`}
        confirmLabel="Cancel Booking"
        cancelLabel="Keep Booking"
        onConfirm={handleCancelConfirm}
        onCancel={() => setConfirmCancelId(null)}
      />
    </div>
  );
}
