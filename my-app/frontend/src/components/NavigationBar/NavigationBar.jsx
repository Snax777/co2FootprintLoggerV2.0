import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAppContext } from "../../context/authContext";

const NavigationBar = () => {
    const {isLoggedIn, setIsLoggedIn, username, setUsername} = useAppContext();
    const navigate = useNavigate();

    useEffect(() => {
        const authToken = sessionStorage.getItem("authtoken");
        const authExpiry = sessionStorage.getItem("authExpiry");
        const authUsername = sessionStorage.getItem("username");
        const authEmail = sessionStorage.getItem("email");
        const currentTime = (Date.now()).toString();

        if (authToken && authExpiry && authUsername && authEmail) {
            if (currentTime <= authExpiry) {
                setUsername(authUsername);
            } else {
                sessionStorage.removeItem("username");
                sessionStorage.removeItem("authtoken");
                sessionStorage.removeItem("authExpiry");
                sessionStorage.removeItem("email")
                setIsLoggedIn(false);
            }
        } else {
            sessionStorage.removeItem("username");
            sessionStorage.removeItem("authtoken");
            sessionStorage.removeItem("authExpiry");
            sessionStorage.removeItem("email");
            setIsLoggedIn(false);
        }
    }, [isLoggedIn, setIsLoggedIn, setUsername]);

    const handleLogout = () => {
        sessionStorage.removeItem("username");
        sessionStorage.removeItem("authtoken");
        sessionStorage.removeItem("authExpiry");
        sessionStorage.removeItem("email");
        setIsLoggedIn(false);
        setUsername("");

        navigate("/app/login");
    };

    const handleProfile = () => {
        navigate("/app/profile");
    };

    return (
        <div className="bg-green-700 flex h-screen">
            <div className="flex text-white text-xl">
                <p>CO2Logger</p>
            </div>
            <div className="flex text-white">
                {isLoggedIn && (<p 
                className={`hover:underline active:text-gray-600 active:scale-80`} 
                >{isLoggedIn ? "Dashboard" : ""}</p>)}
                <p className={`hover:underline active:text-gray-600 active:scale-80`}>Scoreboard</p>
            </div>
            <div className="flex text-white weight-">
                {(isLoggedIn && username) ?? (

                )}
            </div>
        </div>
    )
}