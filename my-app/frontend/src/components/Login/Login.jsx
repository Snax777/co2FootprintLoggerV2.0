import { useEffect, useState, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAppContext } from "../../context/authContext";
import axios from "axios";

const Login = () => {
    const { 
        isLoggedIn, 
        updateAuthStatus, 
        authLoading,
        email: contextEmail,
        setEmail: setContextEmail 
    } = useAppContext();
    
    const [email, setEmail] = useState(contextEmail || "");
    const [password, setPassword] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const navigate = useNavigate();
    const backendUrl = import.meta.env.VITE_BACKEND_URL;
    const loginEndpoint = import.meta.env.VITE_LOGIN_ENDPOINT;

    useEffect(() => {
        if (isLoggedIn && !authLoading) {
            navigate("/app");
        }
    }, [isLoggedIn, authLoading, navigate]);

    useEffect(() => {
        if (contextEmail && !email) {
            setEmail(contextEmail);
        }
    }, [contextEmail, email]);

    const handleLogin = useCallback(async (event) => {
        event.preventDefault();
        
        if (!email.trim() || !password.trim()) {
            setErrorMessage("Please enter both email and password");
            return;
        }

        setIsSubmitting(true);
        setErrorMessage("");

        try {
            const { data } = await axios.post(
                `${backendUrl}${loginEndpoint}`, 
                { email: email.trim(), password },
                {
                    timeout: 10000,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (data.authtoken && data.username && data.email && data.expiresAt) {
                console.log(data.authtoken);
                updateAuthStatus(
                    data.authtoken,
                    data.username,
                    data.email,
                    data.expiresAt.toString()
                );
                setPassword("");
                navigate("/app");
            } else if (data.error) {
                setErrorMessage(data.error);
                setPassword("");
            } else {
                setErrorMessage("Invalid response from server");
            }
        } catch (error) {
            console.error("Login error:", error);
            
            let errorMsg = "Something went wrong. Please try again later.";
            
            if (error.response) {
                errorMsg = error.response.data?.error || error.response.data?.message || `Server error: ${error.response.status}`;
            } else if (error.request) {
                errorMsg = "Unable to connect to server. Please check your connection.";
            } else if (error.code === 'ECONNABORTED') {
                errorMsg = "Request timeout. Please try again.";
            }
            
            setErrorMessage(errorMsg);
            setPassword(""); 
        } finally {
            setIsSubmitting(false);
        }
    }, [email, password, backendUrl, loginEndpoint, updateAuthStatus, navigate]);

    useEffect(() => {
        if (email && email !== contextEmail) {
            setContextEmail(email);
        }
    }, [email, contextEmail, setContextEmail]);

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-500/10 to-blue-500/10">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600">Checking authentication...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-500/10 to-blue-500/10 py-8 px-4">
            <div className="max-w-md w-full">
                {errorMessage && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 animate-fade-in">
                        <div className="flex items-center">
                            <div className="text-red-500 mr-3">
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <p className="text-red-700 text-sm">{errorMessage}</p>
                        </div>
                    </div>
                )}

                <div className="bg-white rounded-2xl shadow-xl p-8">
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold text-gray-800 mb-2">Welcome Back</h1>
                        <p className="text-gray-600">Sign in to your CO₂Logger account</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                                Email Address
                            </label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                disabled={isSubmitting}
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition disabled:opacity-50 disabled:cursor-not-allowed"
                                placeholder="Enter your email"
                            />
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                                Password
                            </label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="current-password"
                                required
                                disabled={isSubmitting}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition disabled:opacity-50 disabled:cursor-not-allowed"
                                placeholder="Enter your password"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition-all duration-200 ${
                                isSubmitting
                                    ? "bg-gray-400 cursor-not-allowed"
                                    : "bg-green-500 hover:bg-green-600 active:bg-green-700 shadow-lg hover:shadow-xl"
                            }`}
                        >
                            {isSubmitting ? (
                                <div className="flex items-center justify-center">
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                                    Signing In...
                                </div>
                            ) : (
                                "Sign In"
                            )}
                        </button>
                    </form>

                    <div className="text-center mt-6 pt-6 border-t border-gray-200">
                        <p className="text-gray-600">
                            Don't have an account?{" "}
                            <Link
                                to="/app/register"
                                className="text-green-500 hover:text-green-600 font-semibold transition-colors"
                            >
                                Create one here
                            </Link>
                        </p>
                    </div>
                </div>

                {/* Additional Info */}
                <div className="text-center mt-6">
                    <p className="text-sm text-gray-500">
                        Track your carbon footprint and make a positive environmental impact
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;