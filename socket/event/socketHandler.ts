import { Socket } from "socket.io";
import { saunaInit, startRest, stopRest } from "../../api/sauna";

export const socketHandler = (socket: Socket) => {
  saunaInit(socket);

  socket.on("start_rest", (msg) => {
    startRest(socket, msg)
  })

  socket.on('disconnect', () => {
    stopRest(socket);
  });
}