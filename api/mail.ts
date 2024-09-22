import { Items, Mail, MailType, ReceiverStatus } from '../models/mail';
import { MailModel, UserModel } from '../utils/constants/db';
import { ReturnValue, Status } from '../utils/retVal';
import { ClientSession, startSession } from 'mongoose';

interface CreateMailParams {
  /**
   * The list of receivers of the mail.
   * Each receiver is represented by an object with the following properties:
   * - `_id`: the ID of the receiver user
   * - `isRead`: whether the mail has been read by the receiver
   * - `isClaimed`: whether the mail has been claimed by the receiver
   * - `isDeleted`: whether the mail has been deleted by the receiver
   */
  receivers: ReceiverStatus[];
  /**
   * The subject of the mail
   */
  subject: string;
  /**
   * The body of the mail
   */
  body: string;
  /**
   * The items attached to the mail
   */
  items: Items[];
  /**
   * The type of mail
   */
  type: MailType;
}

const createMail = async (
  { receivers, subject, body, items, type }: CreateMailParams,
  session?: ClientSession
): Promise<boolean> => {
  try {
    const newMail = new MailModel({
      receiverIds: receivers,
      subject,
      body,
      items,
      isRead: false,
      timestamp: new Date(),
      type: MailType[type],
    });
    await newMail.save({ session });
    return true;
  } catch (err: any) {
    return false;
  }
};

/**
 * Notify all users with a new mail.
 *
 * @param {string} subject - The subject of the mail.
 * @param {string} body - The body of the mail.
 * @param {Items[]} items - The items attached to the mail.
 * @param {MailType} type - The type of mail.
 * @returns {Promise<ReturnValue>}
 * @example notifyUsers(subject, body, items, type): Promise<ReturnValue> => {
 *  return {
 *    status: Status.SUCCESS,
 *    message: "(notifyUsers) Successfully added new mail to database",
 *  }
 * }
 */
export const notifyUsers = async (
  subject: string,
  body: string,
  items: Items[],
  type: MailType
): Promise<ReturnValue> => {
  try {
    const users = await UserModel.find().lean();
    const receiverIds: ReceiverStatus[] = users.map((user) => {
      return {
        _id: user._id,
        isRead: { status: false, timestamp: new Date() },
        isClaimed: { status: false, timestamp: new Date() },
        isDeleted: { status: false, timestamp: new Date() },
      };
    });

    await createMail({ receivers: receiverIds, subject, body, items, type });
    return {
      status: Status.SUCCESS,
      message: '(notifyUsers) Successfully added new mail to database',
    };
  } catch (err: any) {
    return {
      status: Status.ERROR,
      message: `(notifyUsers) Error: ${err.message}`,
    };
  }
};

/**
 * Notify specific users with a new mail.
 *
 * @param {string[]} receivers - The user IDs of the receivers.
 * @param {string} subject - The subject of the mail.
 * @param {string} body - The body of the mail.
 * @param {Items[]} items - The items attached to the mail.
 * @param {MailType} type - The type of mail.
 * @returns {Promise<ReturnValue>}
 * @example 
 * const receivers = ["userId1", "userId2"];
 * notifySpecificUser(receivers, subject, body, items, type): Promise<ReturnValue> => {
 *  return {
 *    status: Status.SUCCESS,
 *    message: "(notifySpecificUser) Successfully added new mail to database",
 *  }
 * }
 */
export const notifySpecificUser = async (
  receivers: string[],
  subject: string,
  body: string,
  items: Items[],
  type: MailType
): Promise<ReturnValue> => {
  /**
   * Map the receiver IDs to a ReceiverStatus array.
   * Each receiver status is initialized with default values.
   */
  const receiverList: ReceiverStatus[] = receivers.map((receiver) => ({
    _id: receiver,
    isRead: { status: false, timestamp: new Date() },
    isClaimed: { status: false, timestamp: new Date() },
    isDeleted: { status: false, timestamp: new Date() },
  }));

  try {
    await createMail({ receivers: receiverList, subject, body, items, type });
    return {
      status: Status.SUCCESS,
      message: '(notifySpecificUser) Successfully added new mail to database',
    };
  } catch (err: any) {
    return {
      status: Status.ERROR,
      message: `(notifySpecificUser) Error: ${err.message}`,
    };
  }
};

export const getAllMailsByUserId = async (userId: string): Promise<ReturnValue<Mail[]>> => {
  /**
   * Retrieves all mail by a specific user ID.
   * 
   * @param {string} userId - The ID of the user.
   * @returns {Promise<ReturnValue<Mail[]>>} - A promise with a ReturnValue object which contains an array of mail objects.
   * @example getAllMailsByUserId(userId): Promise<ReturnValue<Mail[]>> => {
   *  return {
   *    status: Status.SUCCESS,
   *    message: '(getAllMailsByReceiverId) Successfully retrieved mails',
   *    data: [Mail]
   *  }
   * }
   */
  if (!userId) {
    return {
      status: Status.BAD_REQUEST,
      message: '(getAllMailsByUserId) Receiver ID is required',
    };
  }

  try {
    /**
     * This query retrieves all mail where the receiverId field matches the userId in the query.
     * The receiverId field is an array of objects containing the receiver's ID and other metadata.
     * The $elemMatch operator is used to match the first element of the array that matches the userId.
     * The isDeleted field is also filtered to only include mails that are not deleted.
     * 
     * @see https://docs.mongodb.com/manual/reference/operator/query/elemMatch/
     */
    const mails = await MailModel.find({
      receiverId: {
        $elemMatch: { _id: userId, isDeleted: { status: false } }
      }
    }).lean();
    return {
      status: Status.SUCCESS,
      message: '(getAllMailsByReceiverId) Successfully retrieved mails',
      data: mails,
    };
  } catch (err: any) {
    return {
      status: Status.ERROR,
      message: `(getAllMailsByReceiverId) Error: ${err.message}`,
    };
  }
};

/**
 * Retrieves a mail by its ID.
 * 
 * @param {string} mailId - The ID of the mail to retrieve.
 * @returns {Promise<ReturnValue<Mail>>} A promise that resolves with the retrieved mail.
 */
export const getEmailById = async (mailId: string): Promise<ReturnValue<Mail>> => {
  try {
    const mail = await MailModel.findOne({ _id: mailId }).lean();
    return {
      status: Status.SUCCESS,
      message: '(getEmailById) Successfully retrieved mail',
      data: mail,
    };
  } catch (err: any) {
    return {
      status: Status.ERROR,
      message: `(getEmailById) Error: ${err.message}`,
    };
  }
};

/**
 * Updates the status of a mail for a specific user.
 * 
 * @param {string} mailId - The ID of the mail to update.
 * @param {string} userId - The ID of the user to update the mail status for.
 * @param {('isRead' | 'isClaimed' | 'isDeleted')} mailStatusType - The type of status to update.
 * @param {{ status: boolean, timestamp: Date }} status - The new status of the mail.
 * @returns {Promise<ReturnValue>} A promise that resolves with the updated mail status.
 * @example updateMailStatus(mailId, userId, mailStatusType, status): Promise<ReturnValue> => {
 *  return {
 *    status: Status.SUCCESS,
 *    message: '(updateMailStatus) Successfully updated mail status',
 *  }
 }
 */
export const updateMailStatus = async (mailId: string, userId: string, mailStatusType: 'isRead' | 'isClaimed' | 'isDeleted', status: { status: boolean, timestamp: Date }): Promise<ReturnValue> => {
  try {
    await MailModel.updateOne({
      _id: mailId,
      "receiverIds._id": userId
    }, {
      $set: {
        [`receiverIds.$.${mailStatusType}`]: status.status,
        [`receiverIds.$.${mailStatusType}.timestamp`]: status.timestamp,
      }
    })
  } catch (err: any) {
    return {
      status: Status.ERROR,
      message: `(updateMailStatus) Error: ${err.message}`,
    };
  }
}

/**
 * Sets all mail for a specific user to read.
 * 
 * @param {string} userId - The ID of the user to set all mail to read for.
 * @returns {Promise<ReturnValue>} A promise that resolves with the updated mail status.
 * @example readAllMails(userId): Promise<ReturnValue> => {
 *  return {
 *    status: Status.SUCCESS,
 *    message: '(readAllMails) Successfully set all mail to read',
 *  }
 * }
 */
export const readAllMails = async (userId: string): Promise<ReturnValue> => {
  try {
    await MailModel.updateMany({
      receiverIds: {
        $elemMatch: { _id: userId }
      }
    }, {
      $set: {
        "receiverIds.$.isRead": true,
        "receiverIds.$.isRead.timestamp": new Date(),
      }
    })
  } catch (err: any) {
    return {
      status: Status.ERROR,
      message: `(readAllMails) Error: ${err.message}`,
    };
  }
}

/**
 * Sets all mail for a specific user to deleted.
 * 
 * @param {string} userId - The ID of the user to set all mail to deleted for.
 * @returns {Promise<ReturnValue>} A promise that resolves with the updated mail status.
 * @example deletedAllMails(userId): Promise<ReturnValue> => {
 *  return {
 *    status: Status.SUCCESS,
 *    message: '(deletedAllMails) Successfully set all mail to deleted',
 *  }
 * }
 */
export const deletedAllMails = async (userId: string): Promise<ReturnValue> => {
  try {
    await MailModel.updateMany({
      receiverIds: {
        $elemMatch: { _id: userId }
      }
    }, {
      $set: {
        "receiverIds.$.isDeleted": true,
        "receiverIds.$.isDeleted.timestamp": new Date(),
      }
    })
  } catch (err: any) {
    return {
      status: Status.ERROR,
      message: `(deletedAllMails) Error: ${err.message}`,
    };
  }
}

/**
 * Claims all mail for a specific user.
 * 
 * @param {string} userId - The ID of the user to claim all mail for.
 * @returns {Promise<ReturnValue>} A promise that resolves with the updated mail status.
 * @example claimAllMails(userId): Promise<ReturnValue> => {
 *  return {
 *    status: Status.SUCCESS,
 *    message: '(claimAllMails) Successfully claimed all mail',
 *  }
 * }
 */
export const claimAllMails = async (userId: string): Promise<ReturnValue> => {
  try {
    // todo need send the user items
    await MailModel.updateMany({
      receiverIds: {
        $elemMatch: { _id: userId }
      }
    }, {
      // when user claim the mail, we also update the read state to true, so that the user no needs to update the mail again.
      $set: {
        "receiverIds.$.isClaimed": true,
        "receiverIds.$.isClaimed.timestamp": new Date(),
        "receiverIds.$.isRead": true,
        "receiverIds.$.isRead.timestamp": new Date(),
      }
    })
  } catch (err: any) {
    return {
      status: Status.ERROR,
      message: `(claimAllMails) Error: ${err.message}`,
    };
  }
}
/**
 * Todo purge all mails should be automated
 * update models timestamp startdate and enddate
 * and delete all mails between those dates using cronjob
 */
export const purgeMails = async () => { }