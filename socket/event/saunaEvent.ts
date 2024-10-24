import { Socket } from "socket.io";
import { resetUserRedisById, saunaInit, startRest, stopRest } from "../../api/sauna";
import { Status } from "../../utils/retVal";

export enum EventSauna {
  USER_COUNT = "user_count",
  START_REST = "start_rest",
  STOP_REST = "stop_rest",
  SERVER_RESPONSE = "server_response",
}
// use for redis 
export enum SaunaGlobalKey {
  CONNECTED = "connected",
}
// use for redis to pin user
export const SaunaUserKey = {
  MAXIMUM_ENERGY: "maximumEnergy",
  USER_SOCKET: "userSocket",
  TIME_STAMP: "timeStamp",
  ENERGY_POTION_PER_SECOND: "energyPotionPerSecond",
};


export const saunaEvent = (socket: Socket) => {
  saunaInit(socket);

  socket.on(EventSauna.START_REST, () => {
    startRest(socket)
  })

  socket.on(EventSauna.STOP_REST, () => {
    stopRest(socket)
  })

  // should delet in production
  socket.on("saunaReset", async () => {
    try {
      await resetUserRedisById()
    } catch (error) {
      socket.emit(EventSauna.SERVER_RESPONSE, {
        status: Status.ERROR,
        message: `(saunaReset) ${error.message}`,
      })
    }
  })

  socket.on('disconnect', () => {
    // user with accidentally disconnected
    stopRest(socket);
  });
}