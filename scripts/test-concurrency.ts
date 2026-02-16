import axios, { AxiosError } from 'axios';

const API_URL = process.env.API_URL || 'http://localhost:3001';
const TEST_PASSWORD = process.env.TEST_PASSWORD;

if (!TEST_PASSWORD) {
  console.error('ERROR: TEST_PASSWORD environment variable is required');
  process.exit(1);
}

interface AuthResponse {
  user: { id: string; email: string; name: string };
  accessToken: string;
}

interface EventResponse {
  data: Array<{
    id: string;
    title: string;
    remainingTickets: number;
    totalTickets: number;
  }>;
}

async function registerUser(
  index: number,
): Promise<{ token: string; email: string }> {
  const email = `testuser${index}_${Date.now()}@example.com`;
  const password = TEST_PASSWORD!;
  const name = `Test User ${index}`;

  try {
    const res = await axios.post<AuthResponse>(`${API_URL}/auth/register`, {
      email,
      password,
      name,
    });
    return { token: res.data.accessToken, email };
  } catch (err) {
    const error = err as AxiosError;
    throw new Error(
      `Failed to register user ${index}: ${error.response?.status} ${JSON.stringify(error.response?.data)}`,
    );
  }
}

async function bookEvent(
  token: string,
  eventId: string,
  userIndex: number,
): Promise<{ success: boolean; status: number; message: string }> {
  try {
    await axios.post(
      `${API_URL}/book`,
      { eventId },
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return { success: true, status: 200, message: 'Booking successful' };
  } catch (err) {
    const error = err as AxiosError<{ message: string[] }>;
    const status = error.response?.status || 500;
    const message =
      error.response?.data?.message?.join(', ') || 'Unknown error';
    return { success: false, status, message };
  }
}

async function main() {
  console.log('=== Concurrency Test for Booking System ===\n');
  console.log(`API URL: ${API_URL}\n`);

  // Step 1: Register 10 users
  console.log('Step 1: Registering 10 test users...');
  const users: Array<{ token: string; email: string }> = [];
  for (let i = 0; i < 10; i++) {
    const user = await registerUser(i);
    users.push(user);
  }
  console.log(`  Registered ${users.length} users\n`);

  // Step 2: Find the "Limited Concert" event with 2 tickets
  console.log('Step 2: Finding "Limited Concert" event...');
  const eventsRes = await axios.get<EventResponse>(
    `${API_URL}/events?search=Limited Concert&limit=50`,
  );
  const limitedEvent = eventsRes.data.data.find(
    (e) => e.title === 'Limited Concert',
  );
  if (!limitedEvent) {
    console.error('  ERROR: "Limited Concert" event not found!');
    process.exit(1);
  }
  console.log(
    `  Found: "${limitedEvent.title}" (${limitedEvent.remainingTickets}/${limitedEvent.totalTickets} tickets)\n`,
  );

  // Step 3: Fire 10 simultaneous booking requests
  console.log('Step 3: Firing 10 simultaneous booking requests...');
  const startTime = Date.now();
  const results = await Promise.all(
    users.map((user, index) =>
      bookEvent(user.token, limitedEvent.id, index),
    ),
  );
  const elapsed = Date.now() - startTime;
  console.log(`  All requests completed in ${elapsed}ms\n`);

  // Step 4: Analyze results
  console.log('Step 4: Results:');
  const successes = results.filter((r) => r.success);
  const failures = results.filter((r) => !r.success);

  results.forEach((result, index) => {
    const status = result.success ? 'SUCCESS' : 'FAILED';
    console.log(
      `  User ${index}: ${status} (${result.status}) - ${result.message}`,
    );
  });

  console.log(`\n  Successes: ${successes.length} (expected: 2)`);
  console.log(`  Failures:  ${failures.length} (expected: 8)\n`);

  // Step 5: Verify remaining tickets
  console.log('Step 5: Verifying remaining tickets...');
  const verifyRes = await axios.get<EventResponse>(
    `${API_URL}/events?search=Limited Concert`,
  );
  const verifiedEvent = verifyRes.data.data.find(
    (e) => e.title === 'Limited Concert',
  );
  const remainingTickets = verifiedEvent?.remainingTickets ?? -1;
  console.log(`  Remaining tickets: ${remainingTickets} (expected: 0)\n`);

  // Step 6: Final verdict
  console.log('=== FINAL VERDICT ===');
  const passed =
    successes.length === 2 && failures.length === 8 && remainingTickets === 0;

  if (passed) {
    console.log('PASS: Concurrency control working correctly!');
    console.log(
      '  - Exactly 2 bookings succeeded for 2 available tickets',
    );
    console.log('  - Exactly 8 bookings were rejected');
    console.log('  - Remaining tickets is 0 (no overselling)');
  } else {
    console.log('FAIL: Concurrency issues detected!');
    if (successes.length !== 2)
      console.log(`  - Expected 2 successes, got ${successes.length}`);
    if (failures.length !== 8)
      console.log(`  - Expected 8 failures, got ${failures.length}`);
    if (remainingTickets !== 0)
      console.log(
        `  - Expected 0 remaining tickets, got ${remainingTickets}`,
      );
  }

  process.exit(passed ? 0 : 1);
}

main().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
