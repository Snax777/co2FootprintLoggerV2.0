import { useCallback, useMemo } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAppContext } from "../../context/authContext";

const NavigationBar = () => {
    const { 
        isLoggedIn, 
        username, 
        clearAuthSession,
        authLoading 
    } = useAppContext();
    
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = useCallback(() => {
        navigate("/app/login");
        clearAuthSession();
    }, [clearAuthSession, navigate]);

    const handleLogin = useCallback(() => {
        navigate("/app/login");
    }, [navigate]);

    const handleRegister = useCallback(() => {
        navigate("/app/register");
    }, [navigate]);

    const navigationItems = useMemo(() => [
        { 
            to: isLoggedIn ? "/app" : "/", 
            label: "Home",
            show: true
        },
        { 
            to: "/app/loggerChart", 
            label: "Logger",
            show: isLoggedIn
        },
        { 
            to: "/app/leaderboard", 
            label: "Leaderboard",
            show: true
        }
    ], [isLoggedIn]);

    const isActivePath = useCallback((path) => {
        return location.pathname === path;
    }, [location.pathname]);

    if (authLoading) {
        return (
            <nav className="bg-green-800 flex justify-between items-center p-4 gap-6 shadow-lg">
                <div className="font-bold text-white text-2xl md:text-3xl">CO₂Logger</div>
                <div className="text-white">Loading...</div>
            </nav>
        );
    }

    return (
        <nav className="bg-green-800 flex justify-between items-center p-4 gap-6 shadow-lg">
            <div className="font-bold text-white text-2xl md:text-3xl whitespace-nowrap">
                <Link 
                    to={isLoggedIn ? "/app" : "/"} 
                    className="hover:text-green-200 transition-colors duration-200"
                >
                    CO₂Logger
                </Link>
            </div>

            <div className="flex items-center gap-4 text-white text-sm md:text-base flex-1 justify-center">
                {navigationItems.map((item) => 
                    item.show && (
                        <Link
                            key={item.to}
                            to={item.to}
                            className={`hover:underline hover:font-semibold active:scale-95 transition-all duration-200 ${
                                isActivePath(item.to) ? "font-bold underline text-green-200" : "text-white"
                            }`}
                        >
                            {item.label}
                        </Link>
                    )
                )}
            </div>

            <div className="flex items-center gap-3 text-white text-sm md:text-base">
                {isLoggedIn && username ? (
                    <>
                        <Link
                            to="/app/profile"
                            className="hover:text-green-200 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer font-medium"
                            title={`View ${username}'s profile`}
                        >
                            👤 {username}
                        </Link>
                        <button
                            onClick={handleLogout}
                            className="border-2 rounded-md px-3 py-2 transition-all duration-200 font-medium bg-red-500 hover:bg-red-600 active:bg-red-700 border-red-600 text-white"
                        >
                            Logout
                        </button>
                    </>
                ) : (
                    <>
                        <button
                            onClick={handleLogin}
                            className="border-2 rounded-md px-3 py-2 transition-all duration-200 font-medium bg-green-500 hover:bg-white hover:text-green-500 border-green-400 text-white"
                        >
                            Login
                        </button>
                        <button
                            onClick={handleRegister}
                            className="border-2 rounded-md px-3 py-2 transition-all duration-200 font-medium bg-white text-green-500 hover:bg-green-500 hover:text-white border-green-400"
                        >
                            Register
                        </button>
                    </>
                )}
            </div>
        </nav>
    );
};

export default NavigationBar;