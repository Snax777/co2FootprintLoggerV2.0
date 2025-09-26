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
        setToast({message, type});
        setTimeout(() => {setToast(null)}, 3750);
    };

    const handleLoggedData = async () => {
        try {
            const { data } = await axios.get(
                `${process.env.REACT_APP_BACKEND_URL}${process.env.REACT_APP_SEARCH_DATA}`, 
                { headers: { Authorization: `Bearer ${authToken}` } }
            );

            if (data.data.length === 0) {
                setLogDate("N/A");
            } else {
                setLogDate(data.data[0].utcDate);
            } 
        } catch {
            setToast("Failed to retrieve last log date. Please try again later.", "error");
            setLogDate("N/A");
        }
    };

    const handlePasswordChange = async (event) => {
        try {
            event.preventDefault();
            setIsLoading(true);

            const { data } = await axios.put(
                `${process.env.REACT_APP_BACKEND_URL}${process.env.REACT_APP_UPDATE_ENDPOINT}`, 
                {
                    oldPassword: event.target.oldPassword.value, 
                    newPassword: event.target.newPassword.value
                }, 
                {
                    headers: { Authorization: `Bearer ${authToken}` }
                }
            );

            handleToast(data.message);
        } catch {
            handleToast(
                "Something wrong has happened. Please try again later.", 
                "error"
            );
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteAllData = async (event) => {
        try {
            event.preventDefault();
            setIsDeleting(true);

            const { data } = await axios.delete(
                `${process.env.REACT_APP_BACKEND_URL}${process.env.REACT_APP_DELETE_ENDPOINT}`, 
                {
                    headers: { Authorization: `Bearer ${authToken}`}, 
                    data: { deleteData: true, deleteUser: false }
                }
            );

            handleToast(data.message);
        } catch {
            handleToast(
                "Unable to delete all logged data. Please try again later.", 
                "error"
            )
        } finally {
            setIsDeleting(false);
        }
    };

    const handleDeleteAccount = async (event) => {
        try {
            event.preventDefault();
            setIsDeleting(true);

            const { data } = await axios.delete(
                `${process.env.REACT_APP_BACKEND_URL}${process.env.REACT_APP_DELETE_ENDPOINT}`, 
                {
                    headers: {Authorization: `Bearer ${authToken}`}, 
                    data: { deleteData: true, deleteUser: true }
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
            handleToast(
                "Unable to delete all logged data. Please try again later.", 
                "error"
            )
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="space-y-8">
            <section>
                <h2 className="text-xl font-bold mb-4">Profile</h2>
                <p><span className="font-semibold">Username: </span>{username}</p>
                <p><span className="font-semibold">Email: </span>{email}</p>
                <p>
                    <span className="font-semibold">Last Log Date:</span>
                    {logDate !== "N/A" ? new Date(logDate).toLocaleDateString() : " N/A"}
                </p>
            </section>
            <section>
                <h2 className="text-xl font-bold mb-4">Change Password</h2>
                <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
                    <input 
                    type="password" 
                    name="oldPassword" 
                    placeholder="Current Password" 
                    className="border rounded px-3 py-2 w-full"
                    required />
                    <input 
                    type="password" 
                    name="newPassword" 
                    placeholder="New Password" 
                    className="border rounded px-3 py-2 w-full"
                    required />
                    <button 
                    type="submit"
                    disabled={isLoading}
                    className=
                    {`
                        bg-green-500 
                        text-white 
                        ${
                            isLoading ? 
                            "cursor-not-allowed scale-80 bg-green-900 text-gray-600" : 
                            "hover:bg-green-400 hover:scale-120 active:scale-80 active:bg-green-900 active:text-gray-600"
                        }`
                    }
                    >
                        {
                            isLoading ? "Changing..." : "Change Password"
                        }
                    </button>
                </form>
            </section>
            <section>
                <h2>Danger Zone</h2>
                <div className="flex gap-4">
                    <button 
                    type="button"
                    disabled={isDeleting}
                    onClick={handleDeleteAllData}
                    className={`
                    bg-amber-600 
                    text-white 
                    ${
                        isDeleting ? 
                        "cursor-not-allowed scale-80 bg-amber-900 text-gray-600" : 
                        "hover:bg-amber-500 hover:scale-120 active:scale-80 active:bg-amber-900 active:text-gray-600" 
                    }`}>
                        {
                            isDeleting ? "Deleting..." : "Delete All Logged Data"
                        }
                    </button>
                    <button 
                    type="button"
                    disabled={isDeleting}
                    onClick={handleDeleteAccount}
                    className={`
                    bg-red-600 
                    text-white 
                    ${
                        isDeleting ? 
                        "cursor-not-allowed scale-80 bg-red-900 text-gray-600" : 
                        "hover:bg-red-500 hover:scale-120 active:scale-80 active:bg-red-900 active:text-gray-600" 
                    }`}>
                        {
                            isDeleting ? "Deleting..." : "Delete Account"
                        }
                    </button>
                </div>
            </section>

            {toast && (
                <div
                className={`
                    fixed 
                    bottom-4 
                    right-4 
                    px-4 
                    py-2 
                    rounded 
                    shadow-lg 
                    text-white 
                    z-50 
                    ${
                        toast.type === "success" ? "bg-green-500" : "bg-red-500"
                    }
                `}>
                    {
                        toast.message
                    }
                </div>
            )}
        </div>
    )
};

export default Profile;