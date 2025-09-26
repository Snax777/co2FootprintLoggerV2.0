import co2Data from '../../data/co2Data.json';
import { useState, useEffect } from 'react';
import { useAppContext } from '../../context/authContext';
import axios from 'axios';
import { getUTC, getMondayDateAndTime } from "../../../../util/dateTimeToUTCConverter";

const Home = () => {
    const { isLoggedIn } = useAppContext();
    const [data, setData] = useState([]);
    const [highestStreak, setHighestStreak] = useState(0);
    const [currentStreak, setCurrentStreak] = useState(0);
    const [globalAvgCO2, setGlobalAvgCO2] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [noDataError, setNoDataError] = useState("");
    const [toast, setToast] = useState(null);
    const mondayDate = getMondayDateAndTime(new Date())[0];
    const currentDate = getUTC(new Date())[0];


    const authToken = sessionStorage.getItem("auth-token");

    const handleGetWeeklyCO2Data = async () => {
        try {
            const { data } = await axios.get(
                `
                ${process.env.REACT_APP_BACKEND_URL}
                ${process.env.REACT_APP_SEARCH_DATA}
                ?startDate=${mondayDate}&endDate=${currentDate}`, 
                { headers: {Authorization: `Bearer ${authToken}`}}
            );

            if (!data.data || data.data.length === 0) {
                setNoDataError(data.message || "No data found for the selected week.");
                return;
            }

            setData(data.data);
            return data.data;
        } catch {
            setData([]);
            setNoDataError("Error fetching data. Please try again later.");
            return [];
        }
    };

    const handleHighestStreak = async () => {
        try {
            let streak = 0;
            const co2Data = await handleGetWeeklyCO2Data();

            if (co2Data.length !== 0) {
                for (let item of co2Data) {
                    streak = item.loggingStreak > streak ? item.loggingStreak : streak;
                }
            }
        } catch {
            setHighestStreak(0);
        }
    };
    // return ("");
}

export default Home;