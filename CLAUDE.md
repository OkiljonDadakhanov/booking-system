# High-Load Booking System - Implementation Plan

## Context

Build a production-grade event booking system resilient to race conditions and overselling. The core challenge: when 10 concurrent booking requests arrive for an event with 2 remaining tickets, exactly 2 succeed and 8 are rejected. The project is a monorepo with NestJS backend, Next.js 14+ frontend, PostgreSQL, Prisma ORM, and JWT auth.

### Key Architecture Decisions
- **State Management**: Zustand — minimal boilerplate, fine-grained subscriptions, fits the simple state shape (auth, events, bookings)
- **Concurrency**: Pessimistic Locking with `SELECT ... FOR UPDATE` inside Prisma interactive transactions
- **Token Storage**: httpOnly cookie for refresh token (set by backend), access token in memory (Zustand store)
- **Real-Time Updates**: WebSockets via NestJS Gateway — push ticket count changes to all connected clients
- **Monorepo**: npm workspaces (simple, no extra tooling like Turborepo needed for 2 apps)

---

## Phase 1: Project Scaffolding & Infrastructure

### 1.1 Root monorepo setup
- `package.json` with npm workspaces: `["apps/api", "apps/web", "scripts"]`
- `.env.example` with all required vars (DATABASE_URL, JWT secrets, API_PORT, NEXT_PUBLIC_API_URL)
- `.gitignore`
- `docker-compose.yml` (PostgreSQL + API + Web)

### 1.2 Backend scaffolding (`apps/api/`)
- Initialize NestJS with TypeScript strict mode
- Install deps: `@nestjs/config`, `@nestjs/jwt`, `@nestjs/passport`, `@nestjs/platform-socket.io`, `prisma`, `@prisma/client`, `bcrypt`, `class-validator`, `class-transformer`, `cookie-parser`
- Configure `tsconfig.json` with strict mode
- Setup `src/main.ts`: global validation pipe, exception filter, CORS, cookie-parser

### 1.3 Frontend scaffolding (`apps/web/`)
- Initialize Next.js 14+ with App Router, TypeScript
- Install deps: `zustand`, `axios`, `socket.io-client`, `react-hot-toast`
- Configure TailwindCSS
- Setup Axios instance in `lib/api.ts` with interceptors

### 1.4 Docker setup
- `docker-compose.yml`:
  - `postgres`: PostgreSQL 16 with health check
  - `api`: NestJS (depends on postgres), runs `npx prisma migrate deploy && npx prisma db seed` on startup
  - `web`: Next.js (depends on api)
- `apps/api/Dockerfile`, `apps/web/Dockerfile`

**Files to create:**
- `package.json` (root)
- `.env.example`, `.env` (local)
- `.gitignore`
- `docker-compose.yml`
- `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/nest-cli.json`
- `apps/api/Dockerfile`
- `apps/api/src/main.ts`, `apps/api/src/app.module.ts`
- `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/next.config.js`, `apps/web/tailwind.config.ts`, `apps/web/postcss.config.js`
- `apps/web/Dockerfile`

---

## Phase 2: Database & Prisma

### 2.1 Schema (`apps/api/prisma/schema.prisma`)
```prisma
model User {
  id        String    @id @default(uuid())
  email     String    @unique
  password  String
  name      String
  bookings  Booking[]
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}

model Event {
  id               String    @id @default(uuid())
  title            String
  description      String
  date             DateTime
  venue            String
  totalTickets     Int
  remainingTickets Int
  price            Float
  bookings         Booking[]
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
}

model Booking {
  id        String        @id @default(uuid())
  user      User          @relation(fields: [userId], references: [id])
  userId    String
  event     Event         @relation(fields: [eventId], references: [id])
  eventId   String
  status    BookingStatus @default(CONFIRMED)
  createdAt DateTime      @default(now())

  @@unique([userId, eventId])
}

enum BookingStatus {
  CONFIRMED
  CANCELLED
}
```

### 2.2 Seed script (`apps/api/prisma/seed.ts`)
- 3 users with bcrypt-hashed passwords
- 5 events: varying ticket counts, one event "Limited Concert" with exactly 2 tickets
- Configure in `package.json` prisma seed command

### 2.3 Run migration
- `npx prisma migrate dev --name init`

**Files to create:**
- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/seed.ts`

---

## Phase 3: Authentication Module (`apps/api/src/auth/`)

### 3.1 DTOs
- `dto/register.dto.ts`: email (IsEmail), password (MinLength 8, matches regex for letter+number), name (MinLength 2)
- `dto/login.dto.ts`: email, password
- `dto/refresh.dto.ts`: refreshToken

### 3.2 Auth Service (`auth.service.ts`)
- `register()`: validate unique email (409), hash password (bcrypt, 10 rounds), create user, generate token pair, set refresh token as httpOnly cookie
- `login()`: find user by email, compare password, return 401 "Invalid credentials" on failure, generate tokens
- `refresh()`: validate refresh token from cookie, rotate tokens (invalidate old, issue new pair)
- `generateTokens()`: access token (15min, JWT_ACCESS_SECRET), refresh token (7 days, JWT_REFRESH_SECRET)

### 3.3 Auth Controller (`auth.controller.ts`)
- `POST /auth/register` — returns 201 with user + accessToken, sets refreshToken in httpOnly cookie
- `POST /auth/login` — returns 200 with user + accessToken, sets refreshToken in httpOnly cookie
- `POST /auth/refresh` — reads refreshToken from cookie, returns new accessToken, sets new refreshToken cookie
- `POST /auth/logout` — clears the cookie

### 3.4 JWT Strategy & Guard
- `strategies/jwt.strategy.ts`: extract from Bearer header, validate, attach user to request
- `guards/jwt-auth.guard.ts`: global guard, skip for public routes using `@Public()` decorator
- `decorators/public.decorator.ts`: SetMetadata for marking public routes
- `decorators/current-user.decorator.ts`: extract user from request

**Files to create:**
- `apps/api/src/auth/auth.module.ts`
- `apps/api/src/auth/auth.service.ts`
- `apps/api/src/auth/auth.controller.ts`
- `apps/api/src/auth/dto/register.dto.ts`
- `apps/api/src/auth/dto/login.dto.ts`
- `apps/api/src/auth/strategies/jwt.strategy.ts`
- `apps/api/src/auth/guards/jwt-auth.guard.ts`
- `apps/api/src/common/decorators/public.decorator.ts`
- `apps/api/src/common/decorators/current-user.decorator.ts`

---

## Phase 4: Events Module (`apps/api/src/events/`)

### 4.1 DTOs
- `dto/query-events.dto.ts`: page (default 1), limit (default 10, max 50), search (optional), sortBy (date/price/title, default date), sortOrder (asc/desc, default asc)

### 4.2 Events Service (`events.service.ts`)
- `findAll(query)`: paginated query with search (case-insensitive title filter), sorting, return data + meta (total, page, limit, totalPages)
- `findOne(id)`: find by id, throw NotFoundException if not found

### 4.3 Events Controller (`events.controller.ts`)
- `GET /events` — paginated list with query params
- `GET /events/:id` — single event

**Files to create:**
- `apps/api/src/events/events.module.ts`
- `apps/api/src/events/events.service.ts`
- `apps/api/src/events/events.controller.ts`
- `apps/api/src/events/dto/query-events.dto.ts`

---

## Phase 5: Booking Module — THE CORE (`apps/api/src/bookings/`)

### 5.1 Booking Service (`bookings.service.ts`)
**`createBooking(userId, eventId)` — Critical concurrency-safe implementation:**
```typescript
await this.prisma.$transaction(async (tx) => {
  // 1. Lock and read event row with SELECT FOR UPDATE
  const [event] = await tx.$queryRaw`
    SELECT * FROM "Event" WHERE id = ${eventId}::uuid FOR UPDATE
  `;

  // 2. Check event exists → 404
  // 3. Check remainingTickets > 0 → 409 "No tickets available"
  // 4. Check user not already booked → 409 "Already booked"

  // 5. Artificial delay (1 second)
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 6. Decrement remainingTickets
  await tx.event.update({ where: { id: eventId }, data: { remainingTickets: { decrement: 1 } } });

  // 7. Create booking
  return tx.booking.create({ data: { userId, eventId, status: 'CONFIRMED' } });
}, { isolationLevel: 'RepeatableRead' });
```

**`getUserBookings(userId)`**: find all bookings with event details

**`cancelBooking(userId, bookingId)`**: transaction — set status CANCELLED, increment remainingTickets. Verify owner.

### 5.2 Booking Controller (`bookings.controller.ts`)
- `POST /book` — extract userId from JWT (not body), accepts `{ eventId }`
- `GET /bookings` — user's bookings with event details
- `DELETE /bookings/:id` — cancel booking

### 5.3 WebSocket Gateway (`bookings.gateway.ts`)
- NestJS WebSocket Gateway using Socket.IO
- Emit `ticketUpdate` event when a booking is created or cancelled: `{ eventId, remainingTickets }`
- Clients subscribe on connect to receive real-time updates

**Files to create:**
- `apps/api/src/bookings/bookings.module.ts`
- `apps/api/src/bookings/bookings.service.ts`
- `apps/api/src/bookings/bookings.controller.ts`
- `apps/api/src/bookings/bookings.gateway.ts`
- `apps/api/src/bookings/dto/create-booking.dto.ts`

---

## Phase 6: Global Backend Concerns

### 6.1 Exception Filter (`apps/api/src/common/filters/http-exception.filter.ts`)
- Catch all exceptions, return consistent JSON error format

### 6.2 Prisma Service (`apps/api/src/common/prisma.service.ts`)
- Extend PrismaClient, handle onModuleInit/onModuleDestroy

### 6.3 Validation Pipe (configured in `main.ts`)
- Global ValidationPipe with whitelist, forbidNonWhitelisted, transform

**Files to create:**
- `apps/api/src/common/filters/http-exception.filter.ts`
- `apps/api/src/common/prisma.service.ts`

---

## Phase 7: Concurrency Test Script

### `scripts/test-concurrency.ts`
1. Register or login 10 different users
2. Find the event with exactly 2 remaining tickets
3. Fire 10 simultaneous `POST /book` using `Promise.all`
4. Log results: successes (expected 2), failures (expected 8)
5. Verify `remainingTickets === 0`
6. Print PASS/FAIL summary

**Files to create:**
- `scripts/test-concurrency.ts`
- `scripts/package.json` (for ts-node / tsx runner)

---

## Phase 8: Frontend — Auth & Layout (`apps/web/`)

### 8.1 Zustand Stores
- `store/auth-store.ts`: user, accessToken, isAuthenticated, login(), register(), logout(), refresh()
- `store/event-store.ts`: events, meta, loading, fetchEvents(), updateTicketCount()
- `store/booking-store.ts`: bookings, loading, fetchBookings(), createBooking(), cancelBooking()

### 8.2 API Client (`lib/api.ts`)
- Axios instance with `baseURL` from env, `withCredentials: true` (for httpOnly cookies)
- Request interceptor: attach `Authorization: Bearer <accessToken>` from Zustand store
- Response interceptor: on 401, attempt silent refresh via `POST /auth/refresh`, retry original request; on second failure, redirect to `/login`

### 8.3 Auth Pages
- `app/(auth)/login/page.tsx`: centered form, email/password, client validation, inline errors, "Don't have an account?" link
- `app/(auth)/register/page.tsx`: form with name/email/password/confirm, validation rules (name 2+ chars, email format, password 8+ chars with letter+number, passwords match)
- `app/(auth)/layout.tsx`: centered layout, redirect authenticated users away

### 8.4 Route Protection
- `middleware.ts` (Next.js middleware): check for refresh token cookie, redirect to /login if missing for protected routes, redirect to /events if present for auth routes

### 8.5 Root Layout
- `app/layout.tsx`: TailwindCSS globals, toast provider (react-hot-toast)

**Files to create:**
- `apps/web/app/layout.tsx`
- `apps/web/app/(auth)/layout.tsx`
- `apps/web/app/(auth)/login/page.tsx`
- `apps/web/app/(auth)/register/page.tsx`
- `apps/web/middleware.ts`
- `apps/web/lib/api.ts`
- `apps/web/store/auth-store.ts`
- `apps/web/store/event-store.ts`
- `apps/web/store/booking-store.ts`

---

## Phase 9: Frontend — Event Dashboard (`/events`)

### 9.1 Event List Page (`app/(dashboard)/events/page.tsx`)
- Responsive card grid (1 col mobile, 2 col tablet, 3 col desktop)
- Search input (debounced 300ms) + sort dropdown (date/price/title)
- Loading skeleton while fetching

### 9.2 Event Card Component (`components/event-card.tsx`)
- Title, formatted date ("March 15, 2025 at 10:00 AM"), venue, price ($XX.XX)
- Remaining tickets badge:
  - Green: >50% remaining
  - Yellow: 10-50% remaining
  - Red: <10% remaining
  - Gray "Sold Out": 0 remaining
- "Book Now" button (disabled if sold out or already booked)
- Loading state: spinner + "Booking..." + disabled
- Success state: "Booked" (disabled, green)

### 9.3 WebSocket Integration (`lib/socket.ts`)
- Connect to NestJS WebSocket gateway
- Listen for `ticketUpdate` events
- Update Zustand event store with new `remainingTickets` in real-time

### 9.4 Dashboard Layout (`app/(dashboard)/layout.tsx`)
- Navigation header with: logo, "Events" link, "My Bookings" link, user name, logout button
- Redirect unauthenticated users

**Files to create:**
- `apps/web/app/(dashboard)/layout.tsx`
- `apps/web/app/(dashboard)/events/page.tsx`
- `apps/web/components/event-card.tsx`
- `apps/web/components/search-bar.tsx`
- `apps/web/components/sort-dropdown.tsx`
- `apps/web/components/ticket-badge.tsx`
- `apps/web/components/loading-skeleton.tsx`
- `apps/web/lib/socket.ts`

---

## Phase 10: Frontend — Booking Flow & My Bookings

### 10.1 Booking Flow (in Event Card)
- Click "Book Now" → loading state → API call → handle response:
  - Success: toast "Successfully booked [Event]!", update card, button → "Booked"
  - 409 (sold out): toast "Sorry, tickets for [Event] are no longer available.", update card sold out
  - 409 (already booked): toast "You have already booked this event.", button → "Booked"
  - Network error: toast "Failed to complete booking. Please try again.", reset button

### 10.2 My Bookings Page (`app/(dashboard)/bookings/page.tsx`)
- List of user's bookings: event title, date, venue, status badge, booking date
- "Cancel Booking" button with confirmation dialog (modal)
- After cancel: update bookings list, update event remaining tickets
- Empty state: "You haven't booked any events yet."

### 10.3 Shared Components
- `components/toast-provider.tsx` — react-hot-toast Toaster setup
- `components/confirmation-dialog.tsx` — reusable modal for cancel confirmation
- `components/empty-state.tsx` — reusable empty state with icon + message

**Files to create:**
- `apps/web/app/(dashboard)/bookings/page.tsx`
- `apps/web/components/booking-card.tsx`
- `apps/web/components/confirmation-dialog.tsx`
- `apps/web/components/toast-provider.tsx`
- `apps/web/components/empty-state.tsx`

---

## Phase 11: UI/UX Polish

- Responsive breakpoints: 375px (mobile), 768px (tablet), 1280px+ (desktop)
- Loading skeletons on every data-fetching page
- Empty states with helpful messaging
- Consistent color scheme: blues for primary, semantic colors for badges
- Accessibility: ARIA labels on interactive elements, keyboard navigation, focus management
- Toast notifications styled consistently

---

## Phase 12: Documentation & Final Touches

### 12.1 README.md
1. Project Overview
2. Tech Stack
3. Architecture Decisions (Zustand, pessimistic locking, httpOnly cookies, WebSockets)
4. Getting Started (prerequisites, Docker Compose, local dev)
5. API Documentation (all endpoints with request/response examples)
6. Concurrency Test instructions
7. Known Limitations / Future Improvements

---

## Implementation Order (Recommended)

| Step | Phase | Description |
|------|-------|-------------|
| 1 | Phase 1 | Root monorepo + Docker + env setup |
| 2 | Phase 2 | Prisma schema, migration, seed |
| 3 | Phase 6 | Prisma service, exception filter, validation |
| 4 | Phase 3 | Auth module (register, login, refresh, guard) |
| 5 | Phase 4 | Events module (list, detail) |
| 6 | Phase 5 | Booking module (create, list, cancel) + WebSocket gateway |
| 7 | Phase 7 | Concurrency test script |
| 8 | Phase 8 | Frontend auth (stores, API client, login/register, middleware) |
| 9 | Phase 9 | Frontend event dashboard + WebSocket client |
| 10 | Phase 10 | Frontend booking flow + my bookings |
| 11 | Phase 11 | UI/UX polish |
| 12 | Phase 12 | README + final review |

---

## Verification Plan

1. **Backend smoke test**: Start API, hit all endpoints with curl/Postman
2. **Concurrency test**: Run `scripts/test-concurrency.ts` — must show exactly 2 successes, 8 rejections, 0 remaining tickets
3. **Auth flow**: Register → login → access protected route → token refresh → logout
4. **Frontend E2E**: Login → browse events → book event → see booking in "My Bookings" → cancel booking
5. **Docker**: `docker-compose up --build` starts everything from scratch
6. **Responsive**: Test at 375px, 768px, 1280px breakpoints
7. **Race condition UX**: Open 2 browser tabs, book the last ticket in one, see sold-out update in the other via WebSocket
