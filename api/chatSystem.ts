import { Server } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { ChatMessage, ChatMessageType } from '../models/chatSystem';

export const initChatSystemWS = (server: Server): void => {
    const wss = new WebSocketServer({ server });
  
    wss.on('connection', (ws: WebSocket) => {
      console.log('New client connected');
  
      ws.on('message', (message: string) => {
        console.log('Received:', message);
        const data: ChatMessage = JSON.parse(message);
  
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
      });
    });
  
    const broadcast = (data: ChatMessage, ws: WebSocket): void => {
      wss.clients.forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(data));
        }
      });
    };
  
    const broadcastToSquad = (data: ChatMessage, ws: WebSocket): void => {
      // Implement squad-specific broadcast logic
    };
  
    const sendDirectMessage = (data: ChatMessage): void => {
      // Implement direct message logic
    };
  };