import co2Data from '../../../../util/data/co2-value.json';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import axios from 'axios';
import { getUTC } from '../../../../util/dateTimeToUTCConverter';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/authContext';
import { websocketClient } from '../../services/websocketClient'; 

const Home = () => {
  const { 
    isLoggedIn, 
    username, 
    email, 
    authLoading,
    clearAuthSession,
    authToken,
    webSocketConnected
  } = useAppContext();
  
  const navigate = useNavigate();
  const lastUpdateRef = useRef(null); 
  
  const [loading, setLoading] = useState(true);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [highestStreak, setHighestStreak] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [globalAvgCO2, setGlobalAvgCO2] = useState(0);
  const [totalCO2, setTotalCO2] = useState(0);
  const [highestCategory, setHighestCategory] = useState(null);
  const [weeklyGoals, setWeeklyGoals] = useState([]);
  const [newGoal, setNewGoal] = useState('');
  const [noGoalsError, setNoGoalsError] = useState('');
  const [activityRows, setActivityRows] = useState([]);
  const [isPosting, setIsPosting] = useState(false);
  const [toast, setToast] = useState(null);
  const [todaysData, setTodaysData] = useState([]);
  const [realTimeUpdates, setRealTimeUpdates] = useState([]);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const handleToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const apiConfig = useMemo(() => ({
    headers: { 
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    }
  }), [authToken]);

  const setupWebSocketHandlers = useCallback(() => {
    if (!websocketClient || !webSocketConnected) return;

    websocketClient.on('co2-data-added', (data) => {
      console.log('New CO2 data received via WebSocket:', data);
      
      setRealTimeUpdates(prev => [...prev, {
        id: Date.now(),
        type: 'new-data',
        message: `Logged ${data.totalCO2}kg CO₂`,
        timestamp: new Date().toLocaleTimeString(),
        data: data
      }]);

      if (autoRefresh) {
        handleToast("Activity logged! Updating dashboard...", "success");
        setTimeout(() => {
          refreshDashboard();
        }, 1000);
      }
    });

    websocketClient.on('goal-completed', (data) => {
      const celebrationMessage = `🎉 ${data.message}`;
      
      setRealTimeUpdates(prev => [...prev, {
        id: Date.now(),
        type: 'goal-completed',
        message: celebrationMessage,
        timestamp: new Date().toLocaleTimeString(),
        data: data
      }]);

      handleToast(celebrationMessage, "success");
      
      setTimeout(() => {
        fetchWeeklyGoals();
      }, 500);
    });

    websocketClient.on('goal-progress-updated', (data) => {
      setRealTimeUpdates(prev => [...prev, {
        id: Date.now(),
        type: 'goal-progress',
        message: `Goal progress updated!`,
        timestamp: new Date().toLocaleTimeString(),
        data: data
      }]);

      if (autoRefresh) {
        setTimeout(() => {
          fetchWeeklyGoals();
        }, 500);
      }
    });

    websocketClient.on('co2-data-added', (data) => {
      if (data.streak?.isNewRecord) {
        const streakMessage = `🔥 New streak record! ${data.streak.current} days!`;
        
        setRealTimeUpdates(prev => [...prev, {
          id: Date.now(),
          type: 'streak-record',
          message: streakMessage,
          timestamp: new Date().toLocaleTimeString(),
          data: data
        }]);

        handleToast(streakMessage, "success");
      }
    });

    websocketClient.on('connected', () => {
      handleToast("Live dashboard updates activated", "success");
    });

    websocketClient.on('connection-lost', () => {
      handleToast("Live updates paused", "error");
    });

  }, [autoRefresh, handleToast, webSocketConnected]);

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
        websocketClient.off('goal-completed');
        websocketClient.off('goal-progress-updated');
        websocketClient.off('connected');
        websocketClient.off('connection-lost');
      }
    };
  }, [isLoggedIn, webSocketConnected, setupWebSocketHandlers]);

  const flattenedActivities = useMemo(() => {
    try {
      if (!co2Data || typeof co2Data !== 'object') {
        console.error('co2Data is invalid:', co2Data);
        return [];
      }

      const result = [];
      const categories = Object.keys(co2Data);
      
      for (let categoryIndex = 0; categoryIndex < categories.length; categoryIndex++) {
        const category = categories[categoryIndex];
        const categoryActivities = co2Data[category];
        
        if (!Array.isArray(categoryActivities)) {
          continue;
        }

        for (let i = 0; i < categoryActivities.length; i++) {
          const activityObj = categoryActivities[i];
          
          if (!activityObj || typeof activityObj !== 'object') {
            continue;
          }

          const categoryActivity = {
            index: `${categoryIndex}-${i}`,
            category: category,
            activity: activityObj.activity,
            co2Value: activityObj.co2Value
          };
          
          result.push(categoryActivity);
        }
      }

      return result;
    } catch (error) {
      return [];
    }
  }, []);

  const fetchTodaysCO2Data = useCallback(async () => {
    if (!authToken || !isLoggedIn) {
      setTodaysData([]);
      return [];
    }

    try {
      setDashboardLoading(true);
      const today = getUTC(new Date())[0];
      const baseURL = import.meta.env.VITE_BACKEND_URL;
      const searchEndpoint = import.meta.env.VITE_SEARCH_DATA;

      const { data } = await axios.get(
        `${baseURL}${searchEndpoint}?startDate=${today}&endDate=${today}`,
        apiConfig
      );

      if (data?.data) {
        setTodaysData(data.data);
        return data.data;
      } else {
        setTodaysData([]);
        return [];
      }
    } catch (error) {
      if (error.response?.status === 401) {
        clearAuthSession();
        handleToast('Session expired. Please log in again.', 'error');
      }
      
      setTodaysData([]);
      return [];
    } finally {
      setDashboardLoading(false);
    }
  }, [authToken, isLoggedIn, apiConfig, handleToast, clearAuthSession]);

  const fetchStreakData = useCallback(async () => {
    if (!authToken || !isLoggedIn) return;

    try {
      const today = getUTC(new Date())[0];
      const baseURL = import.meta.env.VITE_BACKEND_URL;
      const searchEndpoint = import.meta.env.VITE_SEARCH_DATA;

      const response = await axios.get(
        `${baseURL}${searchEndpoint}`,
        apiConfig
      );

      if (response.status === 200 && response.data?.data && response.data.data.length > 0) {
        const userData = response.data.data;

        let current = 0;
        let highest = 0;
        
        userData.forEach(entry => {
          if (entry.currentStreak) {
            current = Math.max(current, entry.currentStreak);
            highest = Math.max(highest, entry.highestStreak);
          }
        });

        const loggedToday = userData.some(entry => entry.utcDate === today);
        if (!loggedToday) {
          current = 0;
        }

        setCurrentStreak(current);
        setHighestStreak(highest);
      } else {
        setCurrentStreak(0);
        setHighestStreak(0);
      }
    } catch (error) {
      if (error.response?.status === 401) {
        clearAuthSession();
        handleToast('Session expired. Please log in again.', 'error');
      }
      
      setCurrentStreak(0);
      setHighestStreak(0);
    }
  }, [authToken, isLoggedIn, apiConfig, handleToast, clearAuthSession]);

  const fetchGlobalAvgCO2 = useCallback(async () => {
    if (!authToken || !isLoggedIn) return;

    try {
      const today = getUTC(new Date())[0];
      const baseURL = import.meta.env.VITE_BACKEND_URL;
      const avgEndpoint = import.meta.env.VITE_AVG_CO2_DATA;

      const response = await axios.get(
        `${baseURL}${avgEndpoint}?startDate=${today}&endDate=${today}`,
        apiConfig
      );

      if (response.status === 200 && response.data?.data && response.data.data.length > 0) {
        setGlobalAvgCO2(response.data.data[0].averageCO2 || 0);
      } else {
        setGlobalAvgCO2(0);
      }
    } catch (error) {
      if (error.response?.status === 401) {
        clearAuthSession();
        console.log("'Session expired. Please log in again.'");
        handleToast('Session expired. Please log in again.', 'error');
      }
      
      setGlobalAvgCO2(0);
    }
  }, [authToken, isLoggedIn, apiConfig, handleToast, clearAuthSession]);

  const updateDashboard = useCallback((co2Data) => {
    if (!co2Data || co2Data.length === 0) {
      setTotalCO2(0);
      setHighestCategory(null);
      return;
    }

    let totalCO2Value = 0;
    const categoryTotals = {};

    co2Data.forEach((entry) => {
      totalCO2Value += entry.totalCO2 || 0;

      if (entry.co2Data && Array.isArray(entry.co2Data)) {
        entry.co2Data.forEach((item) => {
          if (item && item.category) {
            categoryTotals[item.category] = (categoryTotals[item.category] || 0) + item.co2Value;
          }
        });
      }
    });

    const highest = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];
    if (highest) {
      setHighestCategory({ category: highest[0], value: highest[1] });
    } else {
      setHighestCategory(null);
    }

    setTotalCO2(totalCO2Value);
  }, []);

  const fetchWeeklyGoals = useCallback(async () => {
    if (!authToken || !isLoggedIn) {
      setNoGoalsError('Please log in to view goals');
      return;
    }

    try {
      const response = await axios.get(
        `${import.meta.env.VITE_BACKEND_URL}${import.meta.env.VITE_GET_GOALS_DATA}`,
        apiConfig
      );
      

      if (response.status === 200 && response.data?.data) {
        setWeeklyGoals(response.data.data.userGoals || response.data.data || []);
        setNoGoalsError('');
      } else {
        setWeeklyGoals([]);
        setNoGoalsError(response.data?.message || 'No goals found for this week.');
      }
    } catch (error) {
      if (error.response?.status === 401) {
        clearAuthSession();
        console.log("'Session expired. Please log in again.'");
        handleToast('Session expired. Please log in again.', 'error');
      }
      
      setWeeklyGoals([]);
    }
  }, [authToken, isLoggedIn, apiConfig, handleToast, clearAuthSession]);

  const refreshDashboard = useCallback(async () => {
    try {
      setDashboardLoading(true);
      const [data] = await Promise.all([
        fetchTodaysCO2Data(),
        fetchStreakData(),
        fetchGlobalAvgCO2()
      ]);
      
      if (data) {
        updateDashboard(data);
      }
      setLastUpdated(new Date());
      handleToast('Dashboard updated', 'success');
    } catch (error) {
      console.error('Error refreshing dashboard:', error);
      handleToast('Failed to refresh dashboard', 'error');
    } finally {
      setDashboardLoading(false);
    }
  }, [fetchTodaysCO2Data, fetchStreakData, fetchGlobalAvgCO2, updateDashboard, handleToast]);

  const saveGoals = useCallback(async (updatedGoals) => {
    if (!authToken || !isLoggedIn) {
      handleToast('Please log in to save goals', 'error');
      return;
    }

    try {
      const response = await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}${import.meta.env.VITE_POST_GOALS_DATA}`,
        { goals: updatedGoals },
        apiConfig
      );

      if (response.status === 200) {
        setWeeklyGoals(updatedGoals);
        handleToast('Goals updated successfully', 'success');
      } else {
        handleToast('Failed to save goals', 'error');
      }
    } catch (error) {
      if (error.response?.status === 401) {
        clearAuthSession();
        handleToast('Session expired. Please log in again.', 'error');
      } else {
        console.log(error)
        handleToast('Failed to save goals', 'error');
      }
    }
  }, [authToken, isLoggedIn, apiConfig, handleToast, clearAuthSession]);

  const addGoal = useCallback(() => {
    if (!newGoal.trim()) {
      handleToast('Please enter a goal', 'error');
      return;
    }
    const updated = [...weeklyGoals, { text: newGoal, done: false }];
    setNewGoal('');
    saveGoals(updated);
  }, [newGoal, weeklyGoals, saveGoals, handleToast]);

  const toggleGoal = useCallback((idx) => {
    const updated = weeklyGoals.map((g, i) => 
      i === idx ? { ...g, done: !g.done } : g
    );
    saveGoals(updated);
  }, [weeklyGoals, saveGoals]);

  const removeGoal = useCallback((idx) => {
    const updated = weeklyGoals.filter((_, i) => i !== idx);
    saveGoals(updated);
  }, [weeklyGoals, saveGoals]);

  const addActivityRow = useCallback(() => {
    setActivityRows((prev) => [...prev, { 
      id: Date.now() + Math.random(), 
      selectedId: null 
    }]);
  }, []);

  const removeActivityRow = useCallback((id) => {
    setActivityRows((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const updateActivityRow = useCallback((id, selectedId) => {
    setActivityRows((prev) => 
      prev.map((r) => (r.id === id ? { ...r, selectedId } : r))
    );
  }, []);

  const saveActivityData = useCallback(async () => {
    if (!authToken || !username || !email || !isLoggedIn) {
      handleToast('Please log in to save activities', 'error');
      return;
    }

    try {
      setIsPosting(true);

      const selected = activityRows.map((r) => r.selectedId).filter(Boolean);

      if (!selected.length) {
        handleToast('No activities selected', 'error');
        return;
      }

      const countMap = selected.reduce((acc, index) => {
        acc[index] = (acc[index] || 0) + 1;
        return acc;
      }, {});

      const payloadData = Object.entries(countMap)
        .map(([index, count]) => {
          const base = flattenedActivities.find((opt) => opt.index === index);
          if (!base || !base.category) {
            console.warn(`Activity with index ${index} not found or missing category`);
            return null;
          }
          return {
            id: base.index, 
            category: base.category,
            activity: base.activity,
            co2Value: parseFloat((base.co2Value * count).toFixed(2)),
          };
        })
        .filter(Boolean);

      if (!payloadData.length) {
        handleToast('No valid activities selected', 'error');
        return;
      }

      const total = payloadData.reduce((sum, item) => sum + item.co2Value, 0);
      const body = {
        username: username,
        email: email,
        co2Data: payloadData,
        totalCO2: total,
      };

      const response = await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}${import.meta.env.VITE_POST_DATA}`,
        body,
        apiConfig
      );

      if (response.status === 201 || response.status === 200) {
        handleToast(response.data?.message || 'Activities saved successfully', 'success');

        setActivityRows([]);

        setTimeout(() => navigate('/app/loggerChart'), 1500);
      }
    } catch (error) {
      if (error.response?.status === 401) {
        clearAuthSession();
        handleToast('Session expired. Please log in again.', 'error');
      } else {
        handleToast(
          error.response?.data?.message || 'Failed to save activities',
          'error'
        );
      }
    } finally {
      setIsPosting(false);
    }
  }, [
    authToken, username, email, isLoggedIn, activityRows, flattenedActivities,
    navigate, handleToast, apiConfig, clearAuthSession
  ]);

  const toggleAutoRefresh = useCallback(() => {
    setAutoRefresh(prev => !prev);
    handleToast(
      autoRefresh ? "Auto-refresh disabled" : "Auto-refresh enabled", 
      "info"
    );
  }, [autoRefresh, handleToast]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!isLoggedIn || !authToken) {
      setLoading(false);
      setNoGoalsError('Please log in to view your dashboard');
      return;
    }

    const initializeData = async () => {
      setLoading(true);
      try {
        await Promise.all([
          fetchWeeklyGoals(),
          fetchGlobalAvgCO2(),
          fetchStreakData(),
          fetchTodaysCO2Data().then(data => {
            if (data) updateDashboard(data);
          }),
        ]);
        setLastUpdated(new Date());
      } catch (error) {
        handleToast('Failed to load dashboard data', 'error');
      } finally {
        setLoading(false);
      }
    };

    initializeData();
  }, [
    isLoggedIn, 
    authToken, 
    authLoading,
    fetchWeeklyGoals, 
    fetchGlobalAvgCO2, 
    fetchStreakData, 
    fetchTodaysCO2Data, 
    updateDashboard, 
    handleToast
  ]);

  useEffect(() => {
    if (!authLoading && !isLoggedIn) {
      navigate('/app/login');
    }
  }, [isLoggedIn, authLoading, navigate]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">
            {authLoading ? 'Checking authentication...' : 'Loading your dashboard...'}
          </p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-800 mb-4">Please Log In</h1>
            <p className="text-gray-600 text-lg mb-6">You need to be logged in to view your dashboard.</p>
            <button
              onClick={() => navigate('/app/login')}
              className="bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 transition-colors font-semibold"
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-600/30 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center text-white mb-8">
          <h1 className="text-4xl font-bold mb-2">Welcome, {username}! 🌱</h1>
          <p className="text-lg">Track and reduce your carbon footprint</p>
          
          <div className="flex flex-wrap justify-center items-center mt-4 space-x-4">
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

            {lastUpdated && (
              <div className="flex items-center px-3 py-1 rounded-full text-sm bg-purple-500/20 text-purple-400 border border-purple-400/30">
                <div className="w-2 h-2 bg-purple-400 rounded-full mr-2"></div>
                Updated: {lastUpdated.toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          <div className="space-y-8">
            <section className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-800">Weekly Goals</h2>
                {webSocketConnected && (
                  <div className={`flex items-center gap-2 text-sm ${
                    autoRefresh ? 'text-green-600' : 'text-gray-500'
                  }`}>
                    <div className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                    {autoRefresh ? 'Live' : 'Manual'}
                  </div>
                )}
              </div>
              
              {noGoalsError && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                  <p className="text-yellow-800">{noGoalsError}</p>
                </div>
              )}

              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={newGoal}
                  onChange={(e) => setNewGoal(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addGoal()}
                  placeholder="What's your goal for this week?"
                  className="border border-gray-300 rounded-lg px-4 py-3 flex-1 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={addGoal}
                  className="bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 transition-colors font-semibold"
                >
                  Add Goal
                </button>
              </div>

              <div className="space-y-3">
                {weeklyGoals.map((goal, idx) => (
                  <div key={idx} className={`flex items-center gap-3 p-4 rounded-lg hover:bg-gray-50 transition-colors ${
                    goal.done ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'
                  }`}>
                    <input
                      type="checkbox"
                      checked={Boolean(goal.done)}
                      onChange={() => toggleGoal(idx)}
                      className="w-5 h-5 text-green-500 rounded focus:ring-green-500"
                    />
                    <span className={`flex-1 text-lg ${goal.done ? 'line-through text-gray-500' : 'text-gray-700'}`}>
                      {goal.text || goal.title || '(Untitled goal)'}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeGoal(idx)}
                      className="text-red-500 hover:text-red-700 transition-colors p-2"
                      title="Remove goal"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Your Dashboard</h2>
                <div className="flex items-center gap-3">
                  {webSocketConnected && (
                    <button
                      onClick={toggleAutoRefresh}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                        autoRefresh
                          ? 'bg-blue-100 text-blue-700 border border-blue-300'
                          : 'bg-gray-100 text-gray-700 border border-gray-300'
                      }`}
                    >
                      Auto: {autoRefresh ? 'ON' : 'OFF'}
                    </button>
                  )}
                  <button
                    onClick={refreshDashboard}
                    disabled={dashboardLoading}
                    className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-600 disabled:opacity-50 transition-colors font-semibold"
                  >
                    {dashboardLoading ? 'Refreshing...' : 'Refresh Data'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200">
                  <p className="text-sm text-blue-600 font-semibold mb-1">Highest Streak</p>
                  <p className="text-2xl font-bold text-blue-800">{highestStreak} days</p>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl border border-green-200">
                  <p className="text-sm text-green-600 font-semibold mb-1">Current Streak</p>
                  <p className="text-2xl font-bold text-green-800">{currentStreak} days</p>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl border border-purple-200">
                  <p className="text-sm text-purple-600 font-semibold mb-1">Global Avg CO₂</p>
                  <p className="text-2xl font-bold text-purple-800">{globalAvgCO2} kg</p>
                </div>
                <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-xl border border-orange-200">
                  <p className="text-sm text-orange-600 font-semibold mb-1">Today's CO₂</p>
                  <p className="text-2xl font-bold text-orange-800">{totalCO2.toFixed(2)} kg</p>
                </div>
              </div>

              {highestCategory && (
                <div className="bg-gradient-to-br from-green-50 to-emerald-100 rounded-xl border border-green-200 p-4">
                  <p className="text-sm text-green-800 font-semibold mb-2">Highest Impact Category</p>
                  <p className="text-lg font-bold text-green-900">
                    {highestCategory.category}: {highestCategory.value.toFixed(2)} kg CO₂
                  </p>
                </div>
              )}

              {todaysData.length === 0 && !dashboardLoading && (
                <div className="bg-gradient-to-br from-yellow-50 to-amber-100 rounded-xl border border-yellow-200 p-4 mt-4">
                  <p className="text-yellow-800 font-semibold">
                    No activities logged today. Start logging to see your impact!
                  </p>
                </div>
              )}

              {realTimeUpdates.length > 0 && (
                <div className="mt-6 p-4 bg-gray-50 rounded-xl border">
                  <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    Recent Activity
                  </h3>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {realTimeUpdates.slice(-3).reverse().map((update) => (
                      <div 
                        key={update.id}
                        className={`flex justify-between items-center p-2 rounded text-sm ${
                          update.type === 'new-data' ? 'bg-green-50 text-green-700 border border-green-200' :
                          update.type === 'goal-completed' ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' :
                          update.type === 'streak-record' ? 'bg-orange-50 text-orange-700 border border-orange-200' :
                          'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}
                      >
                        <span>{update.message}</span>
                        <span className="text-xs text-gray-500 whitespace-nowrap ml-2">{update.timestamp}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>

          <div className="space-y-8">
            <section className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-2xl font-bold mb-4 text-gray-800">Log Activities</h2>

              <div className="flex gap-3 mb-6">
                <button
                  type="button"
                  onClick={addActivityRow}
                  className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors font-semibold flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Activity
                </button>

                <button
                  type="button"
                  onClick={saveActivityData}
                  disabled={isPosting}
                  className={`px-6 py-3 rounded-lg transition-colors font-semibold flex items-center gap-2 ${
                    isPosting
                      ? 'bg-gray-400 cursor-not-allowed text-white'
                      : 'bg-green-500 hover:bg-green-600 text-white'
                  }`}
                >
                  {isPosting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Saving...
                    </>
                  ) : (
                    'Save & View Chart'
                  )}
                </button>
              </div>

              {activityRows.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                  <div className="text-gray-400 text-6xl mb-4">📊</div>
                  <p className="text-gray-500 text-lg mb-2">No activities added yet</p>
                  <p className="text-gray-400">Click "Add Activity" to start logging your CO₂ emissions</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {activityRows.map((row) => (
                    <div key={row.id} className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors overflow-hidden">
                      <select
                        value={row.selectedId ?? ''}
                        onChange={(e) => updateActivityRow(row.id, e.target.value)}
                        className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent max-w-[calc(100%-3rem)] overflow-hidden text-ellipsis whitespace-nowrap"
                      >
                        <option value="">Select an activity...</option>
                        {flattenedActivities.map((opt) => (
                          <option key={opt.index} value={opt.index}>
                            {opt.category} — {opt.activity} ({opt.co2Value} kg)
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => removeActivityRow(row.id)}
                        className="text-red-500 hover:text-red-700 transition-colors p-3"
                        title="Remove activity"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {activityRows.length > 0 && (
                <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-200 overflow-hidden">
                  <p className="text-blue-800 text-sm flex items-center gap-2">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <strong>Tip:</strong> Select the same activity multiple times to log repetitions.
                  </p>
                </div>
              )}
            </section>
          </div>
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
    </div>
  );
};

export default Home;