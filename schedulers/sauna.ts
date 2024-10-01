import Bull from "bull";

export const saunaQueue = new Bull('saunaQueue', {
  redis: process.env.REDIS_URL
});

saunaQueue.process(async (job) => {
  const { userId } = job.data;
  console.log('sauna queue process the job', userId);
 // TODO add energy to user and remove from queue job
});