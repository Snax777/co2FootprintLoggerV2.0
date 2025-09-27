import co2Data from '../../data/co2Data.json';
import { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../../context/authContext';
import axios from 'axios';
import { getUTC, getMondayDateAndTime, getEarlyDate } from "../../../../util/dateTimeToUTCConverter";
import { useNavigate } from 'react-router-dom';

const Home = () => {
  const { isLoggedIn } = useAppContext();
  const navigate = useNavigate();

  const [highestStreak, setHighestStreak] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [globalAvgCO2, setGlobalAvgCO2] = useState(0);
  const [totalCO2, setTotalCO2] = useState(0);
  const [highestCategory, setHighestCategory] = useState(null);
  const [weeklyGoals, setWeeklyGoals] = useState([]);
  const [noGoalsError, setNoGoalsError] = useState("");
  const [activityRows, setActivityRows] = useState([]);
  const [isPosting, setIsPosting] = useState(false);
  const [toast, setToast] = useState(null);

  const mondayDate = getMondayDateAndTime(new Date())[0];
  const currentDate = getUTC(new Date())[0];
  const authToken = sessionStorage.getItem("auth-token");

  const handleToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 1500);
  };

  const flattenedActivities = useMemo(() => {
    return Object.entries(co2Data).flatMap(([category, activities], catIndex) =>
      activities.map((item, actIndex) => ({
        id: `${catIndex}-${actIndex}`,
        category,
        activity: item.activity,
        co2Value: item.co2Value
      }))
    );
  }, []);

  const selectedIds = useMemo(
    () => new Set(activityRows.map(r => r.selectedId).filter(Boolean)),
    [activityRows]
  );

  const fetchLastWeeklyGoals = async () => {
    try {
      const { data } = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}${process.env.REACT_APP_GET_GOALS_DATA}`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );

      if (!data.data || data.data.length === 0) {
        setWeeklyGoals([]);
        setNoGoalsError(data.message || "No goals found for the selected week.");
      } else {
        setWeeklyGoals(data.data);
        setNoGoalsError("");
      }
    } catch {
      setWeeklyGoals([]);
      setNoGoalsError("Error fetching goals. Please try again later.");
    }
  };

  useEffect(() => {
    fetchLastWeeklyGoals();
  }, [authToken, mondayDate, currentDate]);

  const addActivityRow = () => {
    setActivityRows(prev => [...prev, { id: Date.now(), selectedId: null }]);
  };

  const removeActivityRow = (id) => {
    setActivityRows(prev => prev.filter(r => r.id !== id));
  };

  const updateActivityRow = (id, selectedId) => {
    setActivityRows(prev =>
      prev.map(r => (r.id === id ? { ...r, selectedId } : r))
    );
  };

  const postSelectedActivities = async () => {
    try {
      setIsPosting(true);

      const selected = activityRows.map(r => r.selectedId).filter(Boolean);
      const countMap = selected.reduce((acc, id) => {
        acc[id] = (acc[id] || 0) + 1;
        return acc;
      }, {});

      const payload = Object.entries(countMap).map(([id, count]) => {
        const base = flattenedActivities.find(opt => opt.id === id);
        return {
          id: base.id,
          category: base.category,
          activity: base.activity,
          co2Value: parseFloat((base.co2Value * count).toFixed(2))
        };
      });

      if (!payload.length) {
        handleToast("No activities selected", "error");
        setIsPosting(false);
        return;
      }

      const { data } = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}${process.env.REACT_APP_POST_GOALS_DATA}`,
        payload,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );

      handleToast(data.message || "Activities saved successfully", "success");
      setTimeout(() => navigate("/app/loggerChart"), 1500);
    } catch {
      handleToast("Failed to save activities", "error");
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className="flex gap-8">
      <div className="flex-1 space-y-8">
        <section className="bg-white shadow rounded p-6">
          <h2 className="text-xl font-bold mb-4">Weekly Goals</h2>
          {noGoalsError && <p className="text-red-600">{noGoalsError}</p>}
          <ul className="space-y-2">
            {weeklyGoals.map((goal, idx) => (
              <li key={goal.id || idx} className="flex items-center gap-2">
                <input type="checkbox" checked={Boolean(goal.done)} readOnly />
                <span className="border rounded px-2 py-1 flex-1">
                  {goal.text || goal.title || "(Untitled goal)"}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="bg-white shadow rounded p-6">
          <h2 className="text-xl font-bold mb-4">Dashboard</h2>
          <p><strong>Highest Streak:</strong> {highestStreak} days</p>
          <p><strong>Current Streak:</strong> {currentStreak} days</p>
          <p><strong>Global Avg CO₂:</strong> {globalAvgCO2} kg</p>
          <p><strong>Total CO₂:</strong> {totalCO2} kg</p>
          <p><strong>Highest Category:</strong>{" "}
            {highestCategory ? `${highestCategory.category} (${highestCategory.value} kg CO\u2082)` : "—"}
          </p>
        </section>
      </div>

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
              onClick={postSelectedActivities}
              disabled={isPosting}
              className={`bg-green-600 text-white px-4 py-2 rounded ${
                isPosting ? "opacity-60 cursor-not-allowed" : "hover:bg-green-500"
              }`}
            >
              {isPosting ? "Saving..." : "Save & Go to Chart"}
            </button>
          </div>

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
                    <option
                      key={opt.id}
                      value={opt.id}
                      disabled={selectedIds.has(opt.id) && row.selectedId !== opt.id}
                    >
                      {opt.category} — {opt.activity} ({opt.co2Value} kg)
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => removeActivityRow(row.id)}
                  className="text-red-600 hover:underline"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>

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