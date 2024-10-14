import { Socket } from "socket.io";
import { saunaInit, startRest, stopRest } from "../../api/sauna";

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

  socket.on('disconnect', () => {
    // user with accidentally disconnected
    stopRest(socket);
  });
}