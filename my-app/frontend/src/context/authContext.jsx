import { 
  createContext, 
  useState, 
  useMemo, 
  useEffect, 
  useContext, 
  useCallback,
  useRef
 } from 'react';
import { websocketClient } from '../services/websocketClient'; 

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('User');
  const [email, setEmail] = useState('');
  const [authToken, setAuthToken] = useState(''); 
  const [authLoading, setAuthLoading] = useState(true);
  const [webSocketConnected, setWebSocketConnected] = useState(false);
  const [webSocketError, setWebSocketError] = useState(null); // New: Track connection errors
  
  const wsReconnectTimeout = useRef(null);
  const isComponentMounted = useRef(true);

  const checkAuthStatus = useCallback(() => {
    const authToken = sessionStorage.getItem('auth-token');
    const authExpiry = sessionStorage.getItem('authExpiry');
    const authUsername = sessionStorage.getItem('username');
    const authEmail = sessionStorage.getItem('email');
    const currentTime = Date.now();

    if (!authToken || !authExpiry || !authUsername || !authEmail) {
      sessionStorage.clear();
      setIsLoggedIn(false);
      setUsername('');
      setEmail('');
      setAuthToken(''); 
      setWebSocketConnected(false);
      return false;
    }

    if (currentTime > Number(authExpiry)) {
      sessionStorage.clear();
      setIsLoggedIn(false);
      setUsername('');
      setEmail('');
      setAuthToken(''); 
      setWebSocketConnected(false);
      return false;
    }

    setUsername(authUsername);
    setEmail(authEmail);
    setAuthToken(authToken); 
    setIsLoggedIn(true);
    
    if (authToken) {
      establishWebSocketConnection(authToken);
    }
    
    return true;
  }, []);

  const establishWebSocketConnection = useCallback(async (token) => {
    // New: Check if token is valid before connecting
    if (!token) {
      setWebSocketError('Invalid authentication token');
      return;
    }

    try {
      console.log('🔄 Establishing WebSocket connection...');
      setWebSocketError(null); // Clear previous errors
      
      // Set up event handlers BEFORE connecting
      const handleConnected = (data) => {
        console.log('✅ WebSocket connected in context:', data);
        setWebSocketConnected(true);
        setWebSocketError(null);
        
        // New: Subscribe to general updates after connection
        websocketClient.subscribeToCO2Data('general');
        websocketClient.subscribeToGoalProgress('all'); // Subscribe to all goals, adjust as needed
      };
      
      const handleError = (data) => {
        console.error('❌ WebSocket error in context:', data);
        setWebSocketConnected(false);
        setWebSocketError(data.message || 'Connection error');
      };
      
      const handleDisconnected = (data) => {
        console.log('🔴 WebSocket disconnected in context:', data);
        setWebSocketConnected(false);
        setWebSocketError(data.message || 'Disconnected');
      };

      // Remove any existing handlers
      websocketClient.off('connected', handleConnected);
      websocketClient.off('error', handleError);
      websocketClient.off('disconnected', handleDisconnected);

      // Add new handlers
      websocketClient.on('connected', handleConnected);
      websocketClient.on('error', handleError);
      websocketClient.on('disconnected', handleDisconnected);

      // Also handle specific backend message types
      websocketClient.on('connection-lost', (data) => {
        console.error('🔴 Connection lost:', data);
        setWebSocketConnected(false);
        setWebSocketError(data.message || 'Connection lost');
      });

      await websocketClient.connect(token);
      console.log('✅ WebSocket connection established from auth context');
      
    } catch (error) {
      console.warn('❌ Failed to establish WebSocket connection:', error);
      setWebSocketConnected(false);
      setWebSocketError(error.message || 'Failed to connect');
      
      // Attempt to reconnect after a delay
      if (isComponentMounted.current && isLoggedIn) {
        console.log('🔄 Scheduling reconnection in 5 seconds...');
        wsReconnectTimeout.current = setTimeout(() => {
          establishWebSocketConnection(token);
        }, 5000);
      }
    }
  }, [isLoggedIn]);

  useEffect(() => {
    isComponentMounted.current = true;
    setAuthLoading(true);
    checkAuthStatus();
    setAuthLoading(false);

    return () => {
      isComponentMounted.current = false;
      // Clean up any pending reconnection attempts
      if (wsReconnectTimeout.current) {
        clearTimeout(wsReconnectTimeout.current);
        wsReconnectTimeout.current = null;
      }
    };
  }, [checkAuthStatus]);

  const updateAuthStatus = useCallback((token, username, email, expiry) => {
    sessionStorage.setItem('auth-token', token);
    sessionStorage.setItem('username', username);
    sessionStorage.setItem('email', email);
    sessionStorage.setItem('authExpiry', expiry);
    
    setIsLoggedIn(true);
    setUsername(username);
    setEmail(email);
    setAuthToken(token);
    
    // Clear any existing reconnection attempts
    if (wsReconnectTimeout.current) {
      clearTimeout(wsReconnectTimeout.current);
      wsReconnectTimeout.current = null;
    }
    
    establishWebSocketConnection(token);
  }, [establishWebSocketConnection]);

  const clearAuthSession = useCallback(() => {
    // Clear any pending reconnection attempts
    if (wsReconnectTimeout.current) {
      clearTimeout(wsReconnectTimeout.current);
      wsReconnectTimeout.current = null;
    }
    
    // Disconnect WebSocket
    websocketClient.disconnect();
    setWebSocketConnected(false);
    setWebSocketError(null);
    
    // Clear auth state
    setIsLoggedIn(false);
    setUsername('');
    setEmail('');
    setAuthToken(''); 
    sessionStorage.clear();
  }, []);

  const reconnectWebSocket = useCallback(async () => {
    if (authToken && !webSocketConnected) {
      try {
        await establishWebSocketConnection(authToken);
        return true;
      } catch (error) {
        console.error('❌ Failed to reconnect WebSocket:', error);
        setWebSocketError(error.message || 'Reconnection failed');
        return false;
      }
    }
    return webSocketConnected;
  }, [authToken, webSocketConnected, establishWebSocketConnection]);

  const value = useMemo(
    () => ({
      isLoggedIn,
      setIsLoggedIn,
      username,
      setUsername,
      email,
      setEmail,
      authToken, 
      authLoading,
      webSocketConnected,
      webSocketError, // New: Expose error state
      updateAuthStatus,
      clearAuthSession,
      reconnectWebSocket, 
    }),
    [
      isLoggedIn, 
      username, 
      email, 
      authToken, 
      authLoading, 
      webSocketConnected,
      webSocketError,
      updateAuthStatus, 
      clearAuthSession, 
      reconnectWebSocket
    ] 
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isComponentMounted.current = false;
      if (wsReconnectTimeout.current) {
        clearTimeout(wsReconnectTimeout.current);
      }
      if (!isLoggedIn) {
        websocketClient.disconnect();
      }
    };
  }, [isLoggedIn]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAppContext = () => useContext(AuthContext);