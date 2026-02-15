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

| User | Email | Password |
|------|-------|----------|
| Alice Johnson | alice@example.com | Password123 |
| Bob Smith | bob@example.com | Password123 |
| Charlie Brown | charlie@example.com | Password123 |

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
