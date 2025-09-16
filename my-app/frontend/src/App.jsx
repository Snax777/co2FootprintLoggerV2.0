import './App.css';
import {Routes, Route} from "react-router-dom";
import Register from './components/Register/Register';
import Login from './components/Login/Login';
import NavigationBar from './components/NavigationBar/NavigationBar';
import Leaderboard from './components/Leaderboard/Leaderboard';

function App() {
  return (
    <>
      <NavigationBar />
      <Routes>
        <Route path="/app/register" element={<Register />} />
        <Route path="/app/login" element={<Login />} />
        <Route path="/app/leaderboard" element={<Leaderboard />} />
      </Routes>
    </>
  )
};

export default App;
