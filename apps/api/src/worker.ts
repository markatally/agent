import { Worker, Queue } from 'bullmq';
import Redis from 'ioredis';

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

// Task queue for async processing
const taskQueue = new Queue('tasks', { connection });

// Worker to process tasks
const worker = new Worker(
  'tasks',
  async (job) => {
    console.log(`Processing job ${job.id}: ${job.name}`);

    switch (job.name) {
      case 'execute-tool':
        // TODO: Implement tool execution
        console.log('Executing tool:', job.data);
        break;

      case 'run-sandbox':
        // TODO: Implement sandbox execution
        console.log('Running sandbox:', job.data);
        break;

      case 'cleanup-session':
        // TODO: Implement session cleanup
        console.log('Cleaning up session:', job.data);
        break;

      default:
        console.warn(`Unknown job type: ${job.name}`);
    }

    return { success: true };
  },
  { connection }
);

worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err);
});

console.log('Worker started, waiting for jobs...');

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down worker...');
  await worker.close();
  await connection.quit();
  process.exit(0);
});

export { taskQueue };
