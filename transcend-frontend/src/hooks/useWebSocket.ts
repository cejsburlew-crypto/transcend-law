import { useEffect, useState, useCallback } from 'react';
import io, { Socket } from 'socket.io-client';

export interface RealtimeEvent {
  type: 'case-update' | 'message' | 'appointment' | 'document' | 'status-change';
  caseId: string;
  data: any;
  timestamp: string;
}

export interface UseWebSocketOptions {
  userId: string;
  caseIds?: string[];
  enabled?: boolean;
}

export const useWebSocket = (options: UseWebSocketOptions) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [events, setEvents] = useState<RealtimeEvent[]>([]);

  const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3000';

  useEffect(() => {
    if (!options.enabled && options.enabled !== undefined) return;

    // In development without WebSocket server, skip connection
    if (process.env.NODE_ENV !== 'production') {
      console.log('✅ [DEV MODE] WebSocket would connect to', API_BASE);
      return;
    }

    try {
      const newSocket = io(API_BASE, {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
        transports: ['websocket', 'polling'],
      });

      newSocket.on('connect', () => {
        console.log('📡 Connected to WebSocket server');
        setIsConnected(true);

        // Join with user ID
        newSocket.emit('join', options.userId);

        // Subscribe to cases
        if (options.caseIds && options.caseIds.length > 0) {
          options.caseIds.forEach(caseId => {
            newSocket.emit('subscribe-case', caseId);
          });
        }
      });

      newSocket.on('joined', (data) => {
        console.log('👤 Joined:', data);
      });

      newSocket.on('subscribed-case', (data) => {
        console.log('🔔 Subscribed to case:', data);
      });

      newSocket.on('case-event', (event: RealtimeEvent) => {
        console.log('📬 Case event received:', event);
        setEvents(prev => [...prev, event]);
      });

      newSocket.on('user-event', (event: RealtimeEvent) => {
        console.log('📧 User event received:', event);
        setEvents(prev => [...prev, event]);
      });

      newSocket.on('disconnect', () => {
        console.log('📵 Disconnected from WebSocket server');
        setIsConnected(false);
      });

      newSocket.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
      });

      setSocket(newSocket);

      return () => {
        newSocket.disconnect();
      };
    } catch (error) {
      console.error('Failed to initialize WebSocket:', error);
    }
  }, [options.userId, options.caseIds, options.enabled, API_BASE]);

  const subscribeToCaseEvents = useCallback(
    (caseId: string) => {
      if (socket && socket.connected) {
        socket.emit('subscribe-case', caseId);
      }
    },
    [socket]
  );

  const unsubscribeFromCaseEvents = useCallback(
    (caseId: string) => {
      if (socket && socket.connected) {
        socket.emit('unsubscribe-case', caseId);
      }
    },
    [socket]
  );

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  const getRecentEvents = useCallback(
    (caseId: string, limit: number = 10) => {
      return events
        .filter(e => e.caseId === caseId)
        .slice(-limit);
    },
    [events]
  );

  return {
    socket,
    isConnected,
    events,
    subscribeToCaseEvents,
    unsubscribeFromCaseEvents,
    clearEvents,
    getRecentEvents,
  };
};
