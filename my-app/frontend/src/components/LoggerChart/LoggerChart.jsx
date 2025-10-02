import co2Data from "../../../../util/data/co2-value.json";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { getUTC } from "../../../../util/dateTimeToUTCConverter";
import { useAppContext } from "../../context/authContext";
import { websocketClient } from "../../services/websocketClient"; 
import { 
    Chart, 
    BarElement, 
    Title, 
    Tooltip, 
    Legend, 
    LinearScale, 
    CategoryScale
} from "chart.js";
import { Bar } from "react-chartjs-2";

Chart.register(
    BarElement, 
    Title, 
    Tooltip, 
    Legend, 
    LinearScale, 
    CategoryScale
);

const LoggerChart = () => {
    const { 
        isLoggedIn, 
        authLoading, 
        clearAuthSession,
        webSocketConnected 
    } = useAppContext();
    
    const navigate = useNavigate();
    const chartRef = useRef(null); 
    
    const currentDate = new Date();
    const todayUTC = getUTC(currentDate)[0];
    const [fetchedCO2Data, setFetchedCO2Data] = useState([]);
    const [startDate, setStartDate] = useState(todayUTC);
    const [endDate, setEndDate] = useState(todayUTC);
    const [errorMessage, setErrorMessage] = useState("");
    const [showChart, setShowChart] = useState(false);
    const [formattedData, setFormattedData] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [toast, setToast] = useState(null);
    const [realTimeUpdates, setRealTimeUpdates] = useState([]); 
    const [autoRefresh, setAutoRefresh] = useState(true); 

    const authToken = sessionStorage.getItem("auth-token");

    const apiConfig = useMemo(() => ({
        headers: { 
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json'
        },
        timeout: 10000
    }), [authToken]);

    const handleToast = useCallback((message, type = "success") => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    }, []);

    const setupWebSocketHandlers = useCallback(() => {
        if (!websocketClient || !webSocketConnected) return;

        websocketClient.on('co2-data-added', (data) => {
            console.log('New CO2 data received via WebSocket:', data);
            
            setRealTimeUpdates(prev => [...prev, {
                id: Date.now(),
                type: 'new-data',
                message: `New data recorded: ${data.totalCO2}kg CO₂`,
                timestamp: new Date().toLocaleTimeString(),
                data: data
            }]);

            if (autoRefresh && isDateInRange(data.date, startDate, endDate)) {
                handleToast("New data available! Updating chart...", "success");
                setTimeout(() => {
                    fetchAndRenderChart();
                }, 1000); 
            } else if (autoRefresh) {
                handleToast("New data recorded (outside current date range)", "info");
            }
        });

        websocketClient.on('co2-data-updated', (data) => {
            setRealTimeUpdates(prev => [...prev, {
                id: Date.now(),
                type: 'update-data',
                message: `Data updated: ${data.addedEntries} new entries`,
                timestamp: new Date().toLocaleTimeString(),
                data: data
            }]);

            if (autoRefresh) {
                handleToast("Data updated! Refreshing chart...", "info");
                setTimeout(() => {
                    fetchAndRenderChart();
                }, 500);
            }
        });

        websocketClient.on('data-deleted', (data) => {
            setRealTimeUpdates(prev => [...prev, {
                id: Date.now(),
                type: 'delete-data',
                message: `Data deleted: ${data.recordsDeleted} records removed`,
                timestamp: new Date().toLocaleTimeString(),
                data: data
            }]);

            if (autoRefresh) {
                handleToast("Data deleted! Updating chart...", "warning");
                setTimeout(() => {
                    fetchAndRenderChart();
                }, 500);
            }
        });

        // Handle connection status
        websocketClient.on('connected', () => {
            handleToast("Real-time chart updates activated", "success");
        });

        websocketClient.on('connection-lost', () => {
            handleToast("Real-time updates paused", "error");
        });

    }, [autoRefresh, startDate, endDate, handleToast, webSocketConnected]);

    const isDateInRange = useCallback((date, start, end) => {
        try {
            const checkDate = new Date(date);
            const startDate = new Date(start);
            const endDate = new Date(end);
            return checkDate >= startDate && checkDate <= endDate;
        } catch {
            return false;
        }
    }, []);

    useEffect(() => {
        const interval = setInterval(() => {
            setRealTimeUpdates(prev => 
                prev.filter(update => 
                    Date.now() - update.id < 30000 
                )
            );
        }, 5000);

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (isLoggedIn && webSocketConnected) {
            setupWebSocketHandlers();
        }

        return () => {
            if (websocketClient) {
                websocketClient.off('co2-data-added');
                websocketClient.off('co2-data-updated');
                websocketClient.off('data-deleted');
                websocketClient.off('connected');
                websocketClient.off('connection-lost');
            }
        };
    }, [isLoggedIn, webSocketConnected, setupWebSocketHandlers]);

    const sameDate = useMemo(() => startDate === endDate, [startDate, endDate]);
    
    const paragraphSubstring = useMemo(() => 
        sameDate ? `for ${startDate}` : `from ${startDate} to ${endDate}`,
        [sameDate, startDate, endDate]
    );

    const uniqueColors = useMemo(() => {
        const categories = Object.keys(co2Data);
        return categories.map((_, index) => {
            const hue = Math.floor((360 / categories.length) * index);
            const saturation = 70 + Math.random() * 20; 
            const lightness = 50 + Math.random() * 20; 
            return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        });
    }, []);

    const chartData = useMemo(() => ({
        labels: formattedData.map(data => data.co2Category),
        datasets: [
            {
                label: "Total CO\u2082 Emissions (kg)", 
                data: formattedData.map(data => data.co2Value),
                backgroundColor: uniqueColors,
                borderWidth: 2,
                borderColor: '#374151',
                borderRadius: 4,
                borderSkipped: false,
            }
        ]
    }), [formattedData, uniqueColors]);

    const chartOptions = useMemo(() => ({
        responsive: true, 
        maintainAspectRatio: false,
        interaction: {
            intersect: false,
            mode: 'index',
        },
        plugins: {
            title: {
                display: true, 
                text: `CO\u2082 Emissions by Category ${paragraphSubstring}`,
                font: {
                    size: 20, 
                    weight: "bold", 
                },
                padding: 20,
                color: '#1f2937'
            }, 
            legend: {
                display: true,
                position: 'top',
                labels: {
                    font: {
                        size: 12,
                        weight: '500'
                    },
                    color: '#374151',
                    usePointStyle: true,
                    padding: 15
                }
            }, 
            tooltip: {
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                titleColor: '#1f2937',
                bodyColor: '#374151',
                borderColor: '#d1d5db',
                borderWidth: 1,
                cornerRadius: 8,
                padding: 12,
                callbacks: {
                    label: (context) => {
                        const value = context.raw;
                        return `${context.dataset.label}: ${value.toLocaleString()} kg`;
                    },
                    title: (context) => {
                        return context[0].label;
                    }
                }
            }
        }, 
        scales: {
            x: {
                title: {
                    display: true, 
                    text: "CO\u2082 Category",
                    font: {
                        size: 14,
                        weight: "600"
                    },
                    color: '#374151',
                    padding: 10
                },
                ticks: {
                    autoSkip: false,
                    maxRotation: 45,
                    minRotation: 45,
                    font: {
                        size: 11,
                        weight: '500'
                    },
                    color: '#6b7280'
                },
                grid: {
                    display: false
                }
            }, 
            y: {
                beginAtZero: true, 
                title: {
                    display: true, 
                    text: "Total CO\u2082 Emissions (kg)",
                    font: {
                        size: 14, 
                        weight: "600"
                    },
                    color: '#374151',
                    padding: 10
                },
                ticks: {
                    font: {
                        size: 11,
                        weight: '500'
                    },
                    color: '#6b7280',
                    callback: function(value) {
                        return value.toLocaleString() + ' kg';
                    }
                },
                grid: {
                    color: 'rgba(0, 0, 0, 0.05)',
                    drawBorder: false
                }
            }
        },
        animation: {
            duration: autoRefresh ? 1000 : 0,
            easing: 'easeOutQuart'
        }
    }), [paragraphSubstring, autoRefresh]);

    const getEarlyDate = useCallback((dateRange) => {
        const earlyMilliseconds = Date.now() - (dateRange * 24 * 3600000);
        const earlyDate = new Date(earlyMilliseconds);
        return getUTC(earlyDate)[0];
    }, []);

    const handleDataFetch = useCallback(async () => {
        if (!authToken || !isLoggedIn) {
            setErrorMessage("Please log in to view data");
            return [];
        }

        if (startDate > endDate) {
            setErrorMessage("Start date must be before or equal to end date");
            return [];
        }

        try {
            const baseURL = import.meta.env.VITE_BACKEND_URL;
            const endpoint = import.meta.env.VITE_SEARCH_DATA;
            
            if (!baseURL || !endpoint) {
                throw new Error("Backend configuration missing");
            }

            const { data } = await axios.get(
                `${baseURL}${endpoint}?startDate=${startDate}&endDate=${endDate}`, 
                apiConfig
            );

            if (data?.data?.length > 0) {
                return data.data;
            } else {
                setErrorMessage("No data found for the selected period");
                return [];
            }
        } catch (error) {
            console.error("Error fetching data:", error);
            
            let errorMsg = "Failed to fetch data. Please try again.";
            
            if (error.response?.status === 401) {
                errorMsg = "Please log in to view data";
                clearAuthSession();
            } else if (error.code === 'ECONNABORTED') {
                errorMsg = "Request timeout. Please try again.";
            } else if (error.message?.includes('Network Error')) {
                errorMsg = "Network error. Please check your connection.";
            } else if (error.response?.data?.message) {
                errorMsg = error.response.data.message;
            }

            setErrorMessage(errorMsg);
            return [];
        }
    }, [authToken, isLoggedIn, startDate, endDate, apiConfig, clearAuthSession]);

    const formatCO2Data = useCallback((rawData) => {
        if (!rawData || rawData.length === 0) return [];

        const categoryTotals = {};
        
        Object.keys(co2Data).forEach(category => {
            categoryTotals[category] = 0;
        });

        rawData.forEach(item => {
            if (item.co2Data && Array.isArray(item.co2Data)) {
                item.co2Data.forEach(data => {
                    if (data.category && typeof data.co2Value === 'number') {
                        categoryTotals[data.category] = 
                            (categoryTotals[data.category] || 0) + data.co2Value;
                    }
                });
            }
        });

        return Object.entries(categoryTotals)
            .map(([co2Category, co2Value]) => ({ 
                co2Category, 
                co2Value: parseFloat(co2Value.toFixed(2)) 
            }))
            .filter(item => item.co2Value > 0)
            .sort((a, b) => b.co2Value - a.co2Value);
    }, []);

    const fetchAndRenderChart = useCallback(async () => {
        if (!isLoggedIn) {
            setErrorMessage("Please log in to view charts");
            return;
        }

        setIsLoading(true);
        setErrorMessage("");
        setShowChart(false);

        try {
            const rawCO2Data = await handleDataFetch();
            
            if (rawCO2Data.length > 0) {
                const formatted = formatCO2Data(rawCO2Data);
                setFormattedData(formatted);
                setFetchedCO2Data(rawCO2Data);
                setShowChart(true);
                handleToast("Chart data loaded successfully", "success");
            } else {
                setFormattedData([]);
                setFetchedCO2Data([]);
            }
        } catch (error) {
            console.error("Error creating chart:", error);
            setErrorMessage("Failed to create chart. Please try again.");
            handleToast("Failed to load chart data", "error");
        } finally {
            setIsLoading(false);
        }
    }, [isLoggedIn, handleDataFetch, formatCO2Data, handleToast]);

    const handlePresetChange = useCallback((event) => {
        const value = event.target.value;
        if (!value && value !== '0') return;

        const daysBack = parseInt(value);
        const earlyDate = getEarlyDate(daysBack);
        
        setStartDate(earlyDate);
        setEndDate(todayUTC);
        
        if (daysBack === 0 || daysBack === 1) {
            setEndDate(earlyDate);
        }
    }, [getEarlyDate, todayUTC]);

    const handleManualRefresh = useCallback(() => {
        handleToast("Refreshing chart data...", "info");
        fetchAndRenderChart();
    }, [fetchAndRenderChart, handleToast]);

    const toggleAutoRefresh = useCallback(() => {
        setAutoRefresh(prev => !prev);
        handleToast(
            autoRefresh ? "Auto-refresh disabled" : "Auto-refresh enabled", 
            "info"
        );
    }, [autoRefresh, handleToast]);

    useEffect(() => {
        if (!authLoading && !isLoggedIn) {
            navigate('/app/login');
        }
    }, [isLoggedIn, authLoading, navigate]);

    useEffect(() => {
        if (isLoggedIn && startDate && endDate && !authLoading) {
            const timer = setTimeout(() => {
                fetchAndRenderChart();
            }, 500);
            
            return () => clearTimeout(timer);
        }
    }, [isLoggedIn, startDate, endDate, authLoading, fetchAndRenderChart]);

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
        <div className="min-h-screen bg-gradient-to-br from-green-500/5 to-blue-500/5 py-8 px-4">
            <div className="max-w-7xl mx-auto">
                <div className="text-center text-white mb-8">
                    <h1 className="text-4xl font-bold mb-4">
                        CO<sub>2</sub> Emissions Analytics
                    </h1>
                    <p className="text-lg">
                        Visualize your carbon footprint across different categories and time periods
                    </p>
                    
                    <div className="flex justify-center items-center mt-4 space-x-4">
                        <div className={`flex items-center px-3 py-1 rounded-full text-sm ${
                            webSocketConnected 
                                ? 'bg-green-500/20 text-green-400 border border-green-400/30' 
                                : 'bg-yellow-500/20 text-yellow-400 border border-yellow-400/30'
                        }`}>
                            <div className={`w-2 h-2 rounded-full mr-2 ${
                                webSocketConnected ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'
                            }`}></div>
                            {webSocketConnected ? 'Live Updates Active' : 'Real-time Offline'}
                        </div>
                        
                        {webSocketConnected && (
                            <div className={`flex items-center px-3 py-1 rounded-full text-sm cursor-pointer ${
                                autoRefresh 
                                    ? 'bg-blue-500/20 text-blue-400 border border-blue-400/30' 
                                    : 'bg-gray-500/20 text-gray-400 border border-gray-400/30'
                            }`} onClick={toggleAutoRefresh}>
                                <div className={`w-2 h-2 rounded-full mr-2 ${
                                    autoRefresh ? 'bg-blue-400 animate-pulse' : 'bg-gray-400'
                                }`}></div>
                                Auto-refresh: {autoRefresh ? 'ON' : 'OFF'}
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold text-gray-800">Chart Controls</h2>
                        
                        <div className="flex items-center space-x-3">
                            {webSocketConnected && (
                                <button
                                    onClick={toggleAutoRefresh}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                                        autoRefresh
                                            ? 'bg-blue-100 text-blue-700 border border-blue-300'
                                            : 'bg-gray-100 text-gray-700 border border-gray-300'
                                    }`}
                                >
                                    Auto: {autoRefresh ? 'ON' : 'OFF'}
                                </button>
                            )}
                            <button
                                onClick={handleManualRefresh}
                                disabled={isLoading}
                                className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition disabled:opacity-50"
                            >
                                {isLoading ? 'Refreshing...' : 'Refresh Now'}
                            </button>
                        </div>
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-8">
                        <div>
                            <label htmlFor="preset-range" className="block text-gray-700 font-semibold mb-3">
                                Quick Date Presets:
                            </label>
                            <select 
                                id="preset-range" 
                                onChange={handlePresetChange}
                                disabled={isLoading}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition disabled:opacity-50"
                            >
                                <option value="">Select a preset range</option>
                                <option value="0">Today</option>
                                <option value="1">Yesterday</option>
                                <option value="7">Last 7 days</option>
                                <option value="28">Last 28 days</option>
                                <option value="30">Last 30 days</option>
                                <option value="31">Last 31 days</option>
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-gray-700 font-semibold mb-3">
                                    Start Date:
                                </label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    max={endDate}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-gray-700 font-semibold mb-3">
                                    End Date:
                                </label>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    min={startDate}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                />
                            </div>
                        </div>
                    </div>

                    {realTimeUpdates.length > 0 && (
                        <div className="mt-6 p-4 bg-gray-50 rounded-xl border">
                            <h3 className="font-semibold text-gray-700 mb-3">Recent Activity</h3>
                            <div className="space-y-2 max-h-32 overflow-y-auto">
                                {realTimeUpdates.slice(-3).reverse().map((update) => (
                                    <div 
                                        key={update.id}
                                        className={`flex justify-between items-center p-2 rounded text-sm ${
                                            update.type === 'new-data' ? 'bg-green-50 text-green-700' :
                                            update.type === 'update-data' ? 'bg-blue-50 text-blue-700' :
                                            'bg-amber-50 text-amber-700'
                                        }`}
                                    >
                                        <span>{update.message}</span>
                                        <span className="text-xs text-gray-500">{update.timestamp}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="mt-6">
                        <button
                            onClick={fetchAndRenderChart}
                            disabled={isLoading || !startDate || !endDate}
                            className={`w-full py-4 px-6 rounded-xl font-semibold text-white transition-all duration-200 ${
                                isLoading || !startDate || !endDate
                                    ? "bg-gray-400 cursor-not-allowed"
                                    : "bg-green-500 hover:bg-green-600 active:bg-green-700 shadow-lg hover:shadow-xl"
                            }`}
                        >
                            {isLoading ? (
                                <div className="flex items-center justify-center gap-3">
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    Loading Chart Data...
                                </div>
                            ) : (
                                "Generate CO₂ Emissions Chart"
                            )}
                        </button>
                    </div>
                </div>

                {isLoading && (
                    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-8 text-center mb-8">
                        <div className="flex items-center justify-center gap-3 text-blue-700">
                            <div className="w-6 h-6 border-2 border-blue-700 border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-lg font-semibold">Processing your CO₂ data...</p>
                        </div>
                    </div>
                )}

                {errorMessage && !isLoading && (
                    <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center mb-8 animate-fade-in">
                        <div className="text-red-600 font-semibold text-lg mb-2 flex items-center justify-center gap-2">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                            Unable to Load Chart Data
                        </div>
                        <p className="text-red-700">{errorMessage}</p>
                    </div>
                )}

                {showChart && !isLoading && formattedData.length > 0 && (
                    <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                        <div className="p-8">
                            <div className="h-96">
                                <Bar 
                                    data={chartData} 
                                    options={chartOptions} 
                                    key={JSON.stringify(chartData)}
                                    ref={chartRef}
                                />
                            </div>
                            
                            <div className="mt-8 p-6 bg-gradient-to-r from-green-50 to-blue-50 rounded-xl border border-green-200">
                                <h3 className="font-bold text-green-800 text-lg mb-4 flex items-center gap-2">
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                    Data Summary
                                </h3>
                                <div className="grid md:grid-cols-3 gap-4 text-sm">
                                    <div className="text-center p-3 bg-white rounded-lg border">
                                        <div className="text-2xl font-bold text-green-600">{formattedData.length}</div>
                                        <div className="text-gray-600">Categories with Data</div>
                                    </div>
                                    <div className="text-center p-3 bg-white rounded-lg border">
                                        <div className="text-2xl font-bold text-blue-600">{fetchedCO2Data.length}</div>
                                        <div className="text-gray-600">Total Records</div>
                                    </div>
                                    <div className="text-center p-3 bg-white rounded-lg border">
                                        <div className="text-2xl font-bold text-purple-600">
                                            {formattedData.reduce((sum, item) => sum + item.co2Value, 0).toFixed(2)} kg
                                        </div>
                                        <div className="text-gray-600">Total CO₂ Emissions</div>
                                    </div>
                                </div>
                                <div className="mt-4 text-center text-gray-600">
                                    <p>Period: <span className="font-semibold">{paragraphSubstring}</span></p>
                                    {webSocketConnected && (
                                        <p className="text-sm mt-1">
                                            <span className={`inline-block w-2 h-2 rounded-full mr-1 ${autoRefresh ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></span>
                                            Auto-refresh: {autoRefresh ? 'Active' : 'Inactive'}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {!showChart && !isLoading && !errorMessage && isLoggedIn && (
                    <div className="bg-white rounded-2xl shadow-xl p-16 text-center">
                        <div className="text-gray-300 text-8xl mb-6">📈</div>
                        <h3 className="text-2xl font-bold text-gray-700 mb-3">
                            Ready to Visualize Your Data?
                        </h3>
                        <p className="text-gray-500 text-lg mb-6">
                            Select a date range and generate a chart to see your CO₂ emissions breakdown by category.
                        </p>
                        <div className="flex justify-center gap-4">
                            <button
                                onClick={() => handlePresetChange({ target: { value: '0' } })}
                                className="bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 transition-colors font-semibold"
                            >
                                View Today's Data
                            </button>
                            <button
                                onClick={() => handlePresetChange({ target: { value: '7' } })}
                                className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors font-semibold"
                            >
                                Last 7 Days
                            </button>
                        </div>
                    </div>
                )}

                {!isLoggedIn && !authLoading && (
                    <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
                        <div className="text-gray-400 text-8xl mb-6">🔐</div>
                        <h3 className="text-2xl font-bold text-gray-700 mb-3">
                            Access Your CO₂ Analytics
                        </h3>
                        <p className="text-gray-500 text-lg mb-6">
                            Sign in to view detailed charts and analytics of your carbon footprint across different categories and time periods.
                        </p>
                        <button
                            onClick={() => navigate('/app/login')}
                            className="bg-green-500 text-white px-8 py-3 rounded-lg hover:bg-green-600 transition-colors font-semibold text-lg"
                        >
                            Sign In to View Analytics
                        </button>
                    </div>
                )}
            </div>

            {toast && (
                <div
                    className={`fixed bottom-6 right-6 px-6 py-4 rounded-xl shadow-2xl text-white font-semibold z-50 transition-all duration-300 animate-slide-in ${
                        toast.type === 'success' 
                            ? 'bg-green-500 border border-green-400' 
                            : 'bg-red-500 border border-red-400'
                    }`}
                >
                    <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${toast.type === 'success' ? 'bg-green-200' : 'bg-red-200'}`}></div>
                        <span>{toast.message}</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LoggerChart;