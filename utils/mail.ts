import Bull from 'bull';
import { MailModel, MailReceiverDataModel } from './constants/db';

/**
 * Creates a new Bull instance for purging mails from the database upon expiry.
 */
export const MAIL_PURGE_QUEUE = new Bull('mailPurgeQueue', {
  redis: process.env.REDIS_URL
});

/**
 * Processes the job to purge a mail from the database.
 */
MAIL_PURGE_QUEUE.process('purgeMail', async (job) => {
  const { mailId } = job.data;

  try {
    // search for the mail ID in `Mail`
    const mail = await MailModel.findOne({ _id: mailId }).lean();

    // search for all mail receiver data that has the mail ID
    const mailReceiverData = await MailReceiverDataModel.find({ mailId }).lean();

    // if mail exists, we purge. if not, ignore.
    if (mail) {
      // delete the mail
      await MailModel.deleteOne({ _id: mailId });
    }

    // if mail receiver data exists, we purge. if not, ignore.
    if (mailReceiverData.length > 0) {
      // delete all mail receiver data
      await MailReceiverDataModel.deleteMany({ mailId });
    }

    console.log(`Purged mail with ID ${mailId}`);
  } catch (err: any) {
    console.error(`Failed to purge mail with ID ${mailId}: ${err.message}`);
    throw err;
  }
})

