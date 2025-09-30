// src/context/authContext.js
import { 
  createContext, 
  useState, 
  useMemo, 
  useEffect, 
  useContext, 
  useCallback
 } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [authToken, setAuthToken] = useState(''); // ADD THIS LINE - missing authToken state
  const [authLoading, setAuthLoading] = useState(true);

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
      setAuthToken(''); // ADD THIS - clear authToken state
      return false;
    }

    if (currentTime > Number(authExpiry)) {
      sessionStorage.clear();
      setIsLoggedIn(false);
      setUsername('');
      setEmail('');
      setAuthToken(''); // ADD THIS - clear authToken state
      return false;
    }

    setUsername(authUsername);
    setEmail(authEmail);
    setAuthToken(authToken); // ADD THIS - set authToken state
    setIsLoggedIn(true);
    return true;
  }, []);

  useEffect(() => {
    setAuthLoading(true);
    checkAuthStatus();
    setAuthLoading(false);
  }, [checkAuthStatus]);

  const updateAuthStatus = useCallback((token, username, email, expiry) => {
    sessionStorage.setItem('auth-token', token);
    sessionStorage.setItem('username', username);
    sessionStorage.setItem('email', email);
    sessionStorage.setItem('authExpiry', expiry);
    setIsLoggedIn(true);
    setUsername(username);
    setEmail(email);
    setAuthToken(token); // ADD THIS - set authToken state
  }, []);

  const clearAuthSession = useCallback(() => {
    sessionStorage.clear();
    setIsLoggedIn(false);
    setUsername('');
    setEmail('');
    setAuthToken(''); // ADD THIS - clear authToken state
  }, []);

  const value = useMemo(
    () => ({
      isLoggedIn,
      setIsLoggedIn,
      username,
      setUsername,
      email,
      setEmail,
      authToken, // ADD THIS - export authToken
      authLoading,
      updateAuthStatus,
      clearAuthSession,
    }),
    [isLoggedIn, username, email, authToken, authLoading, updateAuthStatus, clearAuthSession] // ADD authToken to dependencies
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAppContext = () => useContext(AuthContext);