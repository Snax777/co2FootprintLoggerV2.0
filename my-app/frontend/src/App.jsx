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
