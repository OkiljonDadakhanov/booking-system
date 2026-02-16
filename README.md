# High-Load Booking System

A production-grade event booking system built to handle concurrent ticket purchases without overselling. When 10 users simultaneously try to book an event with 2 remaining tickets, exactly 2 succeed and 8 are rejected.

## Tech Stack

- **Backend**: NestJS, TypeScript, Prisma ORM, PostgreSQL
- **Frontend**: Next.js 14 (App Router), TailwindCSS, Zustand, Axios
- **Real-Time**: WebSockets (Socket.IO) via NestJS Gateway
- **Auth**: JWT (access token in memory, refresh token in httpOnly cookie)
- **Infra**: Docker Compose, npm workspaces monorepo

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| State Management | Zustand | Minimal boilerplate, fine-grained subscriptions |
| Concurrency | Pessimistic Locking (`SELECT ... FOR UPDATE`) | Guarantees no overselling under high load |
| Token Storage | httpOnly cookie (refresh) + in-memory (access) | XSS-safe refresh, instant access in requests |
| Real-Time | WebSockets via NestJS Gateway | Push ticket count changes to all connected clients |
| Monorepo | npm workspaces | Simple setup for 2 apps, no extra tooling needed |

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 16 (or Docker)
- npm 9+

### With Docker Compose

```bash
docker-compose up --build
```

This starts PostgreSQL, the API (port 3001), and the web app (port 3000). Migrations and seeding run automatically.

### Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

3. **Set up database**:
   ```bash
   cd apps/api
   npx prisma migrate dev --name init
   npx prisma db seed
   ```

4. **Start the API**:
   ```bash
   npm run dev:api
   ```

5. **Start the web app** (in another terminal):
   ```bash
   npm run dev:web
   ```

6. Open http://localhost:3000

### Seed Data

| User | Email |
|------|-------|
| Alice Johnson | alice@example.com |
| Bob Smith | bob@example.com |
| Charlie Brown | charlie@example.com |

Seed user password is set via the `SEED_USER_PASSWORD` environment variable in `.env`.

Events include a **"Limited Concert"** with only 2 tickets for concurrency testing.

## API Endpoints

### Auth
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | No | Register new user |
| POST | `/auth/login` | No | Login |
| POST | `/auth/refresh` | No | Refresh access token |
| POST | `/auth/logout` | Yes | Logout |

### Events
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/events` | No | List events (paginated, searchable, sortable) |
| GET | `/events/:id` | No | Get single event |

**Query Parameters**: `page`, `limit`, `search`, `sortBy` (date/price/title), `sortOrder` (asc/desc)

### Bookings
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/book` | Yes | Book an event (`{ eventId }`) |
| GET | `/bookings` | Yes | Get user's bookings |
| DELETE | `/bookings/:id` | Yes | Cancel a booking |

### WebSocket
- Event: `ticketUpdate` — `{ eventId, remainingTickets }`
- Emitted on booking creation and cancellation

## Concurrency Test

Run the test script to verify race condition handling:

```bash
npm run test:concurrency
```

This will:
1. Register 10 users
2. Find the "Limited Concert" event (2 tickets)
3. Fire 10 simultaneous booking requests
4. Verify exactly 2 succeed, 8 fail, and remaining tickets = 0

Expected output:
```
=== FINAL VERDICT ===
PASS: Concurrency control working correctly!
  - Exactly 2 bookings succeeded for 2 available tickets
  - Exactly 8 bookings were rejected
  - Remaining tickets is 0 (no overselling)
```

## Bugs Fixed & Improvements

### Backend Fixes
- **UUID casting in raw SQL**: Fixed `SELECT ... FOR UPDATE` query to properly cast UUID types (`id::text = ${eventId}`)
- **Prisma serialization errors**: Wrapped transactions in try/catch, converting Prisma serialization failures to proper 409 responses instead of 500
- **Exception filter crash**: Added `headersSent` guard to prevent `ERR_HTTP_HEADERS_SENT` crash when response was already sent
- **Cookie-parser import**: Fixed TypeScript import for `cookie-parser` (default vs namespace import)
- **Environment variable loading**: Added early `dotenv` loading in `main.ts` for monorepo `.env` resolution before NestJS boots

### Frontend Fixes
- **Auth race condition**: Added `initialized` flag to auth store — dashboard now waits for auth to be restored before rendering children, preventing `fetchBookings()` from firing before access token is available
- **Client-side auth redirect**: Dashboard layout redirects to `/login` after auth check if user is not authenticated
- **WebSocket gated on auth**: WebSocket connection now only establishes after successful authentication
- **Event refresh after booking**: `fetchEvents()` is called after booking as a fallback in case WebSocket update doesn't reach the client
- **Error handling in fetchBookings**: Added `catch` block to prevent unhandled promise rejections
- **WebSocket reconnection**: Added explicit transports (`websocket`, `polling`), reconnection with 10 retry attempts, and connection error logging

### Docker Fixes
- **Prisma OpenSSL on Alpine**: Added `apk add --no-cache openssl` to API Dockerfile
- **npm workspace install**: All workspace `package.json` files are now copied into each Dockerfile
- **TypeScript output nesting**: Fixed `tsconfig.json` to only include `src/**/*`, preventing `dist/src/main.js` nesting
- **NEXT_PUBLIC_API_URL**: Changed from Docker internal DNS (`http://api:3001`) to browser-accessible `http://localhost:3001`

### Concurrency Test Results
```
=== RESULTS ===
  SUCCESS (200): 2
  FAILED  (409): 8

=== VERIFICATION ===
  Remaining tickets: 0
  Expected successes: 2, Actual: 2
  Expected failures: 8, Actual: 8

=== FINAL VERDICT ===
  PASS: Concurrency control working correctly!
```

## Project Structure

```
booking-system/
├── apps/
│   ├── api/                    # NestJS backend
│   │   ├── prisma/             # Schema & seed
│   │   └── src/
│   │       ├── auth/           # Auth module (register, login, JWT)
│   │       ├── events/         # Events module (CRUD, pagination)
│   │       ├── bookings/       # Bookings module (concurrency-safe)
│   │       └── common/         # Shared (Prisma, filters, decorators)
│   └── web/                    # Next.js frontend
│       ├── app/
│       │   ├── (auth)/         # Login, register pages
│       │   └── (dashboard)/    # Events, bookings pages
│       ├── components/         # Reusable UI components
│       ├── store/              # Zustand stores
│       └── lib/                # API client, socket
├── scripts/                    # Concurrency test
├── docker-compose.yml
└── package.json                # Workspace root
```
