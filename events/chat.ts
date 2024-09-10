import { Server, Socket } from 'socket.io';
import { sendDirectMessage } from '../api/chat';
import { Status } from '../utils/retVal';

export enum ChatEvent {
    /** send direct message */
    DIRECT_MESSAGE = 'direct_message',
    /** listener for a new message */
    NEW_MESSAGE = 'new_message',
}

export const handleChatEvents = (socket: Socket, io: Server) => {
    socket.on(ChatEvent.DIRECT_MESSAGE, async (receiverId: string, message: string) => {
        const senderId = socket.data.userId;

        const result = await sendDirectMessage(senderId, receiverId, message);
        if (result.status !== Status.SUCCESS) throw new Error('Failed to send the message');

        socket.to('').emit(ChatEvent.DIRECT_MESSAGE, result.data.chat);
    });

    // Group Chat (only people in a specific group)
    socket.on('join group', (groupId: string) => {});

    socket.on('group chat', (groupId: string, msg: string) => {});

    // Private Chat (1-to-1 chat)
    socket.on('private chat', (receiverId: string, msg: string) => {});
};
