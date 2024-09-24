import Bull from 'bull';
import { purgeExpiredMails } from '../api/mail';

export const mailGarbageCollector = new Bull('mailGarbageCollector', {
  redis: process.env.REDIS_URL
});

mailGarbageCollector.process(async () => {
  console.log('Cleaning up expired mails...');
  await purgeExpiredMails(Math.floor(Date.now() / 1000));
})