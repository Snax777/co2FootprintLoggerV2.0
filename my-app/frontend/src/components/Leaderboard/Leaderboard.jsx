import axios from "axios";
import { useState } from "react";
import { getUTC } from "../../../../util/dateTimeToUTCConverter";

const backendUrl = process.env.REACT_APP_BACKEND_URL;

const Leaderboard = () => {
    const currentDateAndTime = new Date();
    const currentMilliseconds = Date.now();
    const [startDateAndTime, setStartDateAndTime] = useState(getUTC(currentDateAndTime));
    const [endDateAndTime, setEndDateAndTime] = useState(getUTC(currentDateAndTime));
    const [errorMessage, setErrorMessage] = useState("");
    const [co2Data, setCO2Data] = useState(null);
    const [showTable, setShowTable] = useState(false);
    const sameDateGlobal = startDateAndTime[0] === endDateAndTime[0];
    let paragraphSubstring = sameDateGlobal ? `of today` : `from ${startDateAndTime[0]} to ${endDateAndTime[0]}`;

    const handleEarlyDateTracking = (event) => {
        const dateRange = parseInt(event.target.value);
        const earlyMilliseconds = currentMilliseconds - (dateRange * 24 * 3600000);
        const earlyDate = new Date(earlyMilliseconds);

        return getUTC(earlyDate);
    };
    
    const handleDataFetch = async (event, dateRange) => {
        try {
            event.preventDefault();

            const base = backendUrl + process.env.REACT_APP_SCOREBOARD_DATA;

            const { data } = await axios.get(`${base}?${dateRange}`);

            if (data.data.length > 0) {
                setCO2Data(data.data);
                setShowTable(true);
            } else {
                setErrorMessage("No data");
                setCO2Data(null);
            }
        } catch {
            setErrorMessage("No data");
            setCO2Data(null);
        }
    };

    const handleCreateLeaderboard = async (event) => {
        event.preventDefault();
        setShowTable(false);
        setErrorMessage("");

        const earlyDateAndTime = handleEarlyDateTracking(event);

        setStartDateAndTime(earlyDateAndTime);
        
        const sameDateLocal = earlyDateAndTime[0] === endDateAndTime[0];
        let queryDateRange = sameDateLocal ?
         `${earlyDateAndTime[0]}` : 
         `startDate=${earlyDateAndTime[0]}&endDate=${endDateAndTime[0]}`;

        await handleDataFetch(event, queryDateRange);
    };

    return (
        <div id="leaderboard" className="flex bg-green-500/50 text-white justify-center mt-6">
            <p className="flex text-2xl font-bold">CO2 Leaderboard</p>
            <select id="date-range" onChange={handleCreateLeaderboard}>
                <option value="" disabled={true}>Select a date range</option>
                <option value="0">Today</option>
                <option value="1">Yesterday</option>
                <option value="7">Last 7 days</option>
                <option value="28">Last 28 days</option>
                <option value="30">Last 30 days</option>
                <option value="31">Last 31 days</option>
            </select>
            {
            ((showTable && co2Data) && (!errorMessage)) ? 
            <div>
                <p>
                    {`The top 20 users with lowest CO<sub>2</sub> emissions ${paragraphSubstring}`}
                </p>
                <table>
                    <thead>
                        <tr>
                            <th scope="col">Rank</th>
                            <th scope="col">User</th>
                            <th scope="col">Average CO<sub>2</sub></th>
                            <th scope="col">Total CO<sub>2</sub></th>
                        </tr>
                    </thead>
                    <tbody>
                        {co2Data.map((data, index) => (
                            <tr key={data.username}>
                                <td>{index + 1}</td>
                                <td>{data.username}</td>
                                <td>{data.averageCO2.toString()}</td>
                                <td>{data.totalCO2.toString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div> : 
            (errorMessage) ? 
            <div>
                {errorMessage}
            </div> : ""
            }
        </div>
    )
};

export default Leaderboard;