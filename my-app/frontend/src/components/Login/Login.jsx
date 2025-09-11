import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../../context/authContext";
import axios from "axios";

const backendUrl = process.env.REACT_APP_BACKEND_URL;

const Login = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { setIsLoggedIn } = useAppContext();
    const navigate = useNavigate();

    const handleLogin = async (event) => {
        try {
            event.preventDefault();
            setIsSubmitting(true);

            const { data } = await axios.post(
                `${backendUrl}${process.env.REACT_APP_LOGIN_ENDPOINT}`, 
                {email, password},
            );

            if (data.authtoken) {
                sessionStorage.setItem("username", data.username);
                sessionStorage.setItem("email", data.email);
                sessionStorage.setItem("authtoken", data.authtoken);
                sessionStorage.setItem("authExpiry", data.expiresAt.toString());
                
                setIsLoggedIn(true);
                navigate("/app");
            } else if (data.error) {
                setErrorMessage(data.error);
                setTimeout(() => setErrorMessage(""), 5000);
            }
        } catch {
            setErrorMessage("Something wrong happened. Try again later.");
            setTimeout(() => setErrorMessage(""), 5000);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex h-screen">
            <form 
            onSubmit={handleLogin} 
            className="flex flex-col bg-gray-600 opacity-70 text-white mx-auto my-auto rounded-md p-4">
                <p className="text-lg font-bold mb-4">
                    Login
                </p>

                <label htmlFor="email" className="font-light text-sm mb-1.5">Email</label>
                <input 
                id="email"
                disabled={isSubmitting}
                className="bg-gray-300 text-green-900 mb-1.5 rounded-sm" 
                type="email" 
                value={email} 
                placeholder="Email" 
                onChange={(event) => setEmail(event.target.value)}
                />
                <label htmlFor="password" className="font-light text-sm mb-2.5">Password</label>
                <input 
                id="password"
                disabled={isSubmitting}
                className="bg-gray-300 text-green-900 mb-1.5 rounded-sm" 
                type="password" 
                value={password} 
                placeholder="Password" 
                onChange={(event) => setPassword(event.target.value)}
                />

                <button 
                id="login"
                disabled={isSubmitting}
                className="bg-green-500 text-white hover:scale-110 border-black rounded-md active:bg-white active:text-green-500 active:scale-80" 
                type="submit">
                    {isSubmitting ? "Logging..." : "Login"}
                </button>
                
                <p className="text-white text-lg">Are you a new user?
                    <a 
                    href="/app/register"
                    className="hover:text-green-400 text-lg underline active:text-green-800 active:scale-75 visited:text-white">
                        Register now.
                    </a>
                </p>
            </form>

            {
            errorMessage && 
            <div className="bg-red-300 text-red-800 border-red-700 p-2 mt-4 rounded-lg transition-opacity duration-300">
                {errorMessage}
            </div>
            }
        </div>
    )
};

export default Login;