import { Socket } from "socket.io";
import { energyRecover, saunaInit, startRest, stopRest } from "../../api/sauna";
import { Status } from "../../utils/retVal";

export const socketHandler = (socket: Socket) => {
  saunaInit(socket);

  socket.on("start_rest", (msg) => {
    startRest(socket, msg)
  })

  socket.on("stop_rest", (msg) => {
    stopRest(socket)
  })

  socket.on("alive", async (msg) => {
    const {socketId, getTotalEnergy, userId, message} = msg;
    console.log(`user ${userId} yep!!!`);
    const response = await energyRecover(userId, getTotalEnergy);
    if (response) {
      socket.emit("server_response", {
        status: Status.SUCCESS,
        message
      })
    } else {
      socket.emit("server_response", {
        status: Status.ERROR,
        message
      })
    }
  })

  socket.on('disconnect', () => {
    // user with accidentally disconnected
    stopRest(socket);
  });
}