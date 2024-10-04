import { Socket } from "socket.io";
import {  startRest, stopRest } from "../api/sauna";
import { EventSauna, SaunaGlobalKey } from "../models/sauna";
import redisDb from "../utils/constants/redisDb";

export const socketHandler = (socket: Socket) => {
  console.log('a user connected');
  socket.on("connect", () => {
    redisDb.get(SaunaGlobalKey.CONNECTED).then((userConnected) => {
      socket.broadcast.emit(EventSauna.USER_COUNT, userConnected ? Number(userConnected) : 0)
      socket.emit(EventSauna.USER_COUNT, userConnected ? Number(userConnected) : 0)
    }).catch((error) => {
      console.log(error.message)
    })
  })
  socket.on("start_rest", (msg) => {
    startRest(socket, msg)
  })

  socket.on("stop_rest", (msg) => {
    stopRest(socket, msg)
  })

  socket.on('disconnect', () => {
    console.log('user disconnected');
  });
}