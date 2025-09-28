import co2Data from '../../../../util/data/co2-value.json';
import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const Home = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [highestStreak, setHighestStreak] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [globalAvgCO2, setGlobalAvgCO2] = useState(0);
  const [totalCO2, setTotalCO2] = useState(0);
  const [highestCategory, setHighestCategory] = useState(null);
  const [weeklyGoals, setWeeklyGoals] = useState([]);
  const [newGoal, setNewGoal] = useState("");
  const [noGoalsError, setNoGoalsError] = useState("");
  const [activityRows, setActivityRows] = useState([]);
  const [isPosting, setIsPosting] = useState(false);
  const [toast, setToast] = useState(null);

  const authToken = sessionStorage.getItem("auth-token");

  const handleToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 1500);
  };

  // Safe flattening of activities with error handling
  const flattenedActivities = useMemo(() => {
    try {
      if (!co2Data || typeof co2Data !== 'object') {
        console.error('co2Data is invalid:', co2Data);
        return [];
      }
      
      return Object.entries(co2Data).flatMap(([category, activities], catIndex) => {
        if (!Array.isArray(activities)) {
          console.warn(`Activities for category ${category} is not an array:`, activities);
          return [];
        }
        
        return activities.map((item, actIndex) => ({
          id: `${catIndex}-${actIndex}`,
          category: category || 'Unknown',
          activity: item?.activity || 'Unknown activity',
          co2Value: typeof item?.co2Value === 'number' ? item.co2Value : 0
        }));
      });
    } catch (err) {
      console.error('Error flattening activities:', err);
      return [];
    }
  }, []);

  // --- Weekly Goals Handlers ---
  const fetchLastWeeklyGoals = async () => {
    if (!authToken) {
      setNoGoalsError("Please log in to view goals");
      setLoading(false);
      return;
    }

    try {
      const { data } = await axios.get(
        `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'}/api/goals/weeklyGoals`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );

      if (!data?.data || data.data.length === 0) {
        setWeeklyGoals([]);
        setNoGoalsError(data?.message || "No goals found for the selected week.");
      } else {
        setWeeklyGoals(data.data);
        setNoGoalsError("");
      }
    } catch (err) {
      console.error('Error fetching goals:', err);
      setWeeklyGoals([]);
      setNoGoalsError("Error fetching goals. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  // Fetch goals on component mount
  useEffect(() => {
    fetchLastWeeklyGoals();
  }, []);

  const saveGoals = async (updatedGoals) => {
    if (!authToken) {
      handleToast("Please log in to save goals", "error");
      return;
    }

    try {
      setWeeklyGoals(updatedGoals);
      await axios.post(
        `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'}/api/goals/`,
        { goals: updatedGoals },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      handleToast("Goals updated", "success");
    } catch (err) {
      console.error('Error saving goals:', err);
      handleToast("Failed to save goals", "error");
    }
  };

  const addGoal = () => {
    if (!newGoal.trim()) {
      handleToast("Please enter a goal", "error");
      return;
    }
    const updated = [...weeklyGoals, { text: newGoal, done: false }];
    setNewGoal("");
    saveGoals(updated);
  };

  const toggleGoal = (idx) => {
    const updated = weeklyGoals.map((g, i) =>
      i === idx ? { ...g, done: !g.done } : g
    );
    saveGoals(updated);
  };

  const removeGoal = (idx) => {
    const updated = weeklyGoals.filter((_, i) => i !== idx);
    saveGoals(updated);
  };

  // --- Activity Row Handlers ---
  const addActivityRow = () => {
    setActivityRows(prev => [...prev, { id: Date.now() + Math.random(), selectedId: null }]);
  };

  const removeActivityRow = (id) => {
    setActivityRows(prev => prev.filter(r => r.id !== id));
  };

  const updateActivityRow = (id, selectedId) => {
    setActivityRows(prev =>
      prev.map(r => (r.id === id ? { ...r, selectedId } : r))
    );
  };

  // --- Save Activity Data Handler ---
  const saveActivityData = async () => {
    if (!authToken) {
      handleToast("Please log in to save activities", "error");
      return;
    }

    try {
      setIsPosting(true);

      // Collect selected activity IDs
      const selected = activityRows.map(r => r.selectedId).filter(Boolean);

      if (!selected.length) {
        handleToast("No activities selected", "error");
        return;
      }

      // Count occurrences per activity
      const countMap = selected.reduce((acc, id) => {
        acc[id] = (acc[id] || 0) + 1;
        return acc;
      }, {});

      // Build payload array
      const payloadData = Object.entries(countMap).map(([id, count]) => {
        const base = flattenedActivities.find(opt => opt.id === id);
        if (!base) {
          console.warn(`Activity with id ${id} not found`);
          return null;
        }
        return {
          id: base.id,
          category: base.category,
          activity: base.activity,
          co2Value: parseFloat((base.co2Value * count).toFixed(2))
        };
      }).filter(Boolean); // Remove null entries

      if (!payloadData.length) {
        handleToast("No valid activities selected", "error");
        return;
      }

      // Compute total CO₂
      const total = payloadData.reduce((sum, item) => sum + item.co2Value, 0);

      // Compute highest category for dashboard
      const categoryTotals = payloadData.reduce((acc, item) => {
        acc[item.category] = (acc[item.category] || 0) + item.co2Value;
        return acc;
      }, {});
      
      const highest = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];
      if (highest) {
        setHighestCategory({ category: highest[0], value: highest[1] });
      }
      setTotalCO2(total);

      // Build request body for backend
      const body = {
        username: sessionStorage.getItem("username") || "Anonymous",
        data: payloadData,
        totalCO2: total
      };

      // POST to /api/data/
      const { data } = await axios.post(
        `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'}/api/data/`,
        body,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );

      handleToast(data?.message || "Activities saved successfully", "success");

      // Navigate after success
      setTimeout(() => navigate("/app/loggerChart"), 1500);
    } catch (err) {
      console.error('Error saving activities:', err);
      handleToast("Failed to save activities", "error");
    } finally {
      setIsPosting(false);
    }
  };

  // Show loading state
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-red-600 text-lg">{error}</div>
      </div>
    );
  }

  return (
    <div className="flex gap-8 p-6">
      <div className="flex-1 space-y-8">
        {/* Weekly Goals */}
        <section className="bg-white shadow rounded p-6">
          <h2 className="text-xl font-bold mb-4">Weekly Goals</h2>
          {noGoalsError && <p className="text-red-600 mb-4">{noGoalsError}</p>}

          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newGoal}
              onChange={(e) => setNewGoal(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addGoal()}
              placeholder="Type a new goal..."
              className="border rounded px-3 py-2 flex-1"
            />
            <button
              type="button"
              onClick={addGoal}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Add Goal
            </button>
          </div>

          <ul className="space-y-2">
            {weeklyGoals.map((goal, idx) => (
              <li key={idx} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={Boolean(goal.done)}
                  onChange={() => toggleGoal(idx)}
                  className="w-4 h-4"
                />
                <span className={`border rounded px-2 py-1 flex-1 ${goal.done ? 'line-through text-gray-500' : ''}`}>
                  {goal.text || goal.title || "(Untitled goal)"}
                </span>
                <button
                  type="button"
                  onClick={() => removeGoal(idx)}
                  className="text-red-600 hover:underline ml-2"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* Dashboard */}
        <section className="bg-white shadow rounded p-6">
          <h2 className="text-xl font-bold mb-4">Dashboard</h2>
          <div className="space-y-2">
            <p><strong>Highest Streak:</strong> {highestStreak} days</p>
            <p><strong>Current Streak:</strong> {currentStreak} days</p>
            <p><strong>Global Avg CO₂:</strong> {globalAvgCO2} kg</p>
            <p><strong>Total CO₂:</strong> {totalCO2} kg</p>
            <p><strong>Highest Category:</strong>{" "}
              {highestCategory ? `${highestCategory.category} (${highestCategory.value} kg CO\u2082)` : "—"}
            </p>
          </div>
        </section>
      </div>

      {/* Log Activities */}
      <div className="flex-1 space-y-8">
        <section className="bg-white shadow rounded p-6">
          <h2 className="text-xl font-bold mb-4">Log Activities</h2>

          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={addActivityRow}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Add activity row
            </button>

            <button
              type="button"
              onClick={saveActivityData}
              disabled={isPosting}
              className={`bg-green-600 text-white px-4 py-2 rounded ${
                isPosting ? "opacity-60 cursor-not-allowed" : "hover:bg-green-500"
              }`}
            >
              {isPosting ? "Saving..." : "Save & Go to Chart"}
            </button>
          </div>

          {activityRows.length === 0 ? (
            <p className="text-gray-500">No activities added yet. Click "Add activity row" to start.</p>
          ) : (
            <ul className="space-y-2">
              {activityRows.map(row => (
                <li key={row.id} className="flex items-center gap-3">
                  <select
                    value={row.selectedId ?? ""}
                    onChange={(e) => updateActivityRow(row.id, e.target.value)}
                    className="border rounded px-3 py-2 flex-1"
                  >
                    <option value="">Select an activity...</option>
                    {flattenedActivities.map(opt => (
                      <option key={opt.id} value={opt.id}>
                        {opt.category} — {opt.activity} ({opt.co2Value} kg)
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => removeActivityRow(row.id)}
                    className="text-red-600 hover:underline whitespace-nowrap"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Toast */}
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
  );
};

export default Home;