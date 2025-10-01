import axios from "axios";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { getUTC } from "../../../../util/dateTimeToUTCConverter";
import { useAppContext } from "../../context/authContext";

const Leaderboard = () => {
    const { 
        isLoggedIn, 
        authLoading, 
        clearAuthSession 
    } = useAppContext();
    
    const navigate = useNavigate();
    
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [co2Data, setCO2Data] = useState([]);
    const [showTable, setShowTable] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedRange, setSelectedRange] = useState("");

    const backendUrl = import.meta.env.VITE_BACKEND_URL;
    const leaderboardEndpoint = import.meta.env.VITE_LEADERBOARD_DATA;
    
    // Get auth token from sessionStorage (context doesn't store this)
    const authToken = sessionStorage.getItem("auth-token");

    // Memoized date calculations
    const currentDate = useMemo(() => new Date(), []);
    const currentUTCDate = useMemo(() => getUTC(currentDate)[0], [currentDate]);

    // Memoized date comparison and text
    const sameDate = useMemo(() => startDate === endDate, [startDate, endDate]);
    const paragraphSubstring = useMemo(() => 
        sameDate ? `of ${startDate}` : `from ${startDate} to ${endDate}`,
        [sameDate, startDate, endDate]
    );

    // Memoized API configuration
    const apiConfig = useMemo(() => ({
        headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json'
        },
        timeout: 10000
    }), [authToken]);

    // Calculate early date based on range
    const getEarlyDate = useCallback((dateRange) => {
        const earlyMilliseconds = Date.now() - (dateRange * 24 * 3600000);
        const earlyDate = new Date(earlyMilliseconds);
        return getUTC(earlyDate)[0];
    }, []);

    // Fetch leaderboard data
    const handleDataFetch = useCallback(async (dateRange) => {
        if (!authToken || !isLoggedIn) {
            setErrorMessage("Please log in to view leaderboard");
            return [];
        }

        setIsLoading(true);
        setErrorMessage("");

        try {
            const { data } = await axios.get(
                `${backendUrl}${leaderboardEndpoint}?${dateRange}`,
                apiConfig
            );

            if (data?.data && data.data.length > 0) {
                setCO2Data(data.data);
                setShowTable(true);
                return data.data;
            } else {
                setErrorMessage("No leaderboard data available for the selected period");
                setCO2Data([]);
                return [];
            }
        } catch (error) {
            console.error("Leaderboard fetch error:", error);
            
            let errorMsg = "Failed to load leaderboard data";
            
            if (error.response?.status === 401) {
                errorMsg = "Please log in to view leaderboard";
                clearAuthSession();
            } else if (error.response?.data?.message) {
                errorMsg = error.response.data.message;
            } else if (error.code === 'ECONNABORTED') {
                errorMsg = "Request timeout. Please try again.";
            } else if (error.message?.includes('Network Error')) {
                errorMsg = "Network error. Please check your connection.";
            }

            setErrorMessage(errorMsg);
            setCO2Data([]);
            return [];
        } finally {
            setIsLoading(false);
        }
    }, [backendUrl, leaderboardEndpoint, authToken, isLoggedIn, apiConfig, clearAuthSession]);

    // Create leaderboard based on date range
    const handleCreateLeaderboard = useCallback(async (dateRangeValue) => {
        if (!dateRangeValue && dateRangeValue !== 0) {
            setErrorMessage("Please select a date range");
            return;
        }

        setShowTable(false);
        setErrorMessage("");
        setSelectedRange(dateRangeValue);

        const earlyDate = getEarlyDate(parseInt(dateRangeValue));
        setStartDate(earlyDate);
        setEndDate(currentUTCDate);

        // Build query string
        const queryDateRange = `startDate=${earlyDate}&endDate=${currentUTCDate}`;

        await handleDataFetch(queryDateRange);
    }, [getEarlyDate, currentUTCDate, handleDataFetch]);

    // Handle date range change
    const handleDateRangeChange = useCallback((event) => {
        const value = event.target.value;
        if (value) {
            handleCreateLeaderboard(value);
        }
    }, [handleCreateLeaderboard]);

    // Date range options
    const dateRangeOptions = useMemo(() => [
        { value: "0", label: "Today" },
        { value: "1", label: "Yesterday" },
        { value: "7", label: "Last 7 days" },
        { value: "28", label: "Last 28 days" },
        { value: "30", label: "Last 30 days" },
        { value: "31", label: "Last 31 days" }
    ], []);

    // Redirect if not logged in
    useEffect(() => {
        if (!authLoading && !isLoggedIn) {
            navigate('/app/login');
        }
    }, [isLoggedIn, authLoading, navigate]);

    // Initialize with today's data
    useEffect(() => {
        if (!authLoading && isLoggedIn && authToken) {
            handleCreateLeaderboard("0");
        }
    }, [isLoggedIn, authToken, authLoading, handleCreateLeaderboard]);

    // Show loading state while checking auth
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
        <div className="min-h-screen bg-gradient-to-br from-green-500/10 to-blue-500/10 py-8 px-4">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="text-center text-white mb-8">
                    <h1 className="text-4xl font-bold mb-4">
                        CO<sub>2</sub> Emissions Leaderboard
                    </h1>
                    <p className="text-lg">
                        Compare your carbon footprint with other environmentally conscious users
                    </p>
                </div>

                {/* Date Range Selector */}
                <div className="bg-white rounded-2xl shadow-xl p-6 mb-8">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <label htmlFor="date-range" className="text-lg font-semibold text-gray-700 whitespace-nowrap">
                            Select Time Period:
                        </label>
                        <select 
                            id="date-range"
                            value={selectedRange}
                            onChange={handleDateRangeChange}
                            disabled={isLoading}
                            className="w-full sm:w-64 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition disabled:opacity-50"
                        >
                            <option value="">Choose a period...</option>
                            {dateRangeOptions.map(option => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                        
                        {isLoading && (
                            <div className="flex items-center gap-2 text-green-600">
                                <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                                <span>Loading leaderboard...</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Error Message */}
                {errorMessage && !isLoading && (
                    <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center mb-8 animate-fade-in">
                        <div className="text-red-600 font-semibold text-lg mb-2 flex items-center justify-center gap-2">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                            Unable to Load Data
                        </div>
                        <p className="text-red-700">{errorMessage}</p>
                    </div>
                )}

                {/* Leaderboard Table */}
                {showTable && co2Data.length > 0 && !isLoading && (
                    <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                        {/* Table Header */}
                        <div className="bg-gradient-to-r from-green-500 to-green-600 p-8">
                            <h2 className="text-3xl font-bold text-white text-center">
                                Top 20 Lowest CO<sub>2</sub> Emitters
                            </h2>
                            <p className="text-green-100 text-center mt-3 text-lg">
                                {paragraphSubstring}
                            </p>
                        </div>

                        {/* Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-8 py-6 text-left text-sm font-bold text-gray-700 uppercase tracking-wider">
                                            Rank
                                        </th>
                                        <th className="px-8 py-6 text-left text-sm font-bold text-gray-700 uppercase tracking-wider">
                                            User
                                        </th>
                                        <th className="px-8 py-6 text-left text-sm font-bold text-gray-700 uppercase tracking-wider">
                                            Avg CO<sub>2</sub> (kg)
                                        </th>
                                        <th className="px-8 py-6 text-left text-sm font-bold text-gray-700 uppercase tracking-wider">
                                            Total CO<sub>2</sub> (kg)
                                        </th>
                                        <th className="px-8 py-6 text-left text-sm font-bold text-gray-700 uppercase tracking-wider">
                                            Records
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {co2Data.map((data, index) => (
                                        <tr 
                                            key={`${data.username}-${index}`}
                                            className={`
                                                transition-all duration-200 hover:bg-gray-50 hover:scale-[1.01]
                                                ${index < 3 ? 'bg-gradient-to-r from-yellow-50 to-yellow-100/50 border-l-4' : ''}
                                                ${index === 0 ? 'border-l-yellow-400' : ''}
                                                ${index === 1 ? 'border-l-gray-400' : ''}
                                                ${index === 2 ? 'border-l-orange-400' : ''}
                                            `}
                                        >
                                            <td className="px-8 py-6 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    {index === 0 && (
                                                        <span className="text-yellow-500 text-2xl mr-3">🥇</span>
                                                    )}
                                                    {index === 1 && (
                                                        <span className="text-gray-400 text-2xl mr-3">🥈</span>
                                                    )}
                                                    {index === 2 && (
                                                        <span className="text-orange-500 text-2xl mr-3">🥉</span>
                                                    )}
                                                    <span className={`
                                                        font-bold text-lg
                                                        ${index === 0 ? 'text-yellow-600' : ''}
                                                        ${index === 1 ? 'text-gray-600' : ''}
                                                        ${index === 2 ? 'text-orange-600' : ''}
                                                        ${index > 2 ? 'text-gray-700' : ''}
                                                    `}>
                                                        #{index + 1}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 whitespace-nowrap">
                                                <div className="text-base font-semibold text-gray-900">
                                                    {data.username || "Anonymous"}
                                                </div>
                                                <div className="text-sm text-gray-500 mt-1">
                                                    {data.email ? `${data.email.substring(0, 3)}***@${data.email.split('@')[1]}` : ''}
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 whitespace-nowrap">
                                                <span className="text-base font-bold text-green-600 bg-green-50 px-3 py-1 rounded-full">
                                                    {typeof data.averageCO2 === 'number' ? data.averageCO2.toFixed(2) : '0.00'} kg
                                                </span>
                                            </td>
                                            <td className="px-8 py-6 whitespace-nowrap">
                                                <span className="text-base font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                                                    {typeof data.totalCO2 === 'number' ? data.totalCO2.toFixed(2) : '0.00'} kg
                                                </span>
                                            </td>
                                            <td className="px-8 py-6 whitespace-nowrap">
                                                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-purple-100 text-purple-800">
                                                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                                        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    {data.recordCount || 1}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Table Footer */}
                        <div className="bg-gray-50 px-8 py-6 border-t border-gray-200">
                            <div className="flex flex-col sm:flex-row justify-between items-center text-sm text-gray-600">
                                <span className="font-semibold">
                                    Showing {co2Data.length} user{co2Data.length !== 1 ? 's' : ''}
                                </span>
                                <span className="mt-2 sm:mt-0 text-gray-500">
                                    Last updated: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Empty State */}
                {!showTable && !isLoading && !errorMessage && isLoggedIn && (
                    <div className="bg-white rounded-2xl shadow-xl p-16 text-center">
                        <div className="text-gray-300 text-8xl mb-6">🏆</div>
                        <h3 className="text-2xl font-bold text-gray-700 mb-3">
                            Ready to Compete?
                        </h3>
                        <p className="text-gray-500 text-lg mb-6">
                            Select a date range to view the CO<sub>2</sub> emissions leaderboard and see how you rank!
                        </p>
                        <div className="flex justify-center gap-4">
                            {dateRangeOptions.slice(0, 3).map(option => (
                                <button
                                    key={option.value}
                                    onClick={() => handleDateRangeChange({ target: { value: option.value } })}
                                    className="bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 transition-colors font-semibold"
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Login Prompt */}
                {!isLoggedIn && !authLoading && (
                    <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
                        <div className="text-gray-400 text-8xl mb-6">🔐</div>
                        <h3 className="text-2xl font-bold text-gray-700 mb-3">
                            Join the Leaderboard
                        </h3>
                        <p className="text-gray-500 text-lg mb-6">
                            Sign in to see how your carbon footprint compares with other environmentally conscious users
                        </p>
                        <button
                            onClick={() => navigate('/app/login')}
                            className="bg-green-500 text-white px-8 py-3 rounded-lg hover:bg-green-600 transition-colors font-semibold text-lg"
                        >
                            Sign In to View Leaderboard
                        </button>
                    </div>
                )}

                {/* Info Section */}
                {isLoggedIn && (
                    <div className="mt-12 grid md:grid-cols-3 gap-8">
                        <div className="bg-white rounded-2xl p-8 shadow-lg border-l-4 border-green-500 hover:shadow-xl transition-shadow">
                            <div className="text-green-500 text-3xl mb-4">📊</div>
                            <h3 className="font-bold text-gray-800 text-lg mb-3">How it Works</h3>
                            <p className="text-gray-600">
                                Users are ranked by their average CO<sub>2</sub> emissions per record. 
                                Lower averages indicate more sustainable lifestyle choices.
                            </p>
                        </div>
                        <div className="bg-white rounded-2xl p-8 shadow-lg border-l-4 border-blue-500 hover:shadow-xl transition-shadow">
                            <div className="text-blue-500 text-3xl mb-4">🔄</div>
                            <h3 className="font-bold text-gray-800 text-lg mb-3">Real-time Data</h3>
                            <p className="text-gray-600">
                                Leaderboard updates automatically with new activity logs. 
                                Data reflects the most recent environmental impact measurements.
                            </p>
                        </div>
                        <div className="bg-white rounded-2xl p-8 shadow-lg border-l-4 border-purple-500 hover:shadow-xl transition-shadow">
                            <div className="text-purple-500 text-3xl mb-4">🛡️</div>
                            <h3 className="font-bold text-gray-800 text-lg mb-3">Privacy Focused</h3>
                            <p className="text-gray-600">
                                We protect your privacy by only showing partial email addresses. 
                                Your personal information stays secure while you compete.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Leaderboard;