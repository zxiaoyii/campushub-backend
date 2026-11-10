import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

/**
 * Every test file gets its own in-memory MongoDB. Nothing here touches the
 * `MONGODB_URI` the application reads from config: the tests connect Mongoose
 * themselves, so a stray run can never reach the development database.
 *
 * Collections are emptied between tests rather than between files, because the
 * reservation suites assert on counts and a leftover row from a previous test
 * would make them pass or fail for the wrong reason.
 */
let memoryServer: MongoMemoryServer | undefined;

beforeAll(async (): Promise<void> => {
  memoryServer = await MongoMemoryServer.create();
  mongoose.set('strictQuery', true);
  await mongoose.connect(memoryServer.getUri('campushub-test'));

  // Build the indexes before the first test runs. The unique slot index is
  // what makes two concurrent identical bookings conflict, so a suite that
  // raced ahead of index creation would assert on the wrong behaviour.
  await Promise.all(
    Object.values(mongoose.models).map((registered): Promise<unknown> =>
      registered.init(),
    ),
  );
}, 120_000);

afterEach(async (): Promise<void> => {
  const { db } = mongoose.connection;
  if (db === undefined) {
    return;
  }
  const collections = await db.collections();
  await Promise.all(
    collections.map((collection): Promise<unknown> =>
      collection.deleteMany({}),
    ),
  );
});

afterAll(async (): Promise<void> => {
  await mongoose.disconnect();
  await memoryServer?.stop();
});
