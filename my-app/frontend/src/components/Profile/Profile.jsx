import { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import { useAppContext } from "../../context/authContext";
import { useNavigate } from "react-router-dom";

const Profile = () => {
  const { username, email, setUsername, setEmail, authToken } = useAppContext();
  const [logDate, setLogDate] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const navigate = useNavigate();

  // const authToken = sessionStorage.getItem("auth-token");

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

  // Password change handler
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

      handleToast(data.message || "Password updated successfully");
      event.target.reset(); // Clear form
    } catch (error) {
      console.error("Password change error:", error);
      handleToast(
        error.response?.data?.message || "Something went wrong. Please try again later.", 
        "error"
      );
    } finally {
      setIsLoading(false);
    }
  }, [authToken, apiConfig, handleToast]);

  // Delete all data handler
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

      handleToast(data.message || "All data deleted successfully");
      setLogDate("N/A"); // Reset log date after deletion
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

  // Delete account handler
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

      handleToast(data.message || "Account deleted successfully");

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
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Profile Settings</h1>
          <p className="text-gray-300">Manage your account and data preferences</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
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

          {/* Danger Zone */}
          <section className="bg-gray-800/90 rounded-lg p-6 shadow-lg md:col-span-2 border border-red-500/30">
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