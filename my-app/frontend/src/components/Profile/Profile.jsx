import { useState, useEffect } from "react";
import axios from "axios";
import { useAppContext } from "../../context/authContext";
import { useNavigate } from "react-router-dom";

const Profile = () => {
  const { username, email, setUsername, setEmail } = useAppContext();
  const [logDate, setLogDate] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const navigate = useNavigate();

  const authToken = sessionStorage.getItem("auth-token");

  useEffect(() => {
    handleLoggedData();
  }, []);

  const handleToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3750);
  };

  const handleLoggedData = async () => {
    try {
      const { data } = await axios.get(
        `${import.meta.env.VITE_BACKEND_URL}${import.meta.env.VITE_SEARCH_DATA}`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );

      if (data.data.length === 0) {
        setLogDate("N/A");
      } else {
        setLogDate(data.data[0].utcDate);
      }
    } catch {
      handleToast("Failed to retrieve last log date. Please try again later.", "error");
      setLogDate("N/A");
    }
  };

  const handlePasswordChange = async (event) => {
    try {
      event.preventDefault();
      setIsLoading(true);

      const { data } = await axios.put(
        `${import.meta.env.VITE_BACKEND_URL}${import.meta.env.VITE_UPDATE_ENDPOINT}`,
        {
          oldPassword: event.target.oldPassword.value,
          newPassword: event.target.newPassword.value,
        },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );

      handleToast(data.message);
    } catch {
      handleToast("Something wrong has happened. Please try again later.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAllData = async (event) => {
    try {
      event.preventDefault();
      setIsDeleting(true);

      const { data } = await axios.delete(
        `${import.meta.env.VITE_BACKEND_URL}${import.meta.env.VITE_DELETE_ENDPOINT}`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
          data: { deleteData: true, deleteUser: false },
        }
      );

      handleToast(data.message);
    } catch {
      handleToast("Unable to delete all logged data. Please try again later.", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteAccount = async (event) => {
    try {
      event.preventDefault();
      setIsDeleting(true);

      const { data } = await axios.delete(
        `${import.meta.env.VITE_BACKEND_URL}${import.meta.env.VITE_DELETE_ENDPOINT}`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
          data: { deleteData: true, deleteUser: true },
        }
      );

      if (!data.deletionsSuccessful) {
        handleToast(data.message, "error");
      } else {
        handleToast(data.message);

        setTimeout(() => {
          sessionStorage.clear();
          setEmail("");
          setUsername("");
          navigate("/");
        }, 2000);
      }
    } catch {
      handleToast("Unable to delete account. Please try again later.", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="bg-gray-600/50 text-white min-h-screen flex items-center justify-center py-10">
        <div className="space-y-8 max-w-2xl w-full">
            <section className="shadow rounded p-6 bg-gray-800/0 text-center">
                <h2 className="text-xl font-bold mb-4">Profile</h2>
                <p><span className="font-semibold">Username:</span> {username}</p>
                <p><span className="font-semibold">Email:</span> {email}</p>
                <p>
                <span className="font-semibold">Last Log Date:</span>{" "}
                {logDate !== "N/A" ? new Date(logDate).toLocaleDateString() : "N/A"}
                </p>
            </section>

            <section className="shadow rounded p-6 bg-gray-800/0 text-center">
                <h2 className="text-xl font-bold mb-4">Change Password</h2>
                <form
                onSubmit={handlePasswordChange}
                className="space-y-4 max-w-md mx-auto"
                >
                <input
                    type="password"
                    name="oldPassword"
                    placeholder="Current Password"
                    className="border rounded px-3 py-2 w-full bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-green-400"
                    required
                />
                <input
                    type="password"
                    name="newPassword"
                    placeholder="New Password"
                    className="border rounded px-3 py-2 w-full bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-green-400"
                    required
                />
                <button
                    type="submit"
                    disabled={isLoading}
                    className={`bg-green-500 text-white rounded px-4 py-2 transition ${
                    isLoading
                        ? "cursor-not-allowed opacity-70"
                        : "hover:bg-green-400 active:bg-green-700"
                    }`}
                >
                    {isLoading ? "Changing..." : "Change Password"}
                </button>
                </form>
            </section>

            <section className="shadow rounded p-6 bg-gray-800/0 text-center">
                <h2 className="text-xl font-bold mb-4 text-red-500">Danger Zone</h2>
                <div className="flex justify-center gap-4">
                <button
                    type="button"
                    disabled={isDeleting}
                    onClick={handleDeleteAllData}
                    className={`bg-amber-600 text-white rounded px-4 py-2 transition ${
                    isDeleting
                        ? "cursor-not-allowed opacity-70"
                        : "hover:bg-amber-500 active:bg-amber-700"
                    }`}
                >
                    {isDeleting ? "Deleting..." : "Delete All Logged Data"}
                </button>

                <button
                    type="button"
                    disabled={isDeleting}
                    onClick={handleDeleteAccount}
                    className={`bg-red-600 text-white rounded px-4 py-2 transition ${
                    isDeleting
                        ? "cursor-not-allowed opacity-70"
                        : "hover:bg-red-500 active:bg-red-700"
                    }`}
                >
                    {isDeleting ? "Deleting..." : "Delete Account"}
                </button>
                </div>
            </section>

            {toast && (
                <div
                className={`fixed bottom-4 right-4 px-4 py-2 rounded shadow-lg text-white z-50 ${
                    toast.type === "success" ? "bg-green-500" : "bg-red-500"
                }`}
                >
                {toast.message}
                </div>
            )}
        </div>
    </div>
    );
};

export default Profile;