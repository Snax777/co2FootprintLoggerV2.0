import './App.css';
import {Routes, Route} from "react-router-dom";
import Register from './components/Register/Register';
import Login from './components/Login/Login';
import NavigationBar from './components/NavigationBar/NavigationBar';
import Leaderboard from './components/Leaderboard/Leaderboard';
import LoggerChart from './components/LoggerChart/LoggerChart';
import Profile from './components/Profile/Profile';

function App() {
  return (
    <>
      <NavigationBar />
      <Routes>
        <Route path="/app/register" element={<Register />} />
        <Route path="/app/login" element={<Login />} />
        <Route path="/app/loggerChart" element={<LoggerChart />} />
        <Route path="/app/leaderboard" element={<Leaderboard />} />
        <Route path="/app/profile" element={<Profile />} />
      </Routes>
    </>
  )
};

export default App;
