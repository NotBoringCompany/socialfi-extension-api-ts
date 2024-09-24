import { Mail, MailDTO } from "../models/mail";

/**
 * The function then returns the array of MailDTO objects.
 *
 * @param {Mail[]} mails - The array of Mail documents to be processed.
 * @param {string} userId - The ID of the user for which the mail should be
 *                          processed.
 * @return {MailDTO[]} - An array of MailDTO objects.
 */
export const mailTransformHelper = (mails: Mail[], userId: string): MailDTO[] => {
  if (!mails || !userId) return [];
  return mails.flatMap(mail => {
    /**
     * Find the receiver of the mail
     * If not found, return an empty array
     * If found, convert into MailDTO
     */
    const receiver = mail.receiverIds.find(r => r._id === userId && r.isDeleted.status === false);
    if (!receiver) return [];
    return {
      _id: mail._id,
      userId: receiver._id,
      isRead: receiver.isRead.status,
      isReadAt: receiver.isRead.timestamp,
      isDeleted: receiver.isDeleted.status,
      isDeletedAt: receiver.isDeleted.timestamp,
      isClaimed: receiver.isClaimed.status,
      isClaimedAt: receiver.isClaimed.timestamp,
      subject: mail.subject,
      body: mail.body,
      attachments: mail.attachments,
      timestamp: mail.timestamp,
      expiredDate: mail.expiredDate,
      type: mail.type,
    };
  })
}

