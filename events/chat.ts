import { Server, Socket } from 'socket.io';
import { sendDirectMessage, sendMessage } from '../api/chat';
import { Status } from '../utils/retVal';
import { sendDirectMessageDTO, SendDirectMessageDTO, sendMessageDTO, SendMessageDTO } from '../validations/chat';

export enum ChatEvent {
    /** send message */
    SEND_MESSAGE = 'send_message',
    /** send message */
    SEND_DIRECT_MESSAGE = 'send_direct_message',
    /** listener for a new message */
    NEW_MESSAGE = 'new_message',
    /** user joined a new channel */
    NEW_CHANNEL = 'new_channel',
}

interface CallbackResponse {
    success?: boolean;
    error?: string;
    message?: string;
}

type CallbackEvent = (response: CallbackResponse) => void;

export const handleChatEvents = (socket: Socket, io: Server) => {
    socket.on(ChatEvent.SEND_MESSAGE, async (request: SendMessageDTO, callback?: CallbackEvent) => {
        const senderId = socket.data.userId;

        const validation = sendMessageDTO.validate(request);

        if (validation.status !== Status.SUCCESS) {
            if (callback) {
                return callback({ error: 'Invalid Payload' });
            }

            return;
        }

        const result = await sendMessage(senderId, validation.data.chatroomId, validation.data.message);
        if (result.status !== Status.SUCCESS) {
            if (callback) {
                return callback({ error: result.message });
            }
            return;
        }

        if (callback) {
            callback({ success: true, message: 'Message sent' });
        }

        io.to(result.data.chatroom._id).emit(ChatEvent.NEW_MESSAGE, result.data);
    });

    socket.on(ChatEvent.SEND_DIRECT_MESSAGE, async (request: SendDirectMessageDTO) => {
        const senderId = socket.data.userId;
        const validation = sendDirectMessageDTO.validate(request);

        if (validation.status !== Status.SUCCESS) throw new Error('Invalid Payload');

        const result = await sendDirectMessage(senderId, validation.data.receiverId, validation.data.message);
        if (result.status !== Status.SUCCESS) throw new Error('Failed to send the message');

        io.to(result.data.chatroom._id).emit(ChatEvent.NEW_MESSAGE, result.data);
    });
};
