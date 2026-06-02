import { Queue, Worker, type JobsOptions } from "bullmq";
import IORedis from "ioredis";
import { config } from "../config.js";

let connection: IORedis | null = null;

function getConnection(): IORedis {
  if (connection) return connection;
  if (!config.redisUrl) {
    throw new Error("REDIS_URL not set -- BullMQ requires Redis");
  }
  // BullMQ requires maxRetriesPerRequest: null on the connection
  connection = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });
  return connection;
}

export type QueueName =
  | "ingestion"
  | "transcription"
  | "understanding"
  | "verification"
  | "content-generation";

const queues = new Map<QueueName, Queue>();

export function getQueue(name: QueueName): Queue {
  let q = queues.get(name);
  if (q) return q;
  q = new Queue(name, { connection: getConnection() });
  queues.set(name, q);
  return q;
}

export async function enqueue<T = unknown>(
  name: QueueName,
  payload: T,
  opts?: JobsOptions,
): Promise<string> {
  const q = getQueue(name);
  const job = await q.add(name, payload, {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 1000 },
    ...opts,
  });
  return job.id ?? "";
}

export function startWorker<T = unknown>(
  name: QueueName,
  handler: (payload: T) => Promise<void>,
): Worker {
  const w = new Worker<T>(
    name,
    async (job) => {
      await handler(job.data);
    },
    { connection: getConnection(), concurrency: 2 },
  );
  w.on("failed", (job, err) => {
    console.error(`[worker:${name}] job ${job?.id} failed`, err);
  });
  return w;
}

export async function closeQueues(): Promise<void> {
  for (const q of queues.values()) await q.close();
  if (connection) {
    connection.disconnect();
    connection = null;
  }
}
