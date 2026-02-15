import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Clean existing data
  await prisma.booking.deleteMany();
  await prisma.event.deleteMany();
  await prisma.user.deleteMany();

  // Create users
  const hashedPassword = await bcrypt.hash('Password123', 10);

  const users = await Promise.all([
    prisma.user.create({
      data: {
        email: 'alice@example.com',
        password: hashedPassword,
        name: 'Alice Johnson',
      },
    }),
    prisma.user.create({
      data: {
        email: 'bob@example.com',
        password: hashedPassword,
        name: 'Bob Smith',
      },
    }),
    prisma.user.create({
      data: {
        email: 'charlie@example.com',
        password: hashedPassword,
        name: 'Charlie Brown',
      },
    }),
  ]);

  // Create events
  const events = await Promise.all([
    prisma.event.create({
      data: {
        title: 'Tech Conference 2026',
        description:
          'Annual technology conference featuring the latest in AI, cloud computing, and software development.',
        date: new Date('2026-06-15T09:00:00Z'),
        venue: 'Convention Center, San Francisco',
        totalTickets: 500,
        remainingTickets: 500,
        price: 299.99,
      },
    }),
    prisma.event.create({
      data: {
        title: 'Limited Concert',
        description:
          'An exclusive intimate concert with only 2 tickets available. First come, first served!',
        date: new Date('2026-04-20T20:00:00Z'),
        venue: 'Jazz Club, New York',
        totalTickets: 2,
        remainingTickets: 2,
        price: 150.0,
      },
    }),
    prisma.event.create({
      data: {
        title: 'Startup Meetup',
        description:
          'Network with fellow entrepreneurs and investors. Pitch your ideas and get feedback.',
        date: new Date('2026-05-10T18:00:00Z'),
        venue: 'Innovation Hub, Austin',
        totalTickets: 100,
        remainingTickets: 100,
        price: 25.0,
      },
    }),
    prisma.event.create({
      data: {
        title: 'Art Exhibition Opening',
        description:
          'Opening night of the contemporary art exhibition featuring works from emerging artists.',
        date: new Date('2026-03-28T19:00:00Z'),
        venue: 'Modern Art Gallery, Chicago',
        totalTickets: 50,
        remainingTickets: 50,
        price: 45.0,
      },
    }),
    prisma.event.create({
      data: {
        title: 'Marathon 2026',
        description:
          'Annual city marathon. All fitness levels welcome. Includes medal and refreshments.',
        date: new Date('2026-09-12T07:00:00Z'),
        venue: 'City Park, Boston',
        totalTickets: 1000,
        remainingTickets: 1000,
        price: 75.0,
      },
    }),
  ]);

  console.log('Seed completed:');
  console.log(`  Created ${users.length} users`);
  console.log(`  Created ${events.length} events`);
  console.log(
    `  "Limited Concert" has ${events[1].remainingTickets} tickets (for concurrency testing)`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
