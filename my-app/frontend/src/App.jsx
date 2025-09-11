import './App.css';
import {Routes, Route} from "react-router-dom";
import Register from './components/Register/Register';
import Login from './components/Login/Login';

function App() {
  return (
    <>
      <Routes>
        <Route path="/app/register" element={<Register />} />
        <Route path="/app/login" element={<Login />} />
      </Routes>
    </>
  )
};

export default App;
