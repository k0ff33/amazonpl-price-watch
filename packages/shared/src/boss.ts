import { PgBoss } from 'pg-boss';

export function createBoss(connectionString: string): PgBoss {
  return new PgBoss({
    connectionString,
    // Queue-level retry/expiry/retention options are set per-queue
    // via createQueue() in each service, not in the constructor.
  });
}
