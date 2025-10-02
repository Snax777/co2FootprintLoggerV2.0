import { useCallback, useMemo, useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAppContext } from "../../context/authContext";
import { websocketClient } from "../../services/websocketClient"; // Import WebSocket client

const NavigationBar = () => {
    const { 
        isLoggedIn, 
        username, 
        clearAuthSession,
        authLoading,
        webSocketConnected
    } = useAppContext();
    
    const navigate = useNavigate();
    const location = useLocation();
    const [notifications, setNotifications] = useState([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    const handleLogout = useCallback(() => {
        // Clear WebSocket connection on logout
        if (websocketClient) {
            websocketClient.disconnect();
        }
        navigate("/app/login");
        clearAuthSession();
    }, [clearAuthSession, navigate]);

    const handleLogin = useCallback(() => {
        navigate("/app/login");
    }, [navigate]);

    const handleRegister = useCallback(() => {
        navigate("/app/register");
    }, [navigate]);

    // ✅ NEW: Setup WebSocket notification handlers
    const setupWebSocketHandlers = useCallback(() => {
        if (!websocketClient || !isLoggedIn) return;

        // Handle goal completion notifications
        websocketClient.on('goal-completed', (data) => {
            const newNotification = {
                id: Date.now(),
                type: 'goal',
                message: data.message,
                timestamp: new Date().toLocaleTimeString(),
                read: false,
                data: data
            };
            
            setNotifications(prev => [newNotification, ...prev.slice(0, 9)]); // Keep last 10
            setUnreadCount(prev => prev + 1);
        });

        // Handle streak achievements
        websocketClient.on('co2-data-added', (data) => {
            if (data.streak?.isNewRecord) {
                const newNotification = {
                    id: Date.now(),
                    type: 'streak',
                    message: `New streak record! ${data.streak.current} days in a row!`,
                    timestamp: new Date().toLocaleTimeString(),
                    read: false,
                    data: data
                };
                
                setNotifications(prev => [newNotification, ...prev.slice(0, 9)]);
                setUnreadCount(prev => prev + 1);
            }
        });

        // Handle leaderboard rank improvements
        websocketClient.on('leaderboard-updated', (data) => {
            // This would be more sophisticated in a real app - checking if user's rank improved
            const newNotification = {
                id: Date.now(),
                type: 'leaderboard',
                message: "Leaderboard updated with new rankings",
                timestamp: new Date().toLocaleTimeString(),
                read: false,
                data: data
            };
            
            setNotifications(prev => [newNotification, ...prev.slice(0, 9)]);
            setUnreadCount(prev => prev + 1);
        });

    }, [isLoggedIn]);

    // ✅ NEW: Toggle notifications dropdown
    const toggleNotifications = useCallback(() => {
        setShowNotifications(prev => !prev);
        if (!showNotifications && unreadCount > 0) {
            // Mark all as read when opening
            setNotifications(prev => prev.map(notif => ({ ...notif, read: true })));
            setUnreadCount(0);
        }
    }, [showNotifications, unreadCount]);

    // ✅ NEW: Clear all notifications
    const clearNotifications = useCallback(() => {
        setNotifications([]);
        setUnreadCount(0);
        setShowNotifications(false);
    }, []);

    // ✅ NEW: Clear old notifications (older than 1 hour)
    useEffect(() => {
        const interval = setInterval(() => {
            setNotifications(prev => 
                prev.filter(notif => Date.now() - notif.id < 3600000) // 1 hour
            );
        }, 60000); // Check every minute

        return () => clearInterval(interval);
    }, []);

    // Set up WebSocket handlers when component mounts or login status changes
    useEffect(() => {
        if (isLoggedIn) {
            setupWebSocketHandlers();
        }

        // Cleanup WebSocket handlers on unmount
        return () => {
            if (websocketClient) {
                websocketClient.off('goal-completed');
                websocketClient.off('co2-data-added');
                websocketClient.off('leaderboard-updated');
            }
        };
    }, [isLoggedIn, setupWebSocketHandlers]);

    const navigationItems = useMemo(() => [
        { 
            to: isLoggedIn ? "/app" : "/", 
            label: "Home",
            show: true,
            icon: "🏠"
        },
        { 
            to: "/app/loggerChart", 
            label: "Analytics",
            show: isLoggedIn,
            icon: "📊"
        },
        { 
            to: "/app/leaderboard", 
            label: "Leaderboard",
            show: true,
            icon: "🏆"
        }
    ], [isLoggedIn]);

    const isActivePath = useCallback((path) => {
        return location.pathname === path;
    }, [location.pathname]);

    // ✅ NEW: Get notification icon based on type
    const getNotificationIcon = useCallback((type) => {
        switch (type) {
            case 'goal': return '🎯';
            case 'streak': return '🔥';
            case 'leaderboard': return '📈';
            default: return '🔔';
        }
    }, []);

    // ✅ NEW: Get notification color based on type
    const getNotificationColor = useCallback((type) => {
        switch (type) {
            case 'goal': return 'text-green-600 bg-green-50 border-green-200';
            case 'streak': return 'text-orange-600 bg-orange-50 border-orange-200';
            case 'leaderboard': return 'text-blue-600 bg-blue-50 border-blue-200';
            default: return 'text-gray-600 bg-gray-50 border-gray-200';
        }
    }, []);

    if (authLoading) {
        return (
            <nav className="bg-gradient-to-r from-green-700 to-green-800 flex justify-between items-center p-4 gap-6 shadow-lg sticky top-0 z-50">
                <div className="font-bold text-white text-2xl md:text-3xl">CO₂Logger</div>
                <div className="flex items-center gap-2 text-white">
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Loading...
                </div>
            </nav>
        );
    }

    return (
        <nav className="bg-gradient-to-r from-green-700 to-green-800 flex justify-between items-center p-4 gap-6 shadow-lg sticky top-0 z-50">
            {/* Logo/Brand */}
            <div className="font-bold text-white text-2xl md:text-3xl whitespace-nowrap">
                <Link 
                    to={isLoggedIn ? "/app" : "/"} 
                    className="hover:text-green-200 transition-colors duration-200 flex items-center gap-2"
                >
                    <span className="text-green-300">🌱</span>
                    CO₂Logger
                </Link>
            </div>

            {/* Navigation Links */}
            <div className="flex items-center gap-6 text-white text-sm md:text-base flex-1 justify-center">
                {navigationItems.map((item) => 
                    item.show && (
                        <Link
                            key={item.to}
                            to={item.to}
                            className={`flex items-center gap-2 hover:underline hover:font-semibold active:scale-95 transition-all duration-200 px-3 py-2 rounded-lg ${
                                isActivePath(item.to) 
                                    ? "font-bold text-green-200 bg-green-900/50 shadow-inner" 
                                    : "text-white hover:bg-green-700/50"
                            }`}
                        >
                            <span className="text-lg">{item.icon}</span>
                            {item.label}
                        </Link>
                    )
                )}
            </div>

            {/* Right Side - User Actions */}
            <div className="flex items-center gap-3 text-white text-sm md:text-base">
                {isLoggedIn && username ? (
                    <>
                        {/* ✅ NEW: WebSocket Status Indicator */}
                        {webSocketConnected && (
                            <div className="flex items-center gap-2 px-3 py-1 bg-green-600/50 rounded-full border border-green-400/30">
                                <div className="w-2 h-2 bg-green-300 rounded-full animate-pulse"></div>
                                <span className="text-xs font-medium">Live</span>
                            </div>
                        )}

                        {/* ✅ NEW: Notifications Dropdown */}
                        {notifications.length > 0 && (
                            <div className="relative">
                                <button
                                    onClick={toggleNotifications}
                                    className="relative p-2 hover:bg-green-700/50 rounded-lg transition-colors duration-200"
                                    title="Notifications"
                                >
                                    <span className="text-xl">🔔</span>
                                    {unreadCount > 0 && (
                                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
                                            {unreadCount}
                                        </span>
                                    )}
                                </button>

                                {showNotifications && (
                                    <div className="absolute right-0 top-12 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 animate-fade-in">
                                        {/* Notifications Header */}
                                        <div className="flex justify-between items-center p-4 border-b border-gray-200">
                                            <h3 className="font-bold text-gray-800">Notifications</h3>
                                            <div className="flex items-center gap-2">
                                                {unreadCount > 0 && (
                                                    <span className="text-xs bg-red-500 text-white px-2 py-1 rounded-full">
                                                        {unreadCount} new
                                                    </span>
                                                )}
                                                <button
                                                    onClick={clearNotifications}
                                                    className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                                                >
                                                    Clear all
                                                </button>
                                            </div>
                                        </div>

                                        {/* Notifications List */}
                                        <div className="max-h-96 overflow-y-auto">
                                            {notifications.length === 0 ? (
                                                <div className="p-8 text-center text-gray-500">
                                                    <div className="text-4xl mb-2">🔔</div>
                                                    <p>No notifications</p>
                                                    <p className="text-sm mt-1">Updates will appear here</p>
                                                </div>
                                            ) : (
                                                notifications.map((notification) => (
                                                    <div
                                                        key={notification.id}
                                                        className={`p-4 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors ${getNotificationColor(notification.type)}`}
                                                    >
                                                        <div className="flex items-start gap-3">
                                                            <span className="text-2xl flex-shrink-0">
                                                                {getNotificationIcon(notification.type)}
                                                            </span>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm font-medium text-gray-900">
                                                                    {notification.message}
                                                                </p>
                                                                <p className="text-xs text-gray-500 mt-1">
                                                                    {notification.timestamp}
                                                                </p>
                                                            </div>
                                                            {!notification.read && (
                                                                <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2"></div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>

                                        {/* Notifications Footer */}
                                        <div className="p-3 bg-gray-50 rounded-b-xl border-t border-gray-200">
                                            <p className="text-xs text-gray-500 text-center">
                                                Real-time updates from CO₂Logger
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* User Profile Link */}
                        <Link
                            to="/app/profile"
                            className="flex items-center gap-2 hover:text-green-200 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer font-medium px-3 py-2 rounded-lg hover:bg-green-700/50"
                            title={`View ${username}'s profile`}
                        >
                            <span className="text-lg">👤</span>
                            <span className="hidden sm:inline">{username}</span>
                        </Link>

                        {/* Logout Button */}
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-2 border-2 rounded-lg px-4 py-2 transition-all duration-200 font-medium bg-red-500 hover:bg-red-600 active:bg-red-700 border-red-600 text-white hover:scale-105 active:scale-95"
                        >
                            <span className="text-lg">🚪</span>
                            <span className="hidden sm:inline">Logout</span>
                        </button>
                    </>
                ) : (
                    <>
                        {/* Login/Register for non-authenticated users */}
                        <button
                            onClick={handleLogin}
                            className="flex items-center gap-2 border-2 rounded-lg px-4 py-2 transition-all duration-200 font-medium bg-green-500 hover:bg-white hover:text-green-500 border-green-400 text-white hover:scale-105 active:scale-95"
                        >
                            <span className="text-lg">🔑</span>
                            <span className="hidden sm:inline">Login</span>
                        </button>
                        <button
                            onClick={handleRegister}
                            className="flex items-center gap-2 border-2 rounded-lg px-4 py-2 transition-all duration-200 font-medium bg-white text-green-500 hover:bg-green-500 hover:text-white border-green-400 hover:scale-105 active:scale-95"
                        >
                            <span className="text-lg">📝</span>
                            <span className="hidden sm:inline">Register</span>
                        </button>
                    </>
                )}
            </div>

            {/* ✅ NEW: Click outside to close notifications */}
            {showNotifications && (
                <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowNotifications(false)}
                />
            )}
        </nav>
    );
};

export default NavigationBar;