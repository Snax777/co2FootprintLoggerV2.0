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
  const [username, setUsername] = useState('User');
  const [email, setEmail] = useState('');
  const [authToken, setAuthToken] = useState(''); 
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
      setAuthToken(''); 
      return false;
    }

    if (currentTime > Number(authExpiry)) {
      sessionStorage.clear();
      setIsLoggedIn(false);
      setUsername('');
      setEmail('');
      setAuthToken(''); 
      return false;
    }

    setUsername(authUsername);
    setEmail(authEmail);
    setAuthToken(authToken); 
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
    setAuthToken(token); 
  }, []);

  const clearAuthSession = useCallback(() => {
    setIsLoggedIn(false);
    setUsername('');
    setEmail('');
    setAuthToken(''); 
    sessionStorage.clear();
  }, []);

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
      updateAuthStatus,
      clearAuthSession,
    }),
    [isLoggedIn, username, email, authToken, authLoading, updateAuthStatus, clearAuthSession] 
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAppContext = () => useContext(AuthContext);