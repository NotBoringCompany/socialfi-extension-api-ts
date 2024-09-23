import { FoodType } from '../models/food';
import { Items, Mail, MailDTO, MailType, ReceiverStatus } from '../models/mail';
import { MailModel, UserModel } from '../utils/constants/db';
import { mailTransformHelper } from '../utils/mail';
import { ReturnValue, ReturnWithPagination, Status } from '../utils/retVal';
import { ClientSession } from 'mongoose';

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
  expiredDate?: number;
}

const createMail = async (
  { receivers, subject, body, items, type, expiredDate }: CreateMailParams,
  session?: ClientSession
): Promise<boolean> => {
  try {
    const newMail = new MailModel({
      receiverIds: receivers,
      subject,
      body,
      items,
      timestamp: Math.floor(Date.now() / 1000),
      type,
      expiredDate,
    });
    await newMail.save();
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
  type: MailType,
  expiredDate?: number
): Promise<ReturnValue> => {
  try {
    const users = await UserModel.find().lean();
    const receiverIds: ReceiverStatus[] = users.map((user) => {
      return {
        _id: user._id,
        isRead: { status: false, timestamp: Math.floor(Date.now() / 1000) },
        isClaimed: { status: false, timestamp: Math.floor(Date.now() / 1000) },
        isDeleted: { status: false, timestamp: Math.floor(Date.now() / 1000) },
      };
    });

    const isSuccess = await createMail({ receivers: receiverIds, subject, body, items, type, expiredDate });
    if (!isSuccess) {
      return {
        status: Status.ERROR,
        message: '(notifyUsers) Failed to add new mail to database',
      };
    }
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
  type: MailType,
  expiredDate?: number
): Promise<ReturnValue> => {
  /**
   * Map the receiver IDs to a ReceiverStatus array.
   * Each receiver status is initialized with default values.
   */
  const receiverList: ReceiverStatus[] = receivers.map((receiver) => ({
    _id: receiver,
    isRead: { status: false, timestamp: Math.floor(Date.now() / 1000) },
    isClaimed: { status: false, timestamp: Math.floor(Date.now() / 1000) },
    isDeleted: { status: false, timestamp: Math.floor(Date.now() / 1000) },
  }));

  try {
    await createMail({ receivers: receiverList, subject, body, items, type, expiredDate });
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

/**
 * Retrieves all mails sent to a specific user.
 * 
 * @param {string} userId - The ID of the user to retrieve mails for.
 * @returns {Promise<ReturnValue<Mail[]>>} A promise that resolves with the retrieved mails.
 * @example getAllMailsByUserId(userId): Promise<ReturnValue<Mail[]>> => {
 *  return {
 *    status: Status.SUCCESS,
 *    message: '(getAllMailsByUserId) Successfully retrieved mails',
 *    data: mails,
 *  }
 * }
 */
export const getAllMailsByUserId = async (userId: string): Promise<ReturnValue<MailDTO[]>> => {
  if (!userId) {
    return {
      status: Status.BAD_REQUEST,
      message: '(getAllMailsByUserId) Receiver ID is required',
    };
  }

  const isUserExists = await UserModel.exists({ _id: userId });
  if (!isUserExists) {
    return {
      status: Status.BAD_REQUEST,
      message: '(getAllMailsByUserId) User not found',
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
      receiverIds: {
        $elemMatch: { _id: userId }
      }
    }).lean();
   const transForm = mailTransformHelper(mails, userId);
    return {
      status: Status.SUCCESS,
      message: '(getAllMailsByReceiverId) Successfully retrieved mails',
      data: transForm,
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
        "receiverIds.$.isRead.timestamp": Math.floor(Date.now() / 1000),
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
        "receiverIds.$.isDeleted.timestamp": Math.floor(Date.now() / 1000),
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
        "receiverIds.$.isClaimed.status": true,
        "receiverIds.$.isClaimed.timestamp": Math.floor(Date.now() / 1000),
        "receiverIds.$.isRead.status": true,
        "receiverIds.$.isRead.timestamp": Math.floor(Date.now() / 1000),
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
 * Purges all expired mails.
 * 
 * @param {Date} currentDate - The current date.
 * @returns {Promise<void>} A promise that resolves when the mails are purged.
 */
export const purgeMails = async (currentDate: Date): Promise<void> => {
  try {
    await MailModel.deleteMany({ expiredDate: { $lt: currentDate } });
  } catch (err) {
    console.error(`(purgeMails) Error: ${err.message}`);
  }
};

/** 
 * get all email with pagination
 * Gets all emails for a specific user with pagination.
 * 
 * @param {string} userId
 * @param {number} page
 * @param {number} limit
 * @returns {Promise<ReturnWithPagination<Mail[]>>} A promise that resolves with the retrieved mails.
 * @example getAllMailsByUserId(userId, page, limit): Promise<MailPaginationDTO> => {
 *  return {
 *    status: Status.SUCCESS,
 *    message: '(getAllMailsByUserId) Successfully retrieved mails',
 *    data: mails,
 *    meta: {
 *      totalPage:20,
 *      pageSize: 5,
 *      currentPage: 1,
 *      totalDocument: 100
 *    }
 * }
 */
export const getAllMailsByUserIdWithPagination = async (userId: string, page: number, limit: number): Promise<ReturnWithPagination<MailDTO[]>> => {
  try {
    const totalMails = await MailModel.countDocuments({ receiverIds: { $elemMatch: { _id: userId } } });
    const totalDocument = Math.ceil(totalMails / limit);
    const totalPage = Math.ceil(totalDocument / limit);
    const pageSize = limit;
    const isHasNext = page < totalPage;

    const mails = await MailModel
      .find({
        receiverIds: { $elemMatch: { _id: userId } }
      })
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    const transForm = mailTransformHelper(mails, userId); 
    return {
      status: Status.SUCCESS,
      message: '(getAllMailsByUserIdWithPagination) Successfully retrieved mails',
      data: transForm,
      meta: {
        totalPage,
        pageSize,
        currentPage: page,
        totalItems: totalMails,
        isHasNext
      }
    };
  } catch (err: any) {
    return {
      status: Status.ERROR,
      message: `(getAllMailsByUserIdWithPagination) Error: ${err.message}`,
    };
  }
}

// const getmails = async () => {
//   const mails = await MailModel.find().lean();
//   console.log(mails);
// }

// // getmails().catch((err) => console.error(err)).then(() => console.log("done")).finally(() => process.exit(1))

// notifyUsers("rewards mail test", "Lorem ipsum dolor sit amet, consectetur adipiscing elit", [{
//   name: FoodType.BURGER,
//   quantity: 1
// }, {
//   name: FoodType.CANDY,
//   quantity: 1
// }], MailType.REWARDS, Math.floor(Date.now() / 1000)).catch((err) => console.error(err)).then(() => console.log("done")).finally(() => getmails().catch((err) => console.error(err)).then(() => console.log("done")).finally(() => process.exit(1)))