import { ClientSession } from 'mongoose';
import { MailAttachment, MailDTO, MailType } from '../models/mail';
import { MailModel, MailReceiverDataModel, UserModel } from '../utils/constants/db';
import { generateObjectId } from '../utils/crypto';
import { ReturnValue, Status } from '../utils/retVal';
import { Food } from '../models/food';
import { Item } from '../models/item';
import { resources } from '../utils/constants/resource';
import { ExtendedResource, ExtendedResourceOrigin } from '../models/resource';

/**
 * Creates a mail instance and saves it to the database.
 * 
 * Also sends the mail to the users and stores them in the `MailReceiverData` collection.
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

/**
 * Retrieves all mails sent to a specific user.
 * 
 * We don't worry about limiting size because most mails will be deleted eventually.
 */
export const getAllUserMails = async (userId: string): Promise<ReturnValue> => {
  try {
    const mailReceiverData = await MailReceiverDataModel.find({ userId }).lean();

    // fetch the mails using the mail IDs
    const mailIds = mailReceiverData.map(mail => mail.mailId);

    const mails = await MailModel.find({ _id: { $in: mailIds } }).lean();

    const mailDTOs: MailDTO[] = mails.map(mail => ({
      _id: mail._id,
      mailType: mail.mailType,
      receiverOptions: mail.receiverOptions,
      subject: mail.subject,
      body: mail.body,
      attachments: mail.attachments,
      sentTimestamp: mail.sentTimestamp,
      expiryTimestamp: mail.expiryTimestamp,
      readStatus: mailReceiverData.find(data => data.mailId === mail._id)?.readStatus,
      claimedStatus: mailReceiverData.find(data => data.mailId === mail._id)?.claimedStatus,
      deletedStatus: mailReceiverData.find(data => data.mailId === mail._id)?.deletedStatus
    }));

    return {
      status: Status.SUCCESS,
      message: '(getAllUserMails) Successfully retrieved mails.',
      data: {
        mailDTOs
      }
    }
  } catch (err: any) {
    return {
      status: Status.ERROR,
      message: `(getAllUserMails) Error: ${err.message}`,
    }
  }
}

/**
 * Deletes a mail for a specific user.
 * 
 * NOTE: This doesn't notify the users to claim any existing rewards (in attachments) in the mail if they haven't already.
 */
export const deleteMail = async (mailId: string, userId: string): Promise<ReturnValue> => {
  try {
    const mail = await MailReceiverDataModel.findOne({ mailId, userId }).lean();

    if (!mail) {
      return {
        status: Status.ERROR,
        message: `(deleteMail) Mail ID ${mailId} not found for user with ID ${userId}`,
      }
    }

    // if the mail is already deleted, return an error
    if (mail.deletedStatus.status) {
      return {
        status: Status.ERROR,
        message: `(deleteMail) Mail ID ${mailId} already deleted for user with ID ${userId}`,
      }
    }

    // instead of deleting the data from the database, we just mark it as deleted.
    // the mail will be purged eventually.
    await MailReceiverDataModel.updateOne({ mailId, userId }, {
      $set: {
        'deletedStatus.status': true,
        'deletedStatus.timestamp': Math.floor(Date.now() / 1000)
      }
    });

    return {
      status: Status.SUCCESS,
      message: '(deleteMail) Successfully marked mail as deleted.',
    }
  } catch (err: any) {
    return {
      status: Status.ERROR,
      message: `(deleteMail) Error: ${err.message}`,
    }
  }
}

/**
 * Claims a mail for a specific user. If not yet marked as `read`, it will be marked as `read`.
 * 
 * This will only be possible if the mail has attachments.
 */
export const claimMail = async (mailId: string, userId: string): Promise<ReturnValue> => {
  try {
    const [mail, user] = await Promise.all([
      MailReceiverDataModel.findOne({ mailId, userId }).lean(),
      UserModel.findOne({ _id: userId }).lean()
    ])

    if (!mail) {
      return {
        status: Status.ERROR,
        message: `(claimMail) Mail ID ${mailId} not found for user with ID ${userId}`,
      }
    }

    if (!user) {
      return {
        status: Status.ERROR,
        message: `(claimMail) User with ID ${userId} not found`,
      }
    }

    // if the mail is already claimed, return an error
    if (mail.claimedStatus.status) {
      return {
        status: Status.ERROR,
        message: `(claimMail) Mail ID ${mailId} already claimed for user with ID ${userId}`,
      }
    }

    // if the mail has no attachments, return an error
    const mailData = await MailModel.findOne({ _id: mailId }).lean();

    if (!mailData.attachments.length) {
      return {
        status: Status.ERROR,
        message: `(claimMail) Mail ID ${mailId} has no attachments to claim for user with ID ${userId}`,
      }
    }

    const userUpdateOperations = {
      $pull: {},
      $inc: {},
      $set: {},
      $push: {}
    };

    const mailReceiverDataUpdateOperations = {
      $set: {}
    }

    // initialize $each on the user's inventory items, foods and/or resources.
    if (!userUpdateOperations.$push['inventory.items']) {
      userUpdateOperations.$push['inventory.items'] = { $each: [] }
  }

  if (!userUpdateOperations.$push['inventory.foods']) {
      userUpdateOperations.$push['inventory.foods'] = { $each: [] }
  }

  if (!userUpdateOperations.$push['inventory.resources']) {
      userUpdateOperations.$push['inventory.resources'] = { $each: [] }
  }

    // claim the mail and give the user the rewards.
    for (const attachment of mailData.attachments) {
      const type = attachment.type;

      if (type === 'food') {
        // add the food to the user's inventory
        // firstly, check if the food already exists in the user's inventory
        const existingFoodIndex = (user.inventory?.foods as Food[]).findIndex((food) => food.type === attachment.name);

        if (existingFoodIndex !== -1) {
          userUpdateOperations.$inc[`inventory.foods.${existingFoodIndex}.amount`] = attachment.amount;
        } else {
          userUpdateOperations.$push['inventory.foods'].$each.push({ 
            type: attachment.name, 
            amount: attachment.amount 
          });
        }
      } else if (type === 'item') {
        // add the item to the user's inventory
        // firstly, check if the item already exists in the user's inventory
        const existingItemIndex = (user.inventory?.items as Item[]).findIndex((item) => item.type === attachment.name);

        if (existingItemIndex !== -1) {
          userUpdateOperations.$inc[`inventory.items.${existingItemIndex}.amount`] = attachment.amount;
        } else {
          userUpdateOperations.$push['inventory.items'].$each.push({ 
            type: attachment.name, 
            amount: attachment.amount,
            totalAmountConsumed: 0,
            weeklyAmountConsumed: 0
          });
        }
      } else if (type === 'resource') {
        // get the resource data
        const resourceData = resources.find((resource) => resource.type === attachment.name);

        if (!resourceData) {
          return {
            status: Status.ERROR,
            message: `(claimMail) Resource ${attachment.name} not found in resources list`,
          }
        }

        // check if the resource already exists in the user's inventory
        const existingResourceIndex = (user.inventory?.resources as ExtendedResource[]).findIndex((resource) => resource.type === attachment.name);

        // if the resource already exists, increment the amount
        if (existingResourceIndex !== -1) {
          userUpdateOperations.$inc[`inventory.resources.${existingResourceIndex}.amount`] = attachment.amount;
        } else {
          // else, push the new resource to the user's inventory
          userUpdateOperations.$push['inventory.resources'].$each.push({ 
            ...resourceData,
            amount: attachment.amount,
            origin: ExtendedResourceOrigin.NORMAL
          });
        }
      } else if (type === 'xCookies') {
        // increment the user's xCookies via inventory.xCookieData.currentXCookies
        userUpdateOperations.$inc['inventory.xCookieData.currentXCookies'] = attachment.amount;
      } else {
        // unknown attachment type for now. throw an error.
        return {
          status: Status.ERROR,
          message: `(claimMail) Unknown attachment type: ${type}`,
        }
      }
    }

    // mark the mail as claimed. if not yet read somehow, mark it as read.
    mailReceiverDataUpdateOperations.$set['claimedStatus.status'] = true;
    mailReceiverDataUpdateOperations.$set['claimedStatus.timestamp'] = Math.floor(Date.now() / 1000);

    if (!mail.readStatus.status) {
      mailReceiverDataUpdateOperations.$set['readStatus.status'] = true;
      mailReceiverDataUpdateOperations.$set['readStatus.timestamp'] = Math.floor(Date.now() / 1000);
    }

    // simultaneously, update the user's inventory with the rewards (divide $inc + $set and $push + $pull operations)
    await Promise.all([
      UserModel.updateOne({ _id: userId }, {
        $set: userUpdateOperations.$set,
        $inc: userUpdateOperations.$inc,
      }),
      MailReceiverDataModel.updateOne({ mailId, userId }, mailReceiverDataUpdateOperations)
    ]);

    await UserModel.updateOne({ _id: userId }, {
      $push: userUpdateOperations.$push,
      $pull: userUpdateOperations.$pull
    });

    return {
      status: Status.SUCCESS,
      message: '(claimMail) Successfully claimed mail and added rewards to user inventory.',
    }
  } catch (err: any) {
    return {
      status: Status.ERROR,
      message: `(claimMail) Error: ${err.message}`,
    }
  }
}

/**
 * Marks a mail as read for a specific user.
 */
export const readMail = async (mailId: string, userId: string): Promise<ReturnValue> => {
  try {
    const mail = await MailReceiverDataModel.findOne({ mailId, userId }).lean();

    if (!mail) {
      return {
        status: Status.ERROR,
        message: `(readMail) Mail ID ${mailId} not found for user with ID ${userId}`,
      }
    }

    // if the mail is already read, return an error
    if (mail.readStatus.status) {
      return {
        status: Status.ERROR,
        message: `(readMail) Mail ID ${mailId} already read for user with ID ${userId}`,
      }
    }

    // mark the mail as read
    await MailReceiverDataModel.updateOne({ mailId, userId }, {
      $set: {
        'readStatus.status': true,
        'readStatus.timestamp': Math.floor(Date.now() / 1000)
      }
    });

    return {
      status: Status.SUCCESS,
      message: '(readMail) Successfully marked mail as read.',
    }
  } catch (err: any) {
    return {
      status: Status.ERROR,
      message: `(readMail) Error: ${err.message}`,
    }
  }
}

/**
 * Finds all unclaimed and unread mails for a specific user and claim any rewards, also marking them as read.
 */
export const readAndClaimAllMails = async (userId: string): Promise<ReturnValue> => {
  try {
    // we will find those marked unread (because claimed mails will automatically be marked as read)
    const [mailReceiverData, user] = await Promise.all([
      MailReceiverDataModel.find({ userId, 'readStatus.status': false }).lean(),
      UserModel.findOne({ _id: userId }).lean()
    ]);

    if (!user) {
      return {
        status: Status.ERROR,
        message: `(readAndClaimAllMails) User with ID ${userId} not found`,
      }
    }

    if (mailReceiverData.length === 0) {
      return {
        status: Status.SUCCESS,
        message: '(readAndClaimAllMails) No unread mails found.',
      }
    }

    const mailIds = mailReceiverData.map(mail => mail.mailId);

    const mails = await MailModel.find({ _id: { $in: mailIds } }).lean();

    const userUpdateOperations = {
      $pull: {},
      $inc: {},
      $set: {},
      $push: {}
    };

    const mailReceiverDataUpdateOperations: Array<{
      id: string,
      updateOperations: {
        $set: {}
      }
    }> = [];

    // initialize $each on the user's inventory items, foods and/or resources.
    if (!userUpdateOperations.$push['inventory.items']) {
      userUpdateOperations.$push['inventory.items'] = { $each: [] }
    }

    if (!userUpdateOperations.$push['inventory.foods']) {
      userUpdateOperations.$push['inventory.foods'] = { $each: [] }
    }

    if (!userUpdateOperations.$push['inventory.resources']) {
      userUpdateOperations.$push['inventory.resources'] = { $each: [] }
    }

    for (const mail of mails) {
      // we will check if this mail has attachments. if not, we will just set it as read.
      if (mail.attachments.length === 0) {
        mailReceiverDataUpdateOperations.push({
          id: mail._id,
          updateOperations: {
            $set: {
              'readStatus.status': true,
              'readStatus.timestamp': Math.floor(Date.now() / 1000)
            }
          }
        });
        continue;
      } else {
        // if there are attachments, we will claim the mail and give the user the rewards.
        for (const attachment of mail.attachments) {
          const type = attachment.type;

          if (type === 'food') {
            // add the food to the user's inventory
            // firstly, check if the food to be added already exists in the update operations (so we don't override)
            const existingFoodIndexInOps = userUpdateOperations.$push['inventory.foods'].$each.findIndex((food: Food) => food.type === attachment.name);

            // if the food already exists in the update operations, increment the amount (in the update operations, NOT the database)
            if (existingFoodIndexInOps !== -1) {
              userUpdateOperations.$push['inventory.foods'].$each[existingFoodIndexInOps].amount += attachment.amount;
            } else {
              // if not found, then we check if the food already exists in the user's inventory
              const existingFoodIndex = (user.inventory?.foods as Food[]).findIndex((food) => food.type === attachment.name);

              // if the food already exists in the user's inventory, increment the amount
              if (existingFoodIndex !== -1) {
                userUpdateOperations.$inc[`inventory.foods.${existingFoodIndex}.amount`] = attachment.amount;
              } else {
                // else, push the new food to the update operations
                userUpdateOperations.$push['inventory.foods'].$each.push({ 
                  type: attachment.name, 
                  amount: attachment.amount 
                });
              }
            }
          } else if (type === 'item') {
            // add the item to the user's inventory
            // firstly, check if the item to be added already exists in the update operations (so we don't override)
            const existingItemIndexInOps = userUpdateOperations.$push['inventory.items'].$each.findIndex((item: Item) => item.type === attachment.name);

            // if the item already exists in the update operations, increment the amount (in the update operations, NOT the database)
            if (existingItemIndexInOps !== -1) {
              userUpdateOperations.$push['inventory.items'].$each[existingItemIndexInOps].amount += attachment.amount;
            } else {
              // if not found, then we check if the item already exists in the user's inventory
              const existingItemIndex = (user.inventory?.items as Item[]).findIndex((item) => item.type === attachment.name);

              // if the item already exists in the user's inventory, increment the amount
              if (existingItemIndex !== -1) {
                userUpdateOperations.$inc[`inventory.items.${existingItemIndex}.amount`] = attachment.amount;
              } else {
                // else, push the new item to the update operations
                userUpdateOperations.$push['inventory.items'].$each.push({ 
                  type: attachment.name, 
                  amount: attachment.amount,
                  totalAmountConsumed: 0,
                  weeklyAmountConsumed: 0
                });
              }
            }
          } else if (type === 'resource') {
            // get the resource data
            const resourceData = resources.find((resource) => resource.type === attachment.name);

            if (!resourceData) {
              return {
                status: Status.ERROR,
                message: `(readAndClaimAllMails) Resource ${attachment.name} not found in resources list`,
              }
            }

            // check if the resource to be added already exists in the update operations (so we don't override)
            const existingResourceIndexInOps = userUpdateOperations.$push['inventory.resources'].$each.findIndex((resource: ExtendedResource) => resource.type === attachment.name);

            // if the resource already exists in the update operations, increment the amount (in the update operations, NOT the database)
            if (existingResourceIndexInOps !== -1) {
              userUpdateOperations.$push['inventory.resources'].$each[existingResourceIndexInOps].amount += attachment.amount;
            } else {
              // if not found, then we check if the resource already exists in the user's inventory
              const existingResourceIndex = (user.inventory?.resources as ExtendedResource[]).findIndex((resource) => resource.type === attachment.name);

              // if the resource already exists in the user's inventory, increment the amount
              if (existingResourceIndex !== -1) {
                userUpdateOperations.$inc[`inventory.resources.${existingResourceIndex}.amount`] = attachment.amount;
              } else {
                // else, push the new resource to the update operations
                userUpdateOperations.$push['inventory.resources'].$each.push({ 
                  ...resourceData,
                  amount: attachment.amount,
                  origin: ExtendedResourceOrigin.NORMAL
                });
              }
            }
          } else if (type === 'xCookies') {
            // check if the xCookies to be added already exists in the update operations (so we don't override)
            const existingXCookiesInOps = userUpdateOperations.$inc['inventory.xCookieData.currentXCookies'];

            // if the xCookies already exists in the update operations, increment the amount (in the update operations, NOT the database)
            if (existingXCookiesInOps) {
              userUpdateOperations.$inc['inventory.xCookieData.currentXCookies'] += attachment.amount;
            } else {
              // if not found, then increment the xCookies in the update operations
              userUpdateOperations.$inc['inventory.xCookieData.currentXCookies'] = attachment.amount;
            }
          } else {
            // unknown attachment type for now. simply skip this attachment.
            continue;
          }
        }
      }

      // mark the mail as read. if there are attachments, mark it also as claimed.
      mailReceiverDataUpdateOperations.push({
        id: mail._id,
        updateOperations: {
          $set: {
            'readStatus.status': true,
            'readStatus.timestamp': Math.floor(Date.now() / 1000),
            'claimedStatus.status': mail.attachments.length > 0,
            'claimedStatus.timestamp': mail.attachments.length > 0 ? Math.floor(Date.now() / 1000) : 0
          }
        }
      });
    }

    const mailBatchUpdateOps = mailReceiverDataUpdateOperations.map(async ({ id, updateOperations }) => {
      return MailReceiverDataModel.updateOne({ mailId: id, userId }, updateOperations);
    })

    // simultaneously, update the user's inventory with the rewards (divide $inc + $set and $push + $pull operations)
    await Promise.all([
      UserModel.updateOne({ _id: userId }, {
        $set: userUpdateOperations.$set,
        $inc: userUpdateOperations.$inc,
      }),
      ...mailBatchUpdateOps
    ]);

    await UserModel.updateOne({ _id: userId }, {
      $push: userUpdateOperations.$push,
      $pull: userUpdateOperations.$pull
    });

    return {
      status: Status.SUCCESS,
      message: '(readAndClaimAllMails) Successfully claimed and read all mails and added rewards to user inventory.',
    }
  } catch (err: any) {
    return {
      status: Status.ERROR,
      message: `(readAndClaimAllMails) Error: ${err.message}`,
    }
  }
}

/**
 * Marks all mails as deleted for a specific user.
 */
export const deleteAllMails = async (userId: string): Promise<ReturnValue> => {
  try {
    const mailReceiverData = await MailReceiverDataModel.find({ userId }).lean();

    if (mailReceiverData.length === 0) {
      return {
        status: Status.SUCCESS,
        message: '(deleteAllMails) No mails found to delete.',
      }
    }

    // mark all mails as deleted (NOTE: this doesn't automatically claim the rewards)
    await MailReceiverDataModel.updateMany({ userId }, {
      $set: {
        'deletedStatus.status': true,
        'deletedStatus.timestamp': Math.floor(Date.now() / 1000)
      }
    });

    return {
      status: Status.SUCCESS,
      message: '(deleteAllMails) Successfully marked all mails as deleted.',
    }
  } catch (err: any) {
    return {
      status: Status.ERROR,
      message: `(deleteAllMails) Error: ${err.message}`,
    }
  }
}

/**
 * Purge all expired mails.
 * 
 * NOTE: The main function is done in Bull and Redis. This function is just a backup which will be called in a daily scheduler.
 */
export const purgeExpiredMails = async (): Promise<void> => {
  try {
    await MailModel.deleteMany({ expiryTimestamp: { $lt: Math.floor(Date.now() / 1000) } });

    // also delete the mail receiver data for the purged mails
    // NOTE: because at this point the mails have already been deleted,
    // we use `$nin` to find all mail receiver data whose mail ID is NOT in the list of mail IDs (which have been deleted)
    await MailReceiverDataModel.deleteMany({ mailId: { $nin: (await MailModel.find().lean()).map(mail => mail._id) } });

    console.log('(purgeExpiredMails) Successfully purged all expired mails.');
  } catch (err: any) {
    console.error(`(purgeExpiredMails) Error: ${err.message}`);
  }
}

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