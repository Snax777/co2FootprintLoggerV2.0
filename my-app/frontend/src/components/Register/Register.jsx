import { useState, useCallback, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAppContext } from "../../context/authContext";
import axios from "axios";

const Register = () => {
    const { 
        updateAuthStatus, 
        authLoading,
        isLoggedIn 
    } = useAppContext();
    
    const navigate = useNavigate();
    
    const [formData, setFormData] = useState({
        name: "",
        surname: "",
        username: "",
        email: "",
        password: ""
    });
    const [confirmPassword, setConfirmPassword] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [passwordStrength, setPasswordStrength] = useState(0);

    const backendUrl = import.meta.env.VITE_BACKEND_URL;
    const registerEndpoint = import.meta.env.VITE_REGISTER_ENDPOINT;

    // Redirect if already logged in
    useEffect(() => {
        if (isLoggedIn && !authLoading) {
            navigate("/app");
        }
    }, [isLoggedIn, authLoading, navigate]);

    // Calculate password strength
    useEffect(() => {
        const calculateStrength = () => {
            let strength = 0;
            const { password } = formData;

            if (password.length >= 8) strength += 1;
            if (/[A-Z]/.test(password)) strength += 1;
            if (/[a-z]/.test(password)) strength += 1;
            if (/[0-9]/.test(password)) strength += 1;
            if (/[^A-Za-z0-9]/.test(password)) strength += 1;

            setPasswordStrength(strength);
        };

        calculateStrength();
    }, [formData.password]);

    const handleInputChange = useCallback((field) => (event) => {
        setFormData(prev => ({
            ...prev,
            [field]: event.target.value
        }));
        
        if (errorMessage) {
            setErrorMessage("");
        }
    }, [errorMessage]);

    const validateForm = useCallback(() => {
        const { name, surname, username, email, password } = formData;

        if (!name.trim() || !surname.trim() || !username.trim() || !email.trim() || !password) {
            return "All fields are required";
        }

        if (username.length < 3) {
            return "Username must be at least 3 characters long";
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return "Please enter a valid email address";
        }

        if (password.length < 6) {
            return "Password must be at least 6 characters long";
        }

        if (password !== confirmPassword) {
            return "Passwords do not match";
        }

        if (passwordStrength < 3) {
            return "Please choose a stronger password";
        }

        return null;
    }, [formData, confirmPassword, passwordStrength]);

    const handleRegister = useCallback(async (event) => {
        event.preventDefault();
        
        const validationError = validateForm();
        if (validationError) {
            setErrorMessage(validationError);
            return;
        }

        setIsSubmitting(true);
        setErrorMessage("");

        try {
            const { data } = await axios.post(
                `${backendUrl}${registerEndpoint}`, 
                formData,
                {
                    timeout: 10000,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (data.authtoken && data.username && data.email && data.expiresAt) {
                updateAuthStatus(
                    data.authtoken,
                    data.username,
                    data.email,
                    data.expiresAt.toString()
                );
                
                setFormData({
                    name: "",
                    surname: "",
                    username: "",
                    email: "",
                    password: ""
                });
                setConfirmPassword("");
                
                navigate("/app");
            } else if (data.error) {
                setErrorMessage(data.error);
            } else {
                setErrorMessage("Registration failed. Please try again.");
            }
        } catch (error) {
            console.error("Registration error:", error);
            
            let errorMsg = "Something went wrong. Please try again later.";
            
            if (error.response) {
                errorMsg = error.response.data?.error || error.response.data?.message || `Registration failed: ${error.response.status}`;
            } else if (error.request) {
                errorMsg = "Unable to connect to server. Please check your connection.";
            } else if (error.code === 'ECONNABORTED') {
                errorMsg = "Request timeout. Please try again.";
            }
            
            setErrorMessage(errorMsg);
        } finally {
            setIsSubmitting(false);
        }
    }, [
        formData, 
        confirmPassword, 
        backendUrl, 
        registerEndpoint, 
        updateAuthStatus, 
        navigate, 
        validateForm
    ]);

    const getPasswordStrengthColor = () => {
        if (passwordStrength === 0) return "bg-gray-200";
        if (passwordStrength <= 2) return "bg-red-500";
        if (passwordStrength <= 3) return "bg-yellow-500";
        return "bg-green-500";
    };

    const getPasswordStrengthText = () => {
        if (passwordStrength === 0) return "Enter a password";
        if (passwordStrength <= 2) return "Weak";
        if (passwordStrength <= 3) return "Medium";
        return "Strong";
    };

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
                    <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6 animate-fade-in">
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
                        <h1 className="text-3xl font-bold text-gray-800 mb-2">Create Account</h1>
                        <p className="text-gray-600">Join CO₂Logger and start tracking your environmental impact</p>
                    </div>

                    <form onSubmit={handleRegister} className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                                    First Name
                                </label>
                                <input
                                    id="name"
                                    name="name"
                                    type="text"
                                    autoComplete="given-name"
                                    required
                                    disabled={isSubmitting}
                                    value={formData.name}
                                    onChange={handleInputChange('name')}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition disabled:opacity-50 disabled:cursor-not-allowed"
                                    placeholder="First name"
                                />
                            </div>
                            <div>
                                <label htmlFor="surname" className="block text-sm font-medium text-gray-700 mb-2">
                                    Last Name
                                </label>
                                <input
                                    id="surname"
                                    name="surname"
                                    type="text"
                                    autoComplete="family-name"
                                    required
                                    disabled={isSubmitting}
                                    value={formData.surname}
                                    onChange={handleInputChange('surname')}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition disabled:opacity-50 disabled:cursor-not-allowed"
                                    placeholder="Last name"
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                                Username
                            </label>
                            <input
                                id="username"
                                name="username"
                                type="text"
                                autoComplete="username"
                                required
                                disabled={isSubmitting}
                                value={formData.username}
                                onChange={handleInputChange('username')}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition disabled:opacity-50 disabled:cursor-not-allowed"
                                placeholder="Choose a username"
                                minLength={3}
                            />
                        </div>

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
                                value={formData.email}
                                onChange={handleInputChange('email')}
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
                                autoComplete="new-password"
                                required
                                disabled={isSubmitting}
                                value={formData.password}
                                onChange={handleInputChange('password')}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition disabled:opacity-50 disabled:cursor-not-allowed"
                                placeholder="Create a password"
                                minLength={6}
                            />
                            
                            {formData.password && (
                                <div className="mt-2">
                                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                                        <span>Password strength:</span>
                                        <span className={`font-medium ${
                                            passwordStrength <= 2 ? 'text-red-600' :
                                            passwordStrength <= 3 ? 'text-yellow-600' : 'text-green-600'
                                        }`}>
                                            {getPasswordStrengthText()}
                                        </span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div 
                                            className={`h-2 rounded-full transition-all duration-300 ${getPasswordStrengthColor()}`}
                                            style={{ width: `${(passwordStrength / 5) * 100}%` }}
                                        ></div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div>
                            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                                Confirm Password
                            </label>
                            <input
                                id="confirmPassword"
                                name="confirmPassword"
                                type="password"
                                autoComplete="new-password"
                                required
                                disabled={isSubmitting}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition disabled:opacity-50 disabled:cursor-not-allowed ${
                                    confirmPassword && formData.password !== confirmPassword 
                                        ? 'border-red-300' 
                                        : 'border-gray-300'
                                }`}
                                placeholder="Confirm your password"
                            />
                            {confirmPassword && formData.password !== confirmPassword && (
                                <p className="text-red-600 text-xs mt-1">Passwords do not match</p>
                            )}
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
                                    Creating Account...
                                </div>
                            ) : (
                                "Create Account"
                            )}
                        </button>
                    </form>

                    <div className="text-center mt-6 pt-6 border-t border-gray-200">
                        <p className="text-gray-600">
                            Already have an account?{" "}
                            <Link
                                to="/app/login"
                                className="text-green-500 hover:text-green-600 font-semibold transition-colors"
                            >
                                Sign in here
                            </Link>
                        </p>
                    </div>
                </div>

                <div className="text-center mt-6">
                    <p className="text-sm text-gray-500">
                        By creating an account, you agree to track and reduce your carbon footprint
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Register;