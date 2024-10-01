import { ClientSession } from 'mongoose';
import { MailAttachment, MailType } from '../models/mail';
import { MailModel, MailReceiverDataModel, UserModel } from '../utils/constants/db';
import { generateObjectId } from '../utils/crypto';
import { ReturnValue, Status } from '../utils/retVal';

/**
 * Creates a mail instance and saves it to the database.
 */
export const createMail = async (
  /** the type of mail */
  type: MailType,
  /** whether the mail is sent to all users or specific users */
  receivers: 'all' | 'specific',
  /** if this mail should be sent to newly registered users (before the mail expires) */
  includeNewUsers: boolean,
  /** the subject of the mail */
  subject: string,
  /** the body of the mail */
  body: string,
  /** the attachments of the mail */
  attachments: MailAttachment[],
  /**  when the mail expires (unless never) */
  expiryTimestamp: number | 'never',
  /** IF `receivers` is 'specific', this field is required */
  receiverIds?: string[],
  session?: ClientSession
): Promise<ReturnValue> => {
  try {
    const newMail = new MailModel({
      _id: generateObjectId(),
      mailType: type,
      receiverOptions: {
        receivers,
        includeNewUsers
      },
      subject,
      body,
      attachments,
      sentTimestamp: Math.floor(Date.now() / 1000),
      expiryTimestamp
    });

    await newMail.save();

    // if receivers is `all`, fetch all users and get their IDs. else, use the provided IDs
    const finalReceiverIds = 
      receivers === 'all' 
        ? (await UserModel.find().lean()).map((user) => user._id)
        : receiverIds;

    const mailReceiverData = finalReceiverIds.map(userId => ({
      userId,
      mailId: newMail._id,
      readStatus: { status: false, timestamp: 0 },
      claimedStatus: { status: false, timestamp: 0 },
      deletedStatus: { status: false, timestamp: 0 }
    }))

    await MailReceiverDataModel.insertMany(mailReceiverData);

    return {
      status: Status.SUCCESS,
      message: '(createMail) Successfully added new mail to database and sent to users in MailReceiverData.',
    }
  } catch (err: any) {
    return {
      status: Status.ERROR,
      message: `(createMail) Error: ${err.message}`,
    }
  }
}

// /**
//  * Notify all users with a new mail.
//  *
//  * @param {string} subject - The subject of the mail.
//  * @param {string} body - The body of the mail.
//  * @param {Attachment[]} items - The items attached to the mail.
//  * @param {MailType} type - The type of mail.
//  * @returns {Promise<ReturnValue>}
//  * @example notifyUsers(subject, body, items, type): Promise<ReturnValue> => {
//  *  return {
//  *    status: Status.SUCCESS,
//  *    message: "(notifyUsers) Successfully added new mail to database",
//  *  }
//  * }
//  */
// export const notifyUsers = async (
//   subject: string,
//   body: string,
//   items: Attachment[],
//   type: MailType,
//   expiredDate?: number
// ): Promise<ReturnValue> => {
//   try {
//     const users = await UserModel.find().lean();
//     const receiverIds: ReceiverStatus[] = users.map((user) => {
//       return {
//         _id: user._id,
//         isRead: { status: false, timestamp: Math.floor(Date.now() / 1000) },
//         isClaimed: { status: false, timestamp: Math.floor(Date.now() / 1000) },
//         isDeleted: { status: false, timestamp: Math.floor(Date.now() / 1000) },
//       };
//     });

//     const isSuccess = await createMail({ receivers: receiverIds, subject, body, attachments: items, type, expiredDate });
//     if (!isSuccess) {
//       return {
//         status: Status.ERROR,
//         message: '(notifyUsers) Failed to add new mail to database',
//       };
//     }
//     return {
//       status: Status.SUCCESS,
//       message: '(notifyUsers) Successfully added new mail to database',
//     };
//   } catch (err: any) {
//     return {
//       status: Status.ERROR,
//       message: `(notifyUsers) Error: ${err.message}`,
//     };
//   }
// };

// /**
//  * Notify specific users with a new mail.
//  *
//  * @param {string[]} receivers - The user IDs of the receivers.
//  * @param {string} subject - The subject of the mail.
//  * @param {string} body - The body of the mail.
//  * @param {Attachment[]} items - The items attached to the mail.
//  * @param {MailType} type - The type of mail.
//  * @returns {Promise<ReturnValue>}
//  * @example 
//  * const receivers = ["userId1", "userId2"];
//  * notifySpecificUser(receivers, subject, body, items, type): Promise<ReturnValue> => {
//  *  return {
//  *    status: Status.SUCCESS,
//  *    message: "(notifySpecificUser) Successfully added new mail to database",
//  *  }
//  * }
//  */
// export const notifySpecificUser = async (
//   receivers: string[],
//   subject: string,
//   body: string,
//   items: Attachment[],
//   type: MailType,
//   expiredDate?: number
// ): Promise<ReturnValue> => {
//   /**
//    * Map the receiver IDs to a ReceiverStatus array.
//    * Each receiver status is initialized with default values.
//    */
//   const receiverList: ReceiverStatus[] = receivers.map((receiver) => ({
//     _id: receiver,
//     isRead: { status: false, timestamp: Math.floor(Date.now() / 1000) },
//     isClaimed: { status: false, timestamp: Math.floor(Date.now() / 1000) },
//     isDeleted: { status: false, timestamp: Math.floor(Date.now() / 1000) },
//   }));

//   try {
//     await createMail({ receivers: receiverList, subject, body, attachments: items, type, expiredDate });
//     return {
//       status: Status.SUCCESS,
//       message: '(notifySpecificUser) Successfully added new mail to database',
//     };
//   } catch (err: any) {
//     return {
//       status: Status.ERROR,
//       message: `(notifySpecificUser) Error: ${err.message}`,
//     };
//   }
// };

// /**
//  * Retrieves all mails sent to a specific user.
//  * 
//  * @param {string} userId - The ID of the user to retrieve mails for.
//  * @returns {Promise<ReturnValue<Mail[]>>} A promise that resolves with the retrieved mails.
//  * @example getAllMailsByUserId(userId): Promise<ReturnValue<Mail[]>> => {
//  *  return {
//  *    status: Status.SUCCESS,
//  *    message: '(getAllMailsByUserId) Successfully retrieved mails',
//  *    data: mails,
//  *  }
//  * }
//  */
// export const getAllMailsByUserId = async (userId: string): Promise<ReturnValue<MailDTO[]>> => {
//   if (!userId) {
//     return {
//       status: Status.BAD_REQUEST,
//       message: '(getAllMailsByUserId) Receiver ID is required',
//     };
//   }

//   const isUserExists = await UserModel.exists({ _id: userId });
//   if (!isUserExists) {
//     return {
//       status: Status.BAD_REQUEST,
//       message: '(getAllMailsByUserId) User not found',
//     };
//   }

//   try {
//     /**
//      * This query retrieves all mail where the receiverId field matches the userId in the query.
//      * The receiverId field is an array of objects containing the receiver's ID and other metadata.
//      * The $elemMatch operator is used to match the first element of the array that matches the userId.
//      * The isDeleted field is also filtered to only include mails that are not deleted.
//      * 
//      * @see https://docs.mongodb.com/manual/reference/operator/query/elemMatch/
//      */
//     const mails = await MailModel.find({
//       receiverIds: {
//         $elemMatch: { _id: userId }
//       }
//     }).lean();
//     const transForm = mailTransformHelper(mails, userId);
//     return {
//       status: Status.SUCCESS,
//       message: '(getAllMailsByReceiverId) Successfully retrieved mails',
//       data: transForm,
//     };
//   } catch (err: any) {
//     return {
//       status: Status.ERROR,
//       message: `(getAllMailsByReceiverId) Error: ${err.message}`,
//     };
//   }
// };

// /**
//  * Retrieves a mail by its ID.
//  * 
//  * @param {string} mailId - The ID of the mail to retrieve.
//  * @returns {Promise<ReturnValue<Mail>>} A promise that resolves with the retrieved mail.
//  */
// export const getEmailById = async (mailId: string): Promise<ReturnValue<Mail>> => {
//   try {
//     const mail = await MailModel.findOne({ _id: mailId }).lean();
//     return {
//       status: Status.SUCCESS,
//       message: '(getEmailById) Successfully retrieved mail',
//       data: mail,
//     };
//   } catch (err: any) {
//     return {
//       status: Status.ERROR,
//       message: `(getEmailById) Error: ${err.message}`,
//     };
//   }
// };

// /**
//  * @deprecated use readMail, claimMail, or deleteMail instead
//  * Updates the status of a mail for a specific user.
//  * 
//  * @param {string} mailId - The ID of the mail to update.
//  * @param {string} userId - The ID of the user to update the mail status for.
//  * @param {('isRead' | 'isClaimed' | 'isDeleted')} mailStatusType - The type of status to update.
//  * @param {{ status: boolean, timestamp: Date }} status - The new status of the mail.
//  * @returns {Promise<ReturnValue>} A promise that resolves with the updated mail status.
//  * @example updateMailStatus(mailId, userId, mailStatusType, status): Promise<ReturnValue> => {
//  *  return {
//  *    status: Status.SUCCESS,
//  *    message: '(updateMailStatus) Successfully updated mail status',
//  *  }
//  }
//  */
// export const updateMailStatus = async (mailId: string, userId: string, mailStatusType: 'isRead' | 'isClaimed' | 'isDeleted', status: { status: boolean, timestamp: number }): Promise<ReturnValue> => {
//   try {
//     // Handle Claiming Function
//     if (mailStatusType === 'isClaimed') {
//       const userUpdateOperations = {
//         $pull: {},
//         $inc: {},
//         $set: {},
//         $push: {}
//       };

//       const user = await UserModel.findOne({ _id: userId }).lean();
//       if (!user) {
//         console.error(`(updateMailStatus) mailStatusType: ${mailStatusType}, user not found!`);
//         return {
//           status: Status.ERROR,
//           message: `(updateMailStatus) mailStatusType: ${mailStatusType}, user not found!`
//         }
//       }

//       const mail = await MailModel.findOne({ _id: mailId }).lean();
//       if (!mail) {
//         console.error(`(updateMailStatus) mailStatusType: ${mailStatusType}, mail with id ${mailId} not found!`);
//         return {
//           status: Status.ERROR,
//           message: `(updateMailStatus) mailStatusType: ${mailStatusType}, mail with id ${mailId} not found!`
//         }
//       }

//       if (mail.attachments.length > 0) {
//         // Destructure user Inventory data
//         const { foods, items } = user.inventory as UserInventory;
//         mail.attachments.forEach((attachment) => {
//           if (attachment.type === 'food') {
//             // add the food to the user's inventory
//             const existingFoodIndex = foods.findIndex(f => f.type === attachment.name);

//             if (existingFoodIndex !== -1) {
//               userUpdateOperations.$inc[`inventory.foods.${existingFoodIndex}.amount`] = attachment.amount;
//             } else {
//               userUpdateOperations.$push['inventory.foods'] = { type: attachment.name, amount: attachment.amount };
//             }
//           } else if (attachment.type === 'item') {
//             // add the item to the user's inventory
//             const existingItemIndex = items.findIndex(i => i.type === attachment.name);

//             if (existingItemIndex !== -1) {
//               userUpdateOperations.$inc[`inventory.items.${existingItemIndex}.amount`] = attachment.amount;
//             } else {
//               userUpdateOperations.$push['inventory.items'] = {
//                 type: attachment.name,
//                 amount: attachment.amount,
//                 totalAmountConsumed: 0,
//                 weeklyAmountConsumed: 0
//               };
//             }
//           }
//         });

//         // First, increment the amounts of existing items/foods
//         await UserModel.updateOne({ _id: userId }, {
//           $inc: userUpdateOperations.$inc
//         });

//         // Then, push new items/foods to the array
//         await UserModel.updateOne({ _id: userId }, {
//           $push: userUpdateOperations.$push
//         });
//       } else {
//         console.log(`(updateMailStatus) mail with id ${mailId} has no attachments to be claimed!`);
//         return {
//           status: Status.SUCCESS,
//           message: `(updateMailStatus) mail with id ${mailId} has no rewards to claim.`,
//         };
//       }
//     }

//     await MailModel.updateOne({
//       _id: mailId, 
//       receiverIds: { $elemMatch: { _id: userId } } 
//     }, {
//       $set: {
//         [`receiverIds.$.${mailStatusType}.status`]: status.status,
//         [`receiverIds.$.${mailStatusType}.timestamp`]: status.timestamp,
//       }
//     })
//   } catch (err: any) {
//     return {
//       status: Status.ERROR,
//       message: `(updateMailStatus) Error: ${err.message}`,
//     };
//   }
// }
// // update mail isRead status in receiverIds
// export const readMail = async (mailId: string, userId: string): Promise<ReturnValue> => {
//   try {
//     const isUserExists = await UserModel.exists({ _id: userId });
//     if (!isUserExists) {
//       return {
//         status: Status.ERROR,
//         message: `(readMail) user with id ${userId} not found!`
//       }
//     }

//     const mail = await MailModel.findOne({ _id: mailId }).lean();
//     if (!mail) {
//       return {
//         status: Status.ERROR,
//         message: `(readMail) mail with id ${mailId} not found!`
//       }
//     }
//     const userHasRead = mail.receiverIds.find((receiver) => receiver._id === userId).isRead.status;
//     // in this case, the user has already read the mail
//     // avoid updating the isRead status
//     if (userHasRead) {
//       return {
//         status: Status.SUCCESS,
//         message: `(readMail) Successfully updated mail status`
//       }
//     }
//     await MailModel.updateOne({
//       _id: mailId, 
//       receiverIds: { $elemMatch: { _id: userId } } 
//     }, {
//       $set: {
//         "receiverIds.$.isRead.status": true,
//         "receiverIds.$.isRead.timestamp": Math.floor(Date.now() / 1000),
//       }
//     })

//     return {
//       status: Status.SUCCESS,
//       message: `(readMail) Successfully updated mail status`,
//     }
//   } catch (err: any) {
//     return {
//       status: Status.ERROR,
//       message: `(readMail) Error: ${err.message}`,
//     };
//   }
// }

// // update mail isDeleted status in receiverIds
// export const deleteMail = async (mailId: string, userId: string): Promise<ReturnValue> => {
//   try {
//     const mail = await MailModel.findOne({ _id: mailId }).lean();
//     if (!mail) {
//       return {
//         status: Status.ERROR,
//         message: `(deleteMail) mail with id ${mailId} not found!`
//       }
//     }
//     const userMailStatus = mail.receiverIds.find((receiver) => receiver._id === userId);
//     // user not found
//     if (!userMailStatus) {
//       return {
//         status: Status.ERROR,
//         // this message is look like user have one email for one user
//         message: `(deleteMail) Error: email not found with id ${mailId}!`
//       }
//     }
//     // user already deleted the mail
//     if (userMailStatus.isDeleted.status) {
//       return {
//         status: Status.ERROR,
//         message: `(deleteMail) Error: mail with id ${mailId} already deleted!`
//       }
//     }
//     // user didn't claim rewards
//     if (!userMailStatus.isClaimed.status && mail.attachments.length > 0) {
//       return {
//         status: Status.ERROR,
//         message: `(deleteMail) user didn't claim rewards inside mail with id ${mailId}!`
//       }
//     }

//     await MailModel.updateOne({
//       _id: mailId, 
//       receiverIds: { $elemMatch: { _id: userId } } 
//     }, {
//       $set: {
//         "receiverIds.$.isDeleted.status": true,
//         "receiverIds.$.isDeleted.timestamp": Math.floor(Date.now() / 1000),
//       }
//     })
//     return {
//       status: Status.SUCCESS,
//       message: `(deleteMail) Successfully updated mail status`,
//     }
//   } catch (err: any) {
//     return {
//       status: Status.ERROR,
//       message: `(deleteMail) Error: ${err.message}`,
//     };
//   }
// }

// // update mail Claim status in receiverIds
// export const claimMail = async (mailId: string, userId: string): Promise<ReturnValue> => {
//   try {

//     const userUpdateOperations = {
//       $pull: {},
//       $inc: {},
//       $set: {},
//       $push: {}
//     };

//     const user = await UserModel.findOne({ _id: userId }).lean();
//     if (!user) {
//       console.error(`(claimMail) user not found!`);
//       return {
//         status: Status.ERROR,
//         message: `(claimMail) user not found!`
//       }
//     }

//     const mail = await MailModel.findOne({ _id: mailId }).lean();
//     if (!mail) {
//       console.error(`(claimMail) mail with id ${mailId} not found!`);
//       return {
//         status: Status.ERROR,
//         message: `(claimMail) mail with id ${mailId} not found!`
//       }
//     }

//     const userHasClaimed = mail.receiverIds.find((receiver) => receiver._id === userId).isClaimed.status;
//     if (userHasClaimed) {
//       console.error(`(claimMail) user already claimed mail with id ${mailId}`);
//       return {
//         status: Status.ERROR,
//         message: `(claimMail) user already claimed mail with id ${mailId}`
//       }
//     }

//     if (mail.attachments.length > 0) {
//       // Destructure user Inventory data
//       const { foods, items } = user.inventory as UserInventory;
//       mail.attachments.forEach((attachment) => {
//         if (attachment.type === 'food') {
//           // add the food to the user's inventory
//           const existingFoodIndex = foods.findIndex(f => f.type === attachment.name);

//           if (existingFoodIndex !== -1) {
//             userUpdateOperations.$inc[`inventory.foods.${existingFoodIndex}.amount`] = attachment.amount;
//           } else {
//             userUpdateOperations.$push['inventory.foods'] = { type: attachment.name, amount: attachment.amount };
//           }
//         } else if (attachment.type === 'item') {
//           // add the item to the user's inventory
//           const existingItemIndex = items.findIndex(i => i.type === attachment.name);

//           if (existingItemIndex !== -1) {
//             userUpdateOperations.$inc[`inventory.items.${existingItemIndex}.amount`] = attachment.amount;
//           } else {
//             userUpdateOperations.$push['inventory.items'] = {
//               type: attachment.name,
//               amount: attachment.amount,
//               totalAmountConsumed: 0,
//               weeklyAmountConsumed: 0
//             };
//           }
//         }
//       });

//       // First, increment the amounts of existing items/foods
//       await UserModel.updateOne({ _id: userId }, {
//         $inc: userUpdateOperations.$inc
//       });

//       // Then, push new items/foods to the array
//       await UserModel.updateOne({ _id: userId }, {
//         $push: userUpdateOperations.$push
//       });

//       await MailModel.updateOne({ 
//         _id: mailId, 
//         receiverIds: { $elemMatch: { _id: userId } } 
//       }, {
//         $set: {
//           "receiverIds.$.isClaimed.status": true,
//           "receiverIds.$.isClaimed.timestamp": Math.floor(Date.now() / 1000),
//         }
//       })

//       return {
//         status: Status.SUCCESS,
//         message: `(claimMail) Successfully claimed mail`,
//       }

//     } else {
//       console.log(`(updateMailStatus) mail with id ${mailId} has no attachments to be claimed!`);
//       return {
//         status: Status.SUCCESS,
//         message: `(updateMailStatus) mail with id ${mailId} has no rewards to claim.`,
//       };
//     }

//   } catch (err: any) {
//     return {
//       status: Status.ERROR,
//       message: `(claimMail) Error: ${err.message}`,
//     };
//   }
// }

// /**
//  * Sets all mail for a specific user to read.
//  * 
//  * @param {string} userId - The ID of the user to set all mail to read for.
//  * @returns {Promise<ReturnValue>} A promise that resolves with the updated mail status.
//  * @example readAllMails(userId): Promise<ReturnValue> => {
//  *  return {
//  *    status: Status.SUCCESS,
//  *    message: '(readAllMails) Successfully set all mail to read',
//  *  }
//  * }
//  */
// export const readAllMails = async (userId: string): Promise<ReturnValue> => {
//   try {
//     await MailModel.updateMany({
//       receiverIds: {
//         $elemMatch: { _id: userId }
//       }
//     }, {
//       $set: {
//         "receiverIds.$.isRead.status": true,
//         "receiverIds.$.isRead.timestamp": Math.floor(Date.now() / 1000),
//       }
//     })
//   } catch (err: any) {
//     return {
//       status: Status.ERROR,
//       message: `(readAllMails) Error: ${err.message}`,
//     };
//   }
// }

// /**
//  * Sets all mail for a specific user to deleted.
//  * 
//  * @param {string} userId - The ID of the user to set all mail to deleted for.
//  * @returns {Promise<ReturnValue>} A promise that resolves with the updated mail status.
//  * @example deletedAllMails(userId): Promise<ReturnValue> => {
//  *  return {
//  *    status: Status.SUCCESS,
//  *    message: '(deletedAllMails) Successfully set all mail to deleted',
//  *  }
//  * }
//  */
// export const deletedAllMails = async (userId: string): Promise<ReturnValue> => {
//   try {
//     await MailModel.updateMany({
//       receiverIds: {
//         $elemMatch: { _id: userId }
//       }
//     }, {
//       $set: {
//         "receiverIds.$.isDeleted.status": true,
//         "receiverIds.$.isDeleted.timestamp": Math.floor(Date.now() / 1000),
//       }
//     })
//   } catch (err: any) {
//     return {
//       status: Status.ERROR,
//       message: `(deletedAllMails) Error: ${err.message}`,
//     };
//   }
// }

// /**
//  * Claims all mail for a specific user.
//  * 
//  * @param {string} userId - The ID of the user to claim all mail for.
//  * @returns {Promise<ReturnValue>} A promise that resolves with the updated mail status.
//  * @example claimAllMails(userId): Promise<ReturnValue> => {
//  *  return {
//  *    status: Status.SUCCESS,
//  *    message: '(claimAllMails) Successfully claimed all mail',
//  *  }
//  * }
//  */
// export const claimAllMails = async (userId: string): Promise<ReturnValue> => {
//   try {
//     // todo need send the user items
//     await MailModel.updateMany({
//       receiverIds: {
//         $elemMatch: { _id: userId }
//       }
//     }, {
//       // when user claim the mail, we also update the read state to true, so that the user no needs to update the mail again.
//       $set: {
//         "receiverIds.$.isClaimed.status": true,
//         "receiverIds.$.isClaimed.timestamp": Math.floor(Date.now() / 1000),
//         "receiverIds.$.isRead.status": true,
//         "receiverIds.$.isRead.timestamp": Math.floor(Date.now() / 1000),
//       }
//     })
//   } catch (err: any) {
//     return {
//       status: Status.ERROR,
//       message: `(claimAllMails) Error: ${err.message}`,
//     };
//   }
// }
// /**
//  * Purges all expired mails.
//  * 
//  * @param {number} currentDate - The current date.
//  * @returns {Promise<void>} A promise that resolves when the mails are purged.
//  */
// export const purgeMails = async (currentDate: number): Promise<void> => {
//   try {
//     await MailModel.deleteMany({ expiredDate: { $lt: currentDate } });
//   } catch (err) {
//     console.error(`(purgeMails) Error: ${err.message}`);
//   }
// };

// /** 
//  * get all email with pagination
//  * Gets all emails for a specific user with pagination.
//  * 
//  * @param {string} userId
//  * @param {number} page
//  * @param {number} limit
//  * @returns {Promise<ReturnWithPagination<Mail[]>>} A promise that resolves with the retrieved mails.
//  * @example getAllMailsByUserId(userId, page, limit): Promise<MailPaginationDTO> => {
//  *  return {
//  *    status: Status.SUCCESS,
//  *    message: '(getAllMailsByUserId) Successfully retrieved mails',
//  *    data: mails,
//  *    meta: {
//  *      totalPage:20,
//  *      pageSize: 5,
//  *      currentPage: 1,
//  *      totalDocument: 100
//  *    }
//  * }
//  */
// export const getAllMailsByUserIdWithPagination = async (userId: string, page: number, limit: number): Promise<ReturnWithPagination<MailDTO[]>> => {
//   try {
//     // get total mails whose related with the user
//     const totalMails = await MailModel.countDocuments({ receiverIds: { $elemMatch: { _id: userId } } });
//    /**
//     * totalMail = 100
//     * limit = 5
//     * totalPage = totalMail / limit = 20
//     * now we we have 20 pages and 5 mails per page
//     */
//     const totalPage = Math.ceil(totalMails / limit);
//     const pageSize = limit;
//     const isHasNext = page < totalPage;

//     console.log(`(getAllMailsByUserIdWithPagination) totalMails: ${totalMails}, totalPage: ${totalPage}, pageSize: ${pageSize}, currentPage: ${page}, isHasNext: ${isHasNext}`);

//     const mails = await MailModel
//       .find({
//         receiverIds: { $elemMatch: { _id: userId } }
//       })
//       // the latest mail first
//       .sort({ timestamp: -1 })
//       // skip the previous page's documents
//       // example: if page = 2 and limit = 5, we will skip the first 5 documents
//       // then we will get the next 5 documents which is the second page
//       .skip((page - 1) * limit)
//       .limit(limit)
//       .lean();
//     const transForm = mailTransformHelper(mails, userId);
//     return {
//       status: Status.SUCCESS,
//       message: '(getAllMailsByUserIdWithPagination) Successfully retrieved mails',
//       data: transForm,
//       meta: {
//         totalPage,
//         pageSize,
//         currentPage: page,
//         totalItems: totalMails,
//         isHasNext
//       }
//     };
//   } catch (err: any) {
//     return {
//       status: Status.ERROR,
//       message: `(getAllMailsByUserIdWithPagination) Error: ${err.message}`,
//     };
//   }
// }

// /**
//  * Purges all expired mails.
//  * 
//  * @param {number} currentDate - The current date.
//  * @returns {Promise<void>} A promise that resolves when the mails are purged.
//  * @example purgeExpiredMails(currentDate): Promise<void> => {
//  * //if expired date is less than current date, delete the mail
//  *    await MailModel.deleteMany({ expiredDate: { $lt: currentDate } });
//  * }
//  */
// export const purgeExpiredMails = async (currentDate: number): Promise<void> => {
//   try {
//     // if expired date is less than current date, delete the mail
//     await MailModel.deleteMany({ expiredDate: { $lt: currentDate } });
//   } catch (err) {
//     console.error(`(purgeExpiredMails) Error: ${err.message}`);
//   }
// }

// // const getmails = async () => {
// //   const mails = await MailModel.find().lean();
// //   console.log(mails);
// // }

// // // getmails().catch((err) => console.error(err)).then(() => console.log("done")).finally(() => process.exit(1))

// // notifyUsers("rewards mail test", "Lorem ipsum dolor sit amet, consectetur adipiscing elit", [{
// //   name: FoodType.BURGER,
// //   quantity: 1
// // }, {
// //   name: FoodType.CANDY,
// //   quantity: 1
// // }], MailType.REWARDS, Math.floor(Date.now() / 1000)).catch((err) => console.error(err)).then(() => console.log("done")).finally(() => getmails().catch((err) => console.error(err)).then(() => console.log("done")).finally(() => process.exit(1)))