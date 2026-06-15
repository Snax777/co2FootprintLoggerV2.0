import { useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import Register from './components/Register/Register';
import Login from './components/Login/Login';
import NavigationBar from './components/NavigationBar/NavigationBar';
import Leaderboard from './components/Leaderboard/Leaderboard';
import LoggerChart from './components/LoggerChart/LoggerChart';
import Profile from './components/Profile/Profile';
import Home from './components/Home/Home';
import LandingPage from './components/LandingPage/LandingPage';
import BackgroundLayout from "./components/BackgroundLayout/BackgroundLayout";

function App() {
  useEffect(() => {
    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL; 
    const pingInterval = setInterval(() => {
      fetch(`${BACKEND_URL}/health`)
        .then(res => console.log('Keep-alive ping OK'))
        .catch(err => console.warn('Ping failed:', err));
    }, 10 * 60 * 1000); 

    return () => clearInterval(pingInterval); 
  }, []);

  return (
    <>
      <BackgroundLayout>
        <NavigationBar />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/app" element={<Home />} />
          <Route path="/app/register" element={<Register />} />
          <Route path="/app/login" element={<Login />} />
          <Route path="/app/loggerChart" element={<LoggerChart />} />
          <Route path="/app/leaderboard" element={<Leaderboard />} />
          <Route path="/app/profile" element={<Profile />} />
        </Routes>
      </BackgroundLayout>
    </>
  )
};

export default App;
