import { Server } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { ChatMessage, ChatMessageType } from '../models/chatSystem';
import { ExtendedWebSocket } from './ws';

/** keeps track of WS connections by user ID */
const users: Map<string, ExtendedWebSocket> = new Map();
/** keeps track of WS connections by squad ID */
const squads: Map<string, Set<ExtendedWebSocket>> = new Map();

export const initChatSystemWS = (server: Server): void => {
    const wss = new WebSocketServer({ server });

    wss.on('connection', (ws: ExtendedWebSocket) => {
        console.log('New client connected');

        ws.on('message', (message: string) => {
            console.log('Received:', message);
            const data: ChatMessage = JSON.parse(message);

            // Register user and squad ID
            if (data.type === ChatMessageType.REGISTER) {
                ws.userId = data.content; // assuming the content contains userId
                ws.squadId = data.squadId; // assuming the squadId is provided in the message
                users.set(ws.userId, ws);

                if (ws.squadId) {
                    if (!squads.has(ws.squadId)) {
                        squads.set(ws.squadId, new Set());
                    }
                    squads.get(ws.squadId)?.add(ws);
                }
                return;
            }

            // Handle the message according to its type
            switch (data.type) {
                case ChatMessageType.GLOBAL:
                    broadcast(data, ws);
                    break;
                case ChatMessageType.SQUAD:
                    broadcastToSquad(data, ws);
                    break;
                case ChatMessageType.DIRECT:
                    sendDirectMessage(data);
                    break;
                default:
                    console.log('Unknown message type:', data.type);
            }
        });

        ws.on('close', () => {
            console.log('Client disconnected');

            // clean up user and squad mappings
            if (ws.userId) {
                users.delete(ws.userId);
            }
            if (ws.squadId) {
                squads.get(ws.squadId)?.delete(ws);
                if (squads.get(ws.squadId)?.size === 0) {
                    squads.delete(ws.squadId);
                }
            }
        });
    });

    /** broadcasts to the global channel */
    const broadcast = (data: ChatMessage, ws: ExtendedWebSocket): void => {
        wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(data));
            }
        });
    };

    /** only broadcast to a specific squad's channel */
    const broadcastToSquad = (data: ChatMessage, ws: ExtendedWebSocket): void => {
        if (ws.squadId && squads.has(ws.squadId)) {
            squads.get(ws.squadId)?.forEach((client) => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(data));
                }
            });
        }
    };

    /** only broadcast to a specific user */
    const sendDirectMessage = (data: ChatMessage): void => {
        const recipient = users.get(data.recipientId || '');

        if (recipient && recipient.readyState === WebSocket.OPEN) {
        recipient.send(JSON.stringify(data));
        }
    };
};