import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../../context/authContext";
import axios from "axios";

const backendUrl = process.env.REACT_APP_BACKEND_URL;

const Register = () => {
    const [name, setName] = useState("");
    const [surname, setSurname] = useState("");
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { setIsLoggedIn } = useAppContext();
    const navigate = useNavigate();

    const handleRegister = async (event) => {
        try {
            event.preventDefault();
            setIsSubmitting(true);

            const {data} = await axios.post(
                `${backendUrl}${process.env.REACT_APP_REGISTER_ENDPOINT}`, 
                {name, surname, username, email, password},
            );

            if (data.authtoken) {
                sessionStorage.setItem('auth-token', data.authtoken);
                sessionStorage.setItem('username', data.username);
                sessionStorage.setItem('email', data.email);
                sessionStorage.setItem('authExpiry', data.expiresAt.toString());

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
            onSubmit={handleRegister} 
            className="flex flex-col bg-gray-600/70 text-white mx-auto my-auto rounded-md p-4">
                <p className="text-lg font-bold mb-4">
                    Register
                </p>

                <label htmlFor="name" className="font-light text-sm mb-1.5">Name</label>
                <input 
                id="name"
                disabled={isSubmitting}
                className="bg-gray-300 text-green-900 mb-1.5 rounded-sm" 
                type="text" 
                value={name} 
                placeholder="Name" 
                required={true} 
                onChange={(event) => setName(event.target.value)}
                />
                <label htmlFor="surname" className="font-light text-sm mb-1.5">Surname</label>
                <input 
                id="surname"
                disabled={isSubmitting}
                className="bg-gray-300 text-green-900 mb-1.5 rounded-sm" 
                type="text" 
                value={surname} 
                placeholder="Surname" 
                required={true} 
                onChange={(event) => setSurname(event.target.value)}
                />
                <label htmlFor="username" className="font-light text-sm mb-1.5">Username</label>
                <input 
                id="username"
                disabled={isSubmitting}
                className="bg-gray-300 text-green-900 mb-1.5 rounded-sm" 
                type="text" 
                value={username} 
                placeholder="Username" 
                required={true} 
                onChange={(event) => setUsername(event.target.value)}
                />
                <label htmlFor="email" className="font-light text-sm mb-1.5">Email</label>
                <input 
                id="email"
                disabled={isSubmitting}
                className="bg-gray-300 text-green-900 mb-1.5 rounded-sm" 
                type="email" 
                value={email} 
                placeholder="Email" 
                required={true} 
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
                required={true} 
                onChange={(event) => setPassword(event.target.value)}
                />

                <button 
                id="register"
                disabled={isSubmitting}
                className={`
                bg-green-500 
                text-white 
                border-black 
                rounded-md 
                active:bg-white 
                active:text-green-500 
                active:scale-90 
                transition-opacity 
                ${isSubmitting ? "cursor-not-allowed" : "hover:scale-110"}`} 
                type="submit">
                    {isSubmitting ? "Registering" : "Register"}
                </button>
                
                <p className="text-white text-lg">Already a user?
                    <a 
                    href="/app/login"
                    className="hover:text-green-400 text-lg underline active:text-green-800 active:scale-75 visited:text-white">
                        Click here to log in.
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

export default Register;