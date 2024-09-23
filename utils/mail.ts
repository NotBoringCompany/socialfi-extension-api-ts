import { Mail, MailDTO } from "../models/mail";

export const mailTransformHelper = (mails:Mail[], userId:string):MailDTO[]=>{
  return mails.flatMap(mail => {
        const receiver = mail.receiverIds.find(r => r._id === userId && r.isDeleted.status === false);
        if (!receiver) return [];
        return  {
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
