import { Link } from 'react-router-dom';
import { useState, useEffect, useCallback, useRef } from 'react';

const LandingPage = () => {
  const [liveStats, setLiveStats] = useState({
    totalUsers: 1250,
    totalCO2Saved: 5420,
    activeToday: 89,
    lastUpdate: null
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  
  const isComponentMounted = useRef(true);
  const publicWs = useRef(null);
  const simulationInterval = useRef(null);
  const reconnectTimeout = useRef(null);

  // For public stats, we don't have a JWT token, so we'll use simulation
  // But if you want real WebSocket for public data, you'd need to modify your backend
  const connectToPublicStats = useCallback(() => {
    // Since the backend requires JWT tokens for WebSocket connections
    // and this is a public landing page, we'll use simulation
    console.log('Public page: Using simulated data (backend requires authentication)');
    setConnectionStatus('simulation');
    setIsConnected(false);
    startSimulation();
    return null;
  }, []);

  const startSimulation = useCallback(() => {
    // Clear any existing interval
    if (simulationInterval.current) {
      clearInterval(simulationInterval.current);
    }

    console.log('Starting live data simulation');
    setConnectionStatus('simulation');

    // Initial simulation data
    const activities = [
      "New user joined and started tracking their carbon footprint!",
      "User completed their weekly CO₂ reduction goal! 🌱",
      "Community saved 50kg CO₂ today!",
      "New personal best: 7-day streak achieved!",
      "User reduced transportation emissions by 15% this week!",
      "Team 'EcoWarriors' reached their monthly goal! 🎉",
      "Carbon footprint awareness workshop completed by 25 participants",
      "Local business switched to renewable energy sources",
      "Community garden project offset 200kg CO₂ this month"
    ];

    // Create some initial activity
    const initialActivities = [];
    for (let i = 0; i < 3; i++) {
      initialActivities.push({
        id: Date.now() + i,
        message: activities[Math.floor(Math.random() * activities.length)],
        timestamp: new Date().toLocaleTimeString()
      });
    }
    setRecentActivity(initialActivities);

    simulationInterval.current = setInterval(() => {
      if (!isComponentMounted.current) return;

      setLiveStats(prev => ({
        totalUsers: prev.totalUsers + Math.floor(Math.random() * 2),
        totalCO2Saved: prev.totalCO2Saved + (Math.random() * 5 + 1),
        activeToday: Math.max(50, prev.activeToday + Math.floor(Math.random() * 3 - 1)),
        lastUpdate: new Date().toLocaleTimeString()
      }));

      if (Math.random() > 0.6) { 
        setRecentActivity(prev => {
          const newActivity = {
            id: Date.now(),
            message: activities[Math.floor(Math.random() * activities.length)],
            timestamp: new Date().toLocaleTimeString()
          };
          // Keep only the last 5 activities
          return [...prev.slice(-4), newActivity];
        });
      }
    }, 5000);

    return simulationInterval.current;
  }, []);

  // If you want to add public WebSocket support to your backend, here's what you'd need:
  const connectToPublicStatsWithBackend = useCallback(() => {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/realtime`;
      
      console.log('Attempting to connect to WebSocket:', wsUrl);
      publicWs.current = new WebSocket(wsUrl);
      setConnectionStatus('connecting');

      publicWs.current.onopen = () => {
        console.log('✅ Connected to WebSocket');
        setConnectionStatus('connected');
        setIsConnected(true);
        
        // For public stats, we'd need to send a message to subscribe to public data
        // This would require backend support for public subscriptions
        publicWs.current.send(JSON.stringify({
          type: 'subscribe-public-stats'
        }));
      };

      publicWs.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('WebSocket message received:', data);
          
          if (data.type === 'public-stats') {
            setLiveStats(prev => ({
              ...prev,
              ...data.payload,
              lastUpdate: new Date().toLocaleTimeString()
            }));
          } else if (data.type === 'recent-activity') {
            setRecentActivity(prev => [
              ...prev.slice(0, 4), 
              {
                id: Date.now(),
                message: data.payload.message,
                timestamp: new Date().toLocaleTimeString()
              }
            ]);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      publicWs.current.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        setConnectionStatus('disconnected');
        setIsConnected(false);
        
        if (event.code !== 1000 && isComponentMounted.current) {
          console.log('Attempting to reconnect in 5 seconds...');
          reconnectTimeout.current = setTimeout(connectToPublicStats, 5000);
        }
      };

      publicWs.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus('error');
        setIsConnected(false);
      };

      return publicWs.current;
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setConnectionStatus('error');
      setIsConnected(false);
      startSimulation();
      return null;
    }
  }, []);

  useEffect(() => {
    isComponentMounted.current = true;
    
    // Since the backend requires authentication for WebSocket connections
    // and this is a public page, we'll use simulation
    connectToPublicStats();

    return () => {
      isComponentMounted.current = false;
      
      // Cleanup WebSocket
      if (publicWs.current) {
        publicWs.current.close(1000, 'Component unmounting');
        publicWs.current = null;
      }
      
      // Cleanup intervals and timeouts
      if (simulationInterval.current) {
        clearInterval(simulationInterval.current);
        simulationInterval.current = null;
      }
      
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
        reconnectTimeout.current = null;
      }
    };
  }, [connectToPublicStats]);

  const formatCO2 = (value) => {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)} tons`;
    }
    return `${value.toFixed(0)} kg`;
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'bg-green-400';
      case 'connecting': return 'bg-yellow-400';
      case 'simulation': return 'bg-blue-400';
      case 'error': return 'bg-red-400';
      default: return 'bg-gray-400';
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return 'Live Server';
      case 'connecting': return 'Connecting...';
      case 'simulation': return 'Demo Mode';
      case 'error': return 'Connection Error';
      default: return 'Disconnected';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900/90 via-blue-900/80 to-purple-900/90 text-white">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -inset-10 opacity-20">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-green-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse"></div>
          <div className="absolute top-1/3 right-1/4 w-64 h-64 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse delay-1000"></div>
          <div className="absolute bottom-1/4 left-1/2 w-64 h-64 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse delay-2000"></div>
        </div>
      </div>

      <div className="relative z-10 flex items-center justify-center min-h-screen py-12 px-4">
        <div className="max-w-6xl w-full">
          {/* Connection Status Banner */}
          <div className={`mb-6 p-3 rounded-lg backdrop-blur-sm border ${
            connectionStatus === 'connected' ? 'bg-green-500/20 border-green-400/30' :
            connectionStatus === 'simulation' ? 'bg-blue-500/20 border-blue-400/30' :
            connectionStatus === 'connecting' ? 'bg-yellow-500/20 border-yellow-400/30' :
            'bg-gray-500/20 border-gray-400/30'
          }`}>
            <div className="flex items-center justify-center gap-2">
              <div className={`w-2 h-2 rounded-full animate-pulse ${getStatusColor()}`}></div>
              <span className="text-sm font-medium">{getStatusText()}</span>
              {connectionStatus === 'simulation' && (
                <span className="text-xs opacity-75">(Using demo data - login for real-time updates)</span>
              )}
            </div>
          </div>

          <div className="text-center mb-16">
            <h1 className="text-7xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-green-400 via-blue-400 to-purple-400">
              CO₂Logger
            </h1>
            <p className="text-xl mb-8 max-w-2xl mx-auto leading-relaxed">
              CO₂Logger is your personal carbon footprint companion. 
              Track your daily activities, measure their CO₂ impact, and set weekly goals to make a real difference.
            </p>

            <div className="flex flex-wrap justify-center gap-6 mb-12">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 min-w-[200px] border border-white/20">
                <div className="text-2xl font-bold text-green-400">
                  {liveStats.totalUsers}+
                </div>
                <div className="text-sm text-gray-300">Users Tracking</div>
                <div className="flex items-center mt-1">
                  <div className={`w-2 h-2 rounded-full animate-pulse mr-2 ${getStatusColor()}`}></div>
                  <div className="text-xs opacity-75">{getStatusText()}</div>
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 min-w-[200px] border border-white/20">
                <div className="text-2xl font-bold text-blue-400">
                  {formatCO2(liveStats.totalCO2Saved)}
                </div>
                <div className="text-sm text-gray-300">CO₂ Saved</div>
                {liveStats.lastUpdate && (
                  <div className="text-xs text-gray-400 mt-1">
                    Updated: {liveStats.lastUpdate}
                  </div>
                )}
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 min-w-[200px] border border-white/20">
                <div className="text-2xl font-bold text-purple-400">
                  {liveStats.activeToday}+
                </div>
                <div className="text-sm text-gray-300">Active Today</div>
                <div className="text-xs text-gray-400 mt-1">Making a difference</div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link
                to="/app/register"
                className="px-8 py-4 bg-gradient-to-r from-green-500 to-blue-500 text-white font-bold rounded-2xl hover:from-green-600 hover:to-blue-600 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl text-lg"
              >
                Start Tracking Free
              </Link>
              <Link
                to="/app/login"
                className="px-8 py-4 bg-white/20 backdrop-blur-sm text-white font-bold rounded-2xl hover:bg-white/30 transition-all duration-300 border border-white/30 text-lg"
              >
                Sign In
              </Link>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 hover:border-green-400/50 transition-all duration-300">
              <div className="text-4xl mb-4">📊</div>
              <h3 className="text-xl font-bold mb-3 text-green-400">Real-time Analytics</h3>
              <p className="text-gray-300">
                Live charts and insights showing your carbon footprint across different categories with instant updates.
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 hover:border-blue-400/50 transition-all duration-300">
              <div className="text-4xl mb-4">🎯</div>
              <h3 className="text-xl font-bold mb-3 text-blue-400">Smart Goal Tracking</h3>
              <p className="text-gray-300">
                Set weekly reduction targets and get live progress updates with achievement celebrations.
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 hover:border-purple-400/50 transition-all duration-300">
              <div className="text-4xl mb-4">🌍</div>
              <h3 className="text-xl font-bold mb-3 text-purple-400">Community Impact</h3>
              <p className="text-gray-300">
                Join others in reducing carbon emissions and see your collective environmental impact grow.
              </p>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20 mb-12">
            <h2 className="text-2xl font-bold mb-6 text-center text-green-400">
              {connectionStatus === 'connected' ? '🌱 Live Community Activity' : '🌱 Demo Community Activity'}
            </h2>
            <div className="space-y-3 max-h-48 overflow-y-auto">
              {recentActivity.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <div className="text-4xl mb-2">🌿</div>
                  <p>Loading community activity...</p>
                  <p className="text-sm mt-1">Be the first to make an impact!</p>
                </div>
              ) : (
                recentActivity.slice().reverse().map((activity) => (
                  <div 
                    key={activity.id}
                    className="flex items-start gap-3 p-3 bg-white/5 rounded-xl border border-white/10 hover:border-green-400/30 transition-all duration-200"
                  >
                    <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 animate-pulse ${getStatusColor()}`}></div>
                    <div className="flex-1">
                      <p className="text-sm">{activity.message}</p>
                      <p className="text-xs text-gray-400 mt-1">{activity.timestamp}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-yellow-500/20 backdrop-blur-sm rounded-2xl p-6 border border-yellow-400/30">
            <div className="flex items-start gap-3">
              <div className="text-yellow-400 text-xl mt-1">⚠️</div>
              <div>
                <h3 className="font-bold text-yellow-400 mb-2">Development Mode Active</h3>
                <p className="text-sm">
                  {connectionStatus === 'simulation' 
                    ? "You're viewing the public landing page with demo data. After signing in, you'll get real-time WebSocket updates with your personalized data."
                    : "This project demonstrates real-time capabilities with WebSocket integration. Sign in to experience live data updates."
                  }
                </p>
              </div>
            </div>
          </div>

          <footer className="text-center mt-12 pt-8 border-t border-white/20">
            <p className="text-gray-400 text-sm">
              Built with modern web technologies including React, Node.js, MongoDB, and real-time WebSocket communication.
            </p>
            <div className="mt-2 flex items-center justify-center gap-2">
              <div className={`w-2 h-2 rounded-full animate-pulse ${getStatusColor()}`}></div>
              <span className="text-xs text-gray-400">
                {connectionStatus === 'connected' ? 'Connected to live server' : 
                 connectionStatus === 'simulation' ? 'Running with demo data' :
                 connectionStatus === 'connecting' ? 'Attempting to connect...' : 
                 'Connection unavailable'}
              </span>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;