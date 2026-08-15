// useSocket Hook
// Real-time messaging with Socket.io

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseSocketOptions {
  url?: string;
  token?: string;
  autoConnect?: boolean;
}

interface UseSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  isTyping: boolean;
  onlineUsers: string[];
  sendMessage: (conversationId: string, content: string) => void;
  joinConversation: (conversationId: string) => void;
  leaveConversation: (conversationId: string) => void;
  setTyping: (conversationId: string, isTyping: boolean) => void;
  markMessageAsRead: (messageId: string) => void;
  onMessage: (callback: (message: any) => void) => void;
  onUserTyping: (callback: (data: any) => void) => void;
  onUserOnline: (callback: (userId: string) => void) => void;
  onUserOffline: (callback: (userId: string) => void) => void;
}

export function useSocket(options: UseSocketOptions = {}): UseSocketReturn {
  const {
    url = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3001',
    token,
    autoConnect = true,
  } = options;

  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);

  // Message callbacks
  const messageCallbacksRef = useRef<Array<(message: any) => void>>([]);
  const typingCallbacksRef = useRef<Array<(data: any) => void>>([]);
  const onlineCallbacksRef = useRef<Array<(userId: string) => void>>([]);
  const offlineCallbacksRef = useRef<Array<(userId: string) => void>>([]);

  // Initialize socket connection
  useEffect(() => {
    if (!autoConnect || !token) return;

    const socket = io(url, {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    // Connection events
    socket.on('connect', () => {
      console.log('✅ Socket connected:', socket.id);
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('❌ Socket disconnected');
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
    });

    // Message events
    socket.on('message_received', (message) => {
      messageCallbacksRef.current.forEach((cb) => cb(message));
    });

    socket.on('user_typing', (data) => {
      typingCallbacksRef.current.forEach((cb) => cb(data));
    });

    socket.on('user_stop_typing', (data) => {
      typingCallbacksRef.current.forEach((cb) => cb({ ...data, typing: false }));
    });

    // Status events
    socket.on('user_online', (data) => {
      onlineCallbacksRef.current.forEach((cb) => cb(data.userId));
    });

    socket.on('user_offline', (data) => {
      offlineCallbacksRef.current.forEach((cb) => cb(data.userId));
    });

    socket.on('online_users', (users) => {
      setOnlineUsers(users.map((u: any) => u.userId));
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [url, token, autoConnect]);

  // Send message
  const sendMessage = useCallback((conversationId: string, content: string) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('send_message', { conversationId, content });
    }
  }, [isConnected]);

  // Join conversation
  const joinConversation = useCallback((conversationId: string) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('join_conversation', { conversationId });
    }
  }, [isConnected]);

  // Leave conversation
  const leaveConversation = useCallback((conversationId: string) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('leave_conversation', { conversationId });
    }
  }, [isConnected]);

  // Set typing status
  const setTyping = useCallback((conversationId: string, typing: boolean) => {
    if (socketRef.current && isConnected) {
      if (typing) {
        socketRef.current.emit('typing', { conversationId });
        setIsTyping(true);
      } else {
        socketRef.current.emit('stop_typing', { conversationId });
        setIsTyping(false);
      }
    }
  }, [isConnected]);

  // Mark message as read
  const markMessageAsRead = useCallback((messageId: string) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('read_message', { messageId });
    }
  }, [isConnected]);

  // Register callbacks
  const onMessage = useCallback((callback: (message: any) => void) => {
    messageCallbacksRef.current.push(callback);
    return () => {
      messageCallbacksRef.current = messageCallbacksRef.current.filter(cb => cb !== callback);
    };
  }, []);

  const onUserTyping = useCallback((callback: (data: any) => void) => {
    typingCallbacksRef.current.push(callback);
    return () => {
      typingCallbacksRef.current = typingCallbacksRef.current.filter(cb => cb !== callback);
    };
  }, []);

  const onUserOnline = useCallback((callback: (userId: string) => void) => {
    onlineCallbacksRef.current.push(callback);
    return () => {
      onlineCallbacksRef.current = onlineCallbacksRef.current.filter(cb => cb !== callback);
    };
  }, []);

  const onUserOffline = useCallback((callback: (userId: string) => void) => {
    offlineCallbacksRef.current.push(callback);
    return () => {
      offlineCallbacksRef.current = offlineCallbacksRef.current.filter(cb => cb !== callback);
    };
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
    isTyping,
    onlineUsers,
    sendMessage,
    joinConversation,
    leaveConversation,
    setTyping,
    markMessageAsRead,
    onMessage,
    onUserTyping,
    onUserOnline,
    onUserOffline,
  };
}

export default useSocket;
