import { WebSocket } from 'ws';

/**
 * An extension of WebSocket to include the user ID and/or squad ID of a message.
 */
export interface ExtendedWebSocket extends WebSocket {
    userId?: string;
    squadId?: string;
}