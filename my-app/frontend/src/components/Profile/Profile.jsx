import { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import { useAppContext } from "../../context/authContext";
import { useNavigate } from "react-router-dom";
import { websocketClient } from "../../services/websocketClient"; // Import WebSocket client

const Profile = () => {
  const { username, email, setUsername, setEmail, authToken, webSocketConnected } = useAppContext();
  const [logDate, setLogDate] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [realTimeUpdates, setRealTimeUpdates] = useState([]); // For WebSocket notifications
  const navigate = useNavigate();

  // Memoized toast handler
  const handleToast = useCallback((message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3750);
  }, []);

  // Memoized API configuration
  const apiConfig = useMemo(() => ({
    headers: { 
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    }
  }), [authToken]);

  // ✅ NEW: WebSocket notification handler
  const setupWebSocketHandlers = useCallback(() => {
    if (!websocketClient || !webSocketConnected) return;

    // Handle password update notifications
    websocketClient.on('password-updated', (data) => {
      setRealTimeUpdates(prev => [...prev, {
        id: Date.now(),
        type: 'security',
        message: data.message,
        timestamp: new Date().toLocaleTimeString()
      }]);
      
      // Show a subtle notification for security events
      handleToast("Security: Password updated successfully", "success");
    });

    // Handle data deletion notifications
    websocketClient.on('data-deleted', (data) => {
      setRealTimeUpdates(prev => [...prev, {
        id: Date.now(),
        type: 'data',
        message: `Deleted ${data.recordsDeleted} data records`,
        timestamp: new Date().toLocaleTimeString()
      }]);
    });

    // Handle account deletion notifications
    websocketClient.on('account-deleted', (data) => {
      setRealTimeUpdates(prev => [...prev, {
        id: Date.now(),
        type: 'account',
        message: data.message,
        timestamp: new Date().toLocaleTimeString()
      }]);
      
      // Show farewell message
      handleToast("Account deleted successfully. Thank you for using CO₂Logger!", "success");
    });

    // Handle connection status changes
    websocketClient.on('connection-lost', (data) => {
      handleToast("Real-time features temporarily unavailable", "error");
    });

    websocketClient.on('connected', (data) => {
      setRealTimeUpdates(prev => [...prev, {
        id: Date.now(),
        type: 'connection',
        message: "Real-time features connected",
        timestamp: new Date().toLocaleTimeString()
      }]);
    });

  }, [handleToast, webSocketConnected]);

  // ✅ NEW: Clear old real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setRealTimeUpdates(prev => 
        prev.filter(update => 
          Date.now() - update.id < 30000 // Keep only updates from last 30 seconds
        )
      );
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Set up WebSocket handlers when component mounts or connection status changes
  useEffect(() => {
    setupWebSocketHandlers();

    // Cleanup WebSocket handlers on unmount
    return () => {
      if (websocketClient) {
        websocketClient.off('password-updated');
        websocketClient.off('data-deleted');
        websocketClient.off('account-deleted');
        websocketClient.off('connection-lost');
        websocketClient.off('connected');
      }
    };
  }, [setupWebSocketHandlers]);

  // Fetch logged data
  const handleLoggedData = useCallback(async () => {
    if (!authToken) {
      handleToast("Please log in to view profile data", "error");
      return;
    }

    try {
      const { data } = await axios.get(
        `${import.meta.env.VITE_BACKEND_URL}${import.meta.env.VITE_SEARCH_DATA}`,
        apiConfig
      );

      setLogDate(data.data[0].utcDate || "N/A");
    } catch (error) {
      if (email && authToken) {
        handleToast(
          error.response?.data?.message || "Failed to retrieve last log date. Please log your activities", 
          "error"
        );
      }
      
      setLogDate("N/A");
    }
  }, [authToken, apiConfig, handleToast, email]);

  // ✅ ENHANCED: Password change handler with WebSocket feedback
  const handlePasswordChange = useCallback(async (event) => {
    event.preventDefault();
    
    if (!authToken || !username || !email) {
      handleToast("Please log in to change password", "error");
      return;
    }

    setIsLoading(true);
    
    try {
      const formData = new FormData(event.target);
      const payload = {
        oldPassword: formData.get("oldPassword"),
        newPassword: formData.get("newPassword"),
      };

      const { data } = await axios.put(
        `${import.meta.env.VITE_BACKEND_URL}${import.meta.env.VITE_UPDATE_ENDPOINT}`,
        payload,
        apiConfig
      );

      // The WebSocket notification will be handled by the WebSocket handler above
      handleToast(data.message || "Password updated successfully");
      event.target.reset(); // Clear form
      
      // ✅ NEW: Add local real-time update
      setRealTimeUpdates(prev => [...prev, {
        id: Date.now(),
        type: 'security',
        message: "Password changed successfully",
        timestamp: new Date().toLocaleTimeString()
      }]);

    } catch (error) {
      console.error("Password change error:", error);
      handleToast(
        error.response?.data?.message || "Something went wrong. Please try again later.", 
        "error"
      );
    } finally {
      setIsLoading(false);
    }
  }, [authToken, apiConfig, handleToast, username, email]);

  // ✅ ENHANCED: Delete all data handler with WebSocket feedback
  const handleDeleteAllData = useCallback(async () => {
    if (!authToken) {
      handleToast("Please log in to delete data", "error");
      return;
    }

    if (!window.confirm("Are you sure you want to delete all your logged data? This action cannot be undone.")) {
      return;
    }

    setIsDeleting(true);
    
    try {
      const { data } = await axios.delete(
        `${import.meta.env.VITE_BACKEND_URL}${import.meta.env.VITE_DELETE_ENDPOINT}`,
        {
          ...apiConfig,
          data: { deleteData: true, deleteUser: false },
        }
      );

      // The WebSocket notification will be handled by the WebSocket handler above
      handleToast(data.message || "All data deleted successfully");
      setLogDate("N/A"); // Reset log date after deletion

      // ✅ NEW: Add local real-time update
      setRealTimeUpdates(prev => [...prev, {
        id: Date.now(),
        type: 'data',
        message: `Deleted ${data.deletionsSuccessful?.data?.recordsDeleted || 0} data records`,
        timestamp: new Date().toLocaleTimeString()
      }]);

    } catch (error) {
      console.error("Delete data error:", error);
      handleToast(
        error.response?.data?.message || "Unable to delete logged data. Please try again later.", 
        "error"
      );
    } finally {
      setIsDeleting(false);
    }
  }, [authToken, apiConfig, handleToast]);

  // ✅ ENHANCED: Delete account handler with WebSocket feedback
  const handleDeleteAccount = useCallback(async () => {
    if (!authToken) {
      handleToast("Please log in to delete account", "error");
      return;
    }

    const confirmation = window.confirm(
      "Are you absolutely sure you want to delete your account? This will permanently delete all your data and cannot be undone."
    );
    
    if (!confirmation) return;

    setIsDeleting(true);
    
    try {
      const { data } = await axios.delete(
        `${import.meta.env.VITE_BACKEND_URL}${import.meta.env.VITE_DELETE_ENDPOINT}`,
        {
          ...apiConfig,
          data: { deleteData: true, deleteUser: true },
        }
      );

      if (!data.deletionsSuccessful) {
        handleToast(data.message || "Account deletion failed", "error");
        return;
      }

      // The WebSocket notification will be handled by the WebSocket handler above
      handleToast(data.message || "Account deleted successfully");

      // ✅ NEW: Add local real-time update before redirect
      setRealTimeUpdates(prev => [...prev, {
        id: Date.now(),
        type: 'account',
        message: "Account deletion completed",
        timestamp: new Date().toLocaleTimeString()
      }]);

      // Clear session and redirect
      setTimeout(() => {
        sessionStorage.clear();
        setEmail("");
        setUsername("");
        navigate("/");
      }, 2000);
    } catch (error) {
      console.error("Delete account error:", error);
      handleToast(
        error.response?.data?.message || "Unable to delete account. Please try again later.", 
        "error"
      );
    } finally {
      setIsDeleting(false);
    }
  }, [authToken, apiConfig, handleToast, setEmail, setUsername, navigate]);

  // Load profile data on component mount
  useEffect(() => {
    handleLoggedData();
  }, [handleLoggedData]);

  // Memoized formatted log date
  const formattedLogDate = useMemo(() => {
    if (logDate === "N/A" || !logDate) return "N/A";
    
    try {
      return new Date(logDate).toLocaleDateString('en-GB', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return "Invalid Date";
    }
  }, [logDate]);

  // Loading state
  if (!username || !email) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-600/50">
        <div className="text-white text-center">
          <p className="text-xl">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-600/50 text-white min-h-screen py-10">
      <div className="container mx-auto px-4 max-w-6xl"> {/* Increased max-width */}
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Profile Settings</h1>
          <p className="text-gray-300">Manage your account and data preferences</p>
          
          {/* ✅ NEW: WebSocket Status Indicator */}
          <div className="flex justify-center items-center mt-4 space-x-4">
            <div className={`flex items-center px-3 py-1 rounded-full text-sm ${
              webSocketConnected 
                ? 'bg-green-500/20 text-green-400 border border-green-400/30' 
                : 'bg-yellow-500/20 text-yellow-400 border border-yellow-400/30'
            }`}>
              <div className={`w-2 h-2 rounded-full mr-2 ${
                webSocketConnected ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'
              }`}></div>
              {webSocketConnected ? 'Real-time Active' : 'Real-time Offline'}
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Profile Information */}
          <section className="bg-gray-800/90 rounded-lg p-6 shadow-lg">
            <h2 className="text-xl font-bold mb-4 text-green-400">Profile Information</h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-gray-700">
                <span className="font-semibold">Username:</span>
                <span className="text-gray-300">{username}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-700">
                <span className="font-semibold">Email:</span>
                <span className="text-gray-300">{email}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-700">
                <span className="font-semibold">Last Activity:</span>
                <span className="text-gray-300">{formattedLogDate}</span>
              </div>
            </div>
          </section>

          {/* Change Password */}
          <section className="bg-gray-800/90 rounded-lg p-6 shadow-lg">
            <h2 className="text-xl font-bold mb-4 text-blue-400">Change Password</h2>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label htmlFor="oldPassword" className="block text-sm font-medium mb-2">
                  Current Password
                </label>
                <input
                  id="oldPassword"
                  name="oldPassword"
                  type="password"
                  placeholder="Enter current password"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  required
                  minLength={6}
                />
              </div>
              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium mb-2">
                  New Password
                </label>
                <input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  placeholder="Enter new password"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  required
                  minLength={6}
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full py-2 px-4 rounded font-medium transition ${
                  isLoading
                    ? "bg-gray-600 cursor-not-allowed opacity-50"
                    : "bg-blue-600 hover:bg-blue-500 active:bg-blue-700"
                }`}
              >
                {isLoading ? "Updating Password..." : "Update Password"}
              </button>
            </form>
          </section>

          {/* ✅ NEW: Real-time Activity Feed */}
          <section className="bg-gray-800/90 rounded-lg p-6 shadow-lg">
            <h2 className="text-xl font-bold mb-4 text-purple-400">Recent Activity</h2>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {realTimeUpdates.length === 0 ? (
                <div className="text-center text-gray-400 py-4">
                  <p>No recent activity</p>
                  <p className="text-sm mt-1">Security and data changes will appear here</p>
                </div>
              ) : (
                realTimeUpdates.slice(-5).reverse().map((update) => (
                  <div 
                    key={update.id}
                    className={`p-3 rounded border-l-4 ${
                      update.type === 'security' ? 'border-l-green-500 bg-green-500/10' :
                      update.type === 'data' ? 'border-l-amber-500 bg-amber-500/10' :
                      update.type === 'account' ? 'border-l-red-500 bg-red-500/10' :
                      'border-l-blue-500 bg-blue-500/10'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <p className="text-sm">{update.message}</p>
                      <span className="text-xs text-gray-400 ml-2 whitespace-nowrap">
                        {update.timestamp}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            {/* WebSocket Connection Status */}
            <div className="mt-4 pt-4 border-t border-gray-700">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Connection Status:</span>
                <span className={`font-medium ${
                  webSocketConnected ? 'text-green-400' : 'text-yellow-400'
                }`}>
                  {webSocketConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>
          </section>

          {/* Danger Zone */}
          <section className="bg-gray-800/90 rounded-lg p-6 shadow-lg lg:col-span-3 border border-red-500/30">
            <h2 className="text-xl font-bold mb-4 text-red-400">Danger Zone</h2>
            <p className="text-gray-300 mb-6">
              These actions are irreversible. Please proceed with caution.
            </p>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-red-900/20 p-4 rounded border border-red-500/30">
                <h3 className="font-semibold text-red-400 mb-2">Delete All Data</h3>
                <p className="text-sm text-gray-300 mb-4">
                  Permanently remove all your logged CO₂ data. Your account will remain active.
                </p>
                <button
                  onClick={handleDeleteAllData}
                  disabled={isDeleting}
                  className={`w-full py-2 px-4 rounded font-medium transition ${
                    isDeleting
                      ? "bg-gray-600 cursor-not-allowed opacity-50"
                      : "bg-amber-600 hover:bg-amber-500 active:bg-amber-700"
                  }`}
                >
                  {isDeleting ? "Deleting Data..." : "Delete All Data"}
                </button>
              </div>

              <div className="bg-red-900/20 p-4 rounded border border-red-500/30">
                <h3 className="font-semibold text-red-400 mb-2">Delete Account</h3>
                <p className="text-sm text-gray-300 mb-4">
                  Permanently delete your account and all associated data. This cannot be undone.
                </p>
                <button
                  onClick={handleDeleteAccount}
                  disabled={isDeleting}
                  className={`w-full py-2 px-4 rounded font-medium transition ${
                    isDeleting
                      ? "bg-gray-600 cursor-not-allowed opacity-50"
                      : "bg-red-600 hover:bg-red-500 active:bg-red-700"
                  }`}
                >
                  {isDeleting ? "Deleting Account..." : "Delete Account"}
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* Toast Notification */}
        {toast && (
          <div
            className={`fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg text-white font-medium z-50 transition-all duration-300 ${
              toast.type === "success" 
                ? "bg-green-500 border border-green-400" 
                : "bg-red-500 border border-red-400"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">
                {toast.type === "success" ? "✓" : "⚠"}
              </span>
              <span>{toast.message}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;