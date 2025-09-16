import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAppContext } from "../../context/authContext";

const NavigationBar = () => {
    const {isLoggedIn, setIsLoggedIn, username, setUsername} = useAppContext();
    const navigate = useNavigate();

    useEffect(() => {
        const authToken = sessionStorage.getItem("auth-token");
        const authExpiry = sessionStorage.getItem("authExpiry");
        const authUsername = sessionStorage.getItem("username");
        const authEmail = sessionStorage.getItem("email");
        const currentTime = Date.now();

        const handleClearAuthSession = () => {
            sessionStorage.clear();
            setIsLoggedIn(false);
            setUsername("");
        };

        if (authToken && authExpiry && authUsername && authEmail) {
            if (currentTime <= Number(authExpiry)) {
                setUsername(authUsername);
                setIsLoggedIn(true);
            } else {
                handleClearAuthSession();
            }
        } else {
            handleClearAuthSession();
        }
    }, [setIsLoggedIn, setUsername]);

    const handleLogout = () => {
        sessionStorage.clear();
        setIsLoggedIn(false);
        setUsername("");

        navigate("/app/login");
    };

    return (
        <nav className="bg-green-700/0 flex justify-between items-center p-4 gap-x-4">
            <div className="font-bold text-white text-lg">
                <Link to={isLoggedIn ? "/app" : "/"}>CO2Logger</Link>
            </div>
            <div className="flex text-white text-sm gap-x-4">
                {isLoggedIn && (
                    <>
                        <Link 
                        className="hover:underline hover:font-bold active:text-gray-600 active:scale-90"
                        to="/app">Home</Link>
                        <Link 
                        className="hover:underline hover:font-bold active:text-gray-600 active:scale-90"
                        to="/app/dashboard">Dashboard</Link>
                    </>

                )}
                <Link 
                className="hover:underline hover:font-bold active:text-gray-600 active:scale-90" 
                to="/app/leaderboard">Leaderboard</Link>
            </div>
            <div className="flex text-white gap-x-2 text-sm">
                {
                (isLoggedIn && username) ? 
                <>
                    <Link 
                    className="hover:scale-110 active:scale-90 active:text-gray-500 cursor-pointer" 
                    to="/app/profile">{username}</Link>
                    <button 
                    className="bg-red-500 hover:bg-red-600 active:scale-90 active:text-red-700 border-2 rounded-md px-2 py-1" 
                    onClick={handleLogout}>Logout</button>
                </>
                 : 
                <>
                    <button 
                    className="bg-green-500 hover:bg-white hover:text-green-500 active:scale-90 active:bg-gray-600 active:text-green-700 border-2 rounded-md px-2 py-1"
                    onClick={() => navigate("/app/login")}>Login</button>
                    <button 
                    className="bg-white text-green-500 hover:bg-green-500 hover:text-white active:scale-90 active:bg-green-700 active:text-gray-600 border-2 rounded-md px-2 py-1"
                    onClick={() => navigate("/app/register")}>Register</button>
                </>
                }
            </div>
        </nav>
    )
}

export default NavigationBar;