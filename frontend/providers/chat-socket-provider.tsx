'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { ChatSocket } from '@/lib/ws/chat-socket';
import { useAuth } from '@/hooks/useAuth';

interface ChatSocketContextType {
  socket: ChatSocket | null;
  isConnected: boolean;
}

const ChatSocketContext = createContext<ChatSocketContextType>({
  socket: null,
  isConnected: false,
});

export function ChatSocketProvider({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuth();
  const socketRef = useRef<ChatSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!token || !user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    if (!socketRef.current) {
      socketRef.current = new ChatSocket({
        onEvent: () => {}, // Default empty handler
        onOpen: () => setIsConnected(true),
        onClose: () => setIsConnected(false),
        onError: () => setIsConnected(false),
        onUnauthorized: () => setIsConnected(false),
      });
      socketRef.current.connect();
    }

    return () => {
      // We don't disconnect on unmount of the provider unless the user logs out
      // (which is handled by the first if block above).
    };
  }, [token, user]);

  return (
    <ChatSocketContext.Provider value={{ socket: socketRef.current, isConnected }}>
      {children}
    </ChatSocketContext.Provider>
  );
}

export function useChatSocketInstance() {
  return useContext(ChatSocketContext);
}
