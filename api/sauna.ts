import { Socket } from "socket.io";
import { Status } from "../utils/retVal";
import redisDb from "../utils/constants/redisDb";
import { UserModel } from "../utils/constants/db";
import { EventSauna, SaunaGlobalKey, SaunaUserKey } from "../socket/event/saunaEvent";

export const startRest = async (socket: Socket) => {
  try {
    const {userId} = socket.data;
    // Avoid if user not found
    const user = await UserModel.findOne({ _id: userId }).lean();
    if (!user) {
      return socket.emit(EventSauna.SERVER_RESPONSE, {
        status: Status.BAD_REQUEST,
        message: "(startRest) user not found"
      }); 
    }

    // Avoid if user already full of energy
    if (user.inGameData.energy.currentEnergy === user.inGameData.energy.maxEnergy) {
      return socket.emit(EventSauna.SERVER_RESPONSE, {
        status: Status.BAD_REQUEST,
        message: "(startRest) user already full of energy"
      });
    }

    // get rest maximum energy
    const getRestMaximumEnergy = await redisDb.get(`${SaunaUserKey.MAXIMUM_ENERGY}:${userId}`);
    const maximumEnergyToFarm = getRestMaximumEnergy ? Number(getRestMaximumEnergy) : 1000;
    const energyPotionPerMinute = 25;
    const energyPotionPerSecond = energyPotionPerMinute / 60;
    const maxTimeToRest = maximumEnergyToFarm / energyPotionPerMinute; // 40 minute
    const maxTimeToRestInMiliSecond = (maxTimeToRest * 60) * 1000;  // 2400000 mili second

    // setup user time needed energy
    const currentEnergy = user.inGameData.energy.currentEnergy;
    const maxEnergy = user.inGameData.energy.maxEnergy;
    const lack = Math.abs(maxEnergy - currentEnergy);

    // how much user need to rest 
    const timeNeededEnergy = lack / energyPotionPerSecond;
    const timeNeededEnergyInMiliSecond = (timeNeededEnergy * 60) * 1000;

    // rest time 
    const restTime = timeNeededEnergyInMiliSecond > maxTimeToRestInMiliSecond ? maxTimeToRestInMiliSecond : timeNeededEnergyInMiliSecond;
    const startTime = Math.floor(Date.now() / 1000);

    await addUserToRoom(userId, socket.id, energyPotionPerSecond, startTime, maximumEnergyToFarm);
    const getConnected = await redisDb.get(SaunaGlobalKey.CONNECTED)
    // emit to all user connected
    socket.broadcast.emit(EventSauna.USER_COUNT, getConnected);
    // emit to user
    socket.emit(EventSauna.USER_COUNT, getConnected);
    return socket.emit(EventSauna.SERVER_RESPONSE, {
      status: Status.SUCCESS,
      message: `(startRest) user ${userId} has started rest`,
      data: {
        timeToMaxEnergyInMiliSecond: restTime,
        energyPotionPerSecond,
        isStartRest: true,
        startTimestamp: startTime
      }
    });
  } catch (error) {
    console.log(error.message);
    return socket.emit(EventSauna.SERVER_RESPONSE, {
      status: Status.BAD_REQUEST,
      message: `(startRest) ${error.message}`
    });
  }
};

/**
 * @param socket socket
 * @returns 
 */
export const stopRest = async (socket: Socket) => {
  try {
    const userId = await redisDb.get(socket.id);
    const isUserAlreadyInRoom = await isUserInRoom(userId);
    if (!isUserAlreadyInRoom) {
      return socket.emit(EventSauna.SERVER_RESPONSE, {
        status: Status.BAD_REQUEST,
        message: `(stopRest) user ${userId} is not in room`
      });
    }
    // get user energy potion per second
    const getEnergyPotionPerSecond = await redisDb.get(`${SaunaUserKey.ENERGY_POTION_PER_SECOND}:${userId}`);
    // get user when user join
    const getTimeUserJoin = await redisDb.get(`${SaunaUserKey.TIME_STAMP}:${userId}`);
    // calculate total energy
    const dateNowInSeconds = Math.floor(Date.now() / 1000);
    // calculate total time rest
    const userGetRestTime = Math.abs(dateNowInSeconds - Number(getTimeUserJoin));
    // calculate total energy
    const getTotalEnergy = Math.floor(userGetRestTime * Number(getEnergyPotionPerSecond));
    console.log(`${userId} has recover for ${userGetRestTime}. energy restored: ${getTotalEnergy}`);
    // recover energy
    await energyRecover(userId, getTotalEnergy);
    // remove user from room
    await removeUserFromRoom(socket.id);
    const getConnected = await redisDb.get(SaunaGlobalKey.CONNECTED)
    // broadcast to all user
    socket.broadcast.emit(EventSauna.USER_COUNT, getConnected);
    socket.emit(EventSauna.USER_COUNT, getConnected);
    return socket.emit(EventSauna.SERVER_RESPONSE, {
      status: Status.SUCCESS,
      message: `(stopRest) user ${userId} has stopped rest`,
      data: {
        timeToMaxEnergyInMiliSecond: 0,
        energyPotionPerSecond: 0,
        isStartRest: false,
        startTimestamp: 0,
      }
    });
  } catch (error) {
    return socket.emit(EventSauna.SERVER_RESPONSE, {
      status: Status.BAD_REQUEST,
      message: `(stopRest) ${error.message}`
    });
  }
};

/**
 * Add user to room and set delay to queue
 * @param userId user id
 * @param socketId socket id
 * @param energyInSecond time to max energy in second
 * @param startTime start time in milisecond
 * @param maximumEnergy maximum energy of user
 */
const addUserToRoom = async (userId: string, socketId: string, energyInSecond: number, startTime: number, maximumEnergy: number) => {
  // get user already in room
  const isUserAlreadyInRoom = await isUserInRoom(userId)
  // socket id same as user id
  const getCurrentSocketId = await redisDb.get(`${SaunaUserKey.USER_SOCKET}:${userId}`)
  const isSocketIdSameAsUserId = getCurrentSocketId === socketId
  // user already in room 
  if (isUserAlreadyInRoom && isSocketIdSameAsUserId) {
    throw new Error('user already in room');
  }
  // if user already in room but socket different, remove old socket and set new socket
  if (isUserAlreadyInRoom && !isSocketIdSameAsUserId) {
    await removeUserFromRoom(getCurrentSocketId); // Remove old socket
    console.log(`Socket ID updated for user ${userId}`);
  }
  // get total connected
  const userConnected = await redisDb.get(SaunaGlobalKey.CONNECTED)
  // get max energy
  const getMaxEnergy = await redisDb.get(`${SaunaUserKey.MAXIMUM_ENERGY}:${userId}`)
  //redis multi set
  const redisMulti = redisDb.multi()
  try {
    if (!getMaxEnergy) {
      // set user max energy
      redisMulti.set(`${SaunaUserKey.MAXIMUM_ENERGY}:${userId}`, maximumEnergy, 'EX', getExpiredTime())
    }
    // pin user to room
    redisMulti.set(`${SaunaUserKey.USER_SOCKET}:${userId}`, socketId)
    // pin user when user connected
    redisMulti.set(`${SaunaUserKey.TIME_STAMP}:${userId}`, startTime)
    // set user energy potion per second
    redisMulti.set(`${SaunaUserKey.ENERGY_POTION_PER_SECOND}:${userId}`, energyInSecond)
    // pin user to socketid
    redisMulti.set(socketId, userId)
    // increment total connected
    redisMulti.set(SaunaGlobalKey.CONNECTED, Number(userConnected) + 1)
    // exectute redis multi
    await redisMulti.exec()
  } catch (error) {
    throw new Error(`${error.message}`)
  }
}

/**
 * Remove user from room
 * @param userId user id
 */
const removeUserFromRoom = async (socketId: string) => {
  // get userId from socket id
  const userId = await redisDb.get(socketId)
  // user exist in room
  const isUserExistInRoom = await isUserInRoom(userId)
  // throw error if user not in room
  if (!isUserExistInRoom) throw new Error('User not in room')
  // get total connected
  const userConnected = await redisDb.get(SaunaGlobalKey.CONNECTED)
  // redis multi set
  const redisMulti = redisDb.multi()
  try {
    // decrement total connected
    redisMulti.set(SaunaGlobalKey.CONNECTED, Number(userConnected) - 1)
    // remove user from room
    redisMulti.del(`${SaunaUserKey.USER_SOCKET}:${userId}`)
    // remove user timestamp
    redisMulti.del(`${SaunaUserKey.TIME_STAMP}:${userId}`)
    // remove user energy potion per second
    redisMulti.del(`${SaunaUserKey.ENERGY_POTION_PER_SECOND}:${userId}`)
    // remove user from socket
    redisMulti.del(socketId)
    // exectute redis multi
    await redisMulti.exec()
  } catch (error) {
    throw new Error(`${error.message}`)
  }
}

export const saunaInit = async (socket: Socket) => {
  try {
    const userConnected = await redisDb.get(SaunaGlobalKey.CONNECTED)
    socket.broadcast.emit(EventSauna.USER_COUNT, userConnected ? Number(userConnected) : 0)
    socket.emit(EventSauna.USER_COUNT, userConnected ? Number(userConnected) : 0)
  } catch (error) {
    socket.emit(EventSauna.SERVER_RESPONSE, {
      status: Status.ERROR,
      message: `(saunaInit) ${error.message}`,
    })
  }
}

const isUserInRoom = async (userId: string) => {
  // check if user already in room
  const socketId = await redisDb.get(`${SaunaUserKey.USER_SOCKET}:${userId}`)
  // if user not in room return false
  if (!socketId) return false
  // if user in room return true
  return true
}

/**
 * Add energy to user's current energy
 * @param userId user id
 * @param energyRecover energy to add
 * @returns Promise of updateOne result
 */
export const energyRecover = async (userId: string, energyRecover: number): Promise<any> => {
  try {
    // Check if user is in the room
    const isUserExistInRoom = await isUserInRoom(userId);
    if (!isUserExistInRoom) throw new Error('User not in room');

    // Check if user exists
    const user = await UserModel.findOne({ _id: userId });
    if (!user) throw new Error('User not found');

    // Get user's remaining energy from Redis
    const remainingEnergy = await redisDb.get(`${SaunaUserKey.MAXIMUM_ENERGY}:${userId}`);
    if (!remainingEnergy) throw new Error('No remaining energy');

    const remainingEnergyValue = Number(remainingEnergy);
    if (remainingEnergyValue <= 0) throw new Error('No remaining energy');

    // Limit energy recovery to remaining energy
    const energyToRecover = Math.min(energyRecover, remainingEnergyValue);

    // Calculate the user's maximum possible energy recovery
    const maxEnergyRecoverable = user.inGameData.energy.maxEnergy - user.inGameData.energy.currentEnergy;

    // Check if recovered energy exceeds maximum energy
    const finalEnergyRecover = Math.min(energyToRecover, maxEnergyRecoverable);

    // If user has no room to recover more energy
    if (finalEnergyRecover <= 0) throw new Error('user has max energy');

    // Update Redis for the remaining energy to recover
    await redisDb.set(`${SaunaUserKey.MAXIMUM_ENERGY}:${userId}`, remainingEnergyValue - finalEnergyRecover);

    // Update user's energy in the database
    return await UserModel.updateOne(
      { _id: userId },
      { $inc: { 'inGameData.energy.currentEnergy': finalEnergyRecover } }
    );
  } catch (error) {
    throw new Error(`${error.message}`);
  }
};

// the function return expired time until midnight
const getExpiredTime = () => {
  const now = new Date();
  const midnight = new Date();
  midnight.setHours(23, 59, 59, 999);
  const timeUntilMidnight = midnight.getTime() - now.getTime();
  return Math.floor(timeUntilMidnight / 1000);
}

// this function only on development
export const resetUserRedisById = async () => {
  try {
    await redisDb.set(SaunaGlobalKey.CONNECTED, 0)
  }catch (error) {
    throw new Error(`${error.message}`)
  }
}