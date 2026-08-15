// Socket.io Service
// Real-time messaging, presence tracking, and notifications

import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { query } from '../database/connection';

interface UserSocket {
  userId: string;
  conversationId: string;
  socketId: string;
}

interface OnlineUser {
  userId: string;
  socketId: string;
  lastSeen: Date;
}

class SocketService {
  private io: SocketIOServer;
  private onlineUsers: Map<string, OnlineUser> = new Map();
  private userSockets: Map<string, UserSocket> = new Map();

  constructor(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
        methods: ['GET', 'POST'],
      },
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  // ============================================
  // MIDDLEWARE
  // ============================================

  private setupMiddleware() {
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;

        if (!token) {
          return next(new Error('Authentication error'));
        }

        // Verify JWT token (implement your token verification)
        const userId = this.verifyToken(token);
        if (!userId) {
          return next(new Error('Invalid token'));
        }

        socket.data.userId = userId;
        next();
      } catch (error) {
        next(new Error('Authentication failed'));
      }
    });
  }

  // ============================================
  // EVENT HANDLERS
  // ============================================

  private setupEventHandlers() {
    this.io.on('connection', (socket: Socket) => {
      const userId = socket.data.userId;
      console.log(`✅ User connected: ${userId} (${socket.id})`);

      // User comes online
      this.onlineUsers.set(userId, {
        userId,
        socketId: socket.id,
        lastSeen: new Date(),
      });

      socket.emit('connected', {
        message: 'Connected to Transcend Law',
        userId,
        socketId: socket.id,
      });

      // Broadcast user online status
      this.io.emit('user_online', { userId, timestamp: new Date() });

      // ============================================
      // MESSAGING EVENTS
      // ============================================

      socket.on('join_conversation', async (data: any) => {
        try {
          const { conversationId } = data;

          socket.join(`conversation_${conversationId}`);
          this.userSockets.set(socket.id, { userId, conversationId, socketId: socket.id });

          // Notify others in conversation
          this.io.to(`conversation_${conversationId}`).emit('user_joined', {
            userId,
            conversationId,
            timestamp: new Date(),
          });

          console.log(`✅ User ${userId} joined conversation ${conversationId}`);
        } catch (error) {
          console.error('Join conversation error:', error);
          socket.emit('error', { message: 'Failed to join conversation' });
        }
      });

      socket.on('send_message', async (data: any) => {
        try {
          const { conversationId, content } = data;

          if (!content || !conversationId) {
            return socket.emit('error', { message: 'Missing required fields' });
          }

          // Save message to database
          const messageResult = await query(
            `INSERT INTO messages (conversation_id, sender_id, content, sender_language)
             VALUES ($1, $2, $3, $4)
             RETURNING id, created_at`,
            [conversationId, userId, content, 'en']
          );

          const message = {
            id: messageResult.rows[0].id,
            conversationId,
            senderId: userId,
            content,
            timestamp: messageResult.rows[0].created_at,
            read: false,
          };

          // Broadcast message to all users in conversation
          this.io.to(`conversation_${conversationId}`).emit('message_received', message);

          // Update conversation last_message_at
          await query(
            `UPDATE conversations SET last_message_at = NOW() WHERE id = $1`,
            [conversationId]
          );

          console.log(`✅ Message sent in conversation ${conversationId}`);
        } catch (error) {
          console.error('Send message error:', error);
          socket.emit('error', { message: 'Failed to send message' });
        }
      });

      socket.on('typing', async (data: any) => {
        try {
          const { conversationId } = data;

          // Broadcast typing indicator
          socket.to(`conversation_${conversationId}`).emit('user_typing', {
            userId,
            conversationId,
            timestamp: new Date(),
          });
        } catch (error) {
          console.error('Typing event error:', error);
        }
      });

      socket.on('stop_typing', async (data: any) => {
        try {
          const { conversationId } = data;

          // Broadcast stop typing
          socket.to(`conversation_${conversationId}`).emit('user_stop_typing', {
            userId,
            conversationId,
          });
        } catch (error) {
          console.error('Stop typing error:', error);
        }
      });

      socket.on('read_message', async (data: any) => {
        try {
          const { messageId } = data;

          // Mark message as read
          await query(
            `UPDATE messages SET read_at = NOW() WHERE id = $1`,
            [messageId]
          );

          // Broadcast read receipt
          this.io.emit('message_read', { messageId, userId });
        } catch (error) {
          console.error('Read message error:', error);
        }
      });

      socket.on('leave_conversation', (data: any) => {
        try {
          const { conversationId } = data;

          socket.leave(`conversation_${conversationId}`);
          this.userSockets.delete(socket.id);

          // Notify others in conversation
          this.io.to(`conversation_${conversationId}`).emit('user_left', {
            userId,
            conversationId,
          });

          console.log(`✅ User ${userId} left conversation ${conversationId}`);
        } catch (error) {
          console.error('Leave conversation error:', error);
        }
      });

      // ============================================
      // STATUS EVENTS
      // ============================================

      socket.on('get_online_users', () => {
        const onlineUsersList = Array.from(this.onlineUsers.values()).map((u) => ({
          userId: u.userId,
          lastSeen: u.lastSeen,
        }));

        socket.emit('online_users', onlineUsersList);
      });

      socket.on('get_conversation_status', async (data: any) => {
        try {
          const { conversationId } = data;

          // Get online users in conversation
          const usersInConversation = Array.from(this.userSockets.values())
            .filter((u) => u.conversationId === conversationId)
            .map((u) => u.userId);

          socket.emit('conversation_status', {
            conversationId,
            onlineUsers: usersInConversation,
          });
        } catch (error) {
          console.error('Get status error:', error);
        }
      });

      // ============================================
      // DISCONNECT
      // ============================================

      socket.on('disconnect', () => {
        console.log(`❌ User disconnected: ${userId} (${socket.id})`);

        // Remove from online users
        this.onlineUsers.delete(userId);
        this.userSockets.delete(socket.id);

        // Broadcast user offline status
        this.io.emit('user_offline', {
          userId,
          timestamp: new Date(),
        });
      });

      // Error handler
      socket.on('error', (error) => {
        console.error('Socket error:', error);
      });
    });
  }

  // ============================================
  // PUBLIC METHODS
  // ============================================

  public sendMessageToConversation(conversationId: string, message: any) {
    this.io.to(`conversation_${conversationId}`).emit('message_received', message);
  }

  public notifyUser(userId: string, event: string, data: any) {
    const user = this.onlineUsers.get(userId);
    if (user) {
      this.io.to(user.socketId).emit(event, data);
    }
  }

  public broadcastEvent(event: string, data: any) {
    this.io.emit(event, data);
  }

  public getOnlineUsers(): OnlineUser[] {
    return Array.from(this.onlineUsers.values());
  }

  public isUserOnline(userId: string): boolean {
    return this.onlineUsers.has(userId);
  }

  public getIO(): SocketIOServer {
    return this.io;
  }

  // ============================================
  // HELPERS
  // ============================================

  private verifyToken(token: string): string | null {
    try {
      // TODO: Implement actual JWT verification
      // const decoded = jwt.verify(token, process.env.JWT_SECRET);
      // return decoded.userId;

      // Placeholder
      return token.split('.')[0]; // Extract from token format
    } catch (error) {
      return null;
    }
  }
}

let socketService: SocketService | null = null;

export function initializeSocket(httpServer: HTTPServer): SocketService {
  if (!socketService) {
    socketService = new SocketService(httpServer);
    console.log('✅ Socket.io initialized');
  }
  return socketService;
}

export function getSocketService(): SocketService {
  if (!socketService) {
    throw new Error('Socket service not initialized');
  }
  return socketService;
}

export default SocketService;
