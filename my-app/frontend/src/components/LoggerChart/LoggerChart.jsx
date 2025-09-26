import co2Data from "../../../../util/data/co2-value.json";
import { useState } from "react";
import axios from "axios";
import { getUTC } from "../../../../util/dateTimeToUTCConverter";
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
    const currentDateAndTime = new Date();
    const currentMilliseconds = Date.now();
    const [fetchedCO2Data, setFetchedCO2Data] = useState([]);
    const [startDateAndTime, setStartDateAndTime] = useState(getUTC(currentDateAndTime));
    const [endDateAndTime, setEndDateAndTime] =  useState(getUTC(currentDateAndTime));
    const sameDateGlobal = startDateAndTime[0] === endDateAndTime[0];
    let paragraphSubstring = sameDateGlobal ? "for today" : `from ${startDateAndTime[0]} to ${endDateAndTime[0]}`;
    const [errorMessage, setErrorMessage] = useState("");
    const [showChart, setShowChart] = useState(false);
    const [formattedData, setFormattedData] = useState([]);
    const [uniqueColors, setUniqueColors] = useState([]);

    const authToken = sessionStorage.getItem("auth-token");

    const chartData = {
        labels: formattedData.map(data => data.co2Category),
        datasets: [
            {
                label: "Total CO\u2082 Emissions (kg)", 
                data: formattedData.map(data => data.co2Value),
                backgroundColor: uniqueColors,
                borderWidth: 1,
            }
        ]
    };
    const chartOptions = {
        responsive: true, 
        maintainAspectRatio: false, 
        plugins: {
            title: {
                display: true, 
                text: `CO\u2082 Emissions (kg) by Category ${paragraphSubstring}`,
                font: {
                    size: 18, 
                    weight: "bold", 
                }
            }, 
            legend: {
                display: true, 
                position: "right", 
                labels: {
                    font: {
                        size: 12, 
                        weight: "normal",
                    }, 
                    color: "#000"
                }
            }, 
            tooltip: {
                callbacks: {
                    label: (context) => {
                        const value = context.raw;
                        return `${value.toLocaleString()} kg CO\u2082`;
                    }
                }
            }
        }, 
        scales: {
            x: {
                stacked: true,
                title: {
                    display: true, 
                    text: "CO\u2082 Category",
                    font: {
                        size: 12,
                        weight: "bold"
                    }
                }
            }, 
            y: {
                stacked: true,
                beginAtZero: true, 
                title: {
                    display: true, 
                    text: "Total CO\u2082 (kg)",
                    font: {
                        size: 12, 
                        weight: "bold"
                    }
                }
            }
        }
    };

    const handleEarlyDateTracking = (event) => {
        const dateRange = parseInt(event.target.value);
        const earlyMilliseconds = currentMilliseconds - (dateRange * 24 * 3600000);
        const earlyDateAndTime = new Date(earlyMilliseconds);

        return getUTC(earlyDateAndTime);
    };

    const handleDataFetch = async (event, dateRange) => {
        try {
            event.preventDefault();

            const base = process.env.REACT_APP_BACKEND_URL + process.env.REACT_APP_SEARCH_DATA;
            const { data } = await axios.get(
                `${base}${dateRange}`, 
                { headers: {Authorization: `Bearer ${authToken}`}}
            );

            if (data.data.length > 0) {
                setFetchedCO2Data(data.data);
                setShowChart(true);

                return data.data;
            } else {
                setErrorMessage("No data found");
                setFetchedCO2Data(null);

                return [];
            }
        } catch {
            setErrorMessage("No data found");
            setFetchedCO2Data(null);
        }
    };

    const handleFormatCO2Data = async (rawData) => {
        let newData = [];
        const categories = Object.keys(co2Data);

        if (rawData.length > 0) {
            for (let category of categories) {
                let data1 = {};
                let totalCO2 = 0;
                
                for (let item of rawData) {
                    let data2 = item.co2Data;
                    totalCO2 = data2
                    .filter((data) => data.co2Category === category)
                    .reduce((val, data) => {return val + data.co2Value;}, 0);
                }

                data1.co2Category = category;
                data1.co2Value = totalCO2;

                newData.push(data1);
            }
            

            setFormattedData(newData);
        }

        return newData;
    };

    const handleUniqueIntGenerator = (min=0, max=100, includeMax=true) => {
        min = Math.floor(min);
        max = Math.ceil(max);
        const range = includeMax ? (max - min) + 1 : max - min;
        let randomNumber;
        
        do {
            randomNumber = crypto.getRandomValues(new Uint32Array(1))[0];
        } while (randomNumber >= Math.floor(4294967295 / range) * range);

        return min + (randomNumber % range);
    }

    const handleUniqueColors = async (length) => {
        let colors = [];

        for (let i = 0; i < length; i++) {
            const hue = Math.floor((360 / length) * i);
            const saturation = handleUniqueIntGenerator(25, 75);
            const lightness = handleUniqueIntGenerator(40, 60);
            const newColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;

            colors.push(newColor);
        }

        setUniqueColors(colors);
    }

    const handleCreateChart = async (event) => {
        try {
            event.preventDefault();

            setShowChart(false);
            setErrorMessage("");

            const earlyDateAndTime = handleEarlyDateTracking(event);

            setStartDateAndTime(earlyDateAndTime);
            
            const sameDateLocal = earlyDateAndTime[0] === endDateAndTime[0];
            let queryDateRange = sameDateLocal ?
            `${earlyDateAndTime[0]}` : 
            `startDate=${earlyDateAndTime[0]}&endDate=${endDateAndTime[0]}`;

            const rawCO2Data = await handleDataFetch(event, queryDateRange);
            const newData = await handleFormatCO2Data(rawCO2Data);

            await handleUniqueColors(newData.length);
        } catch {
            setErrorMessage("No data found");
            setFetchedCO2Data(null);
        }
    };

    return (
        <div id="logger-chart" className="flex flex-col bg-green-500/50 text-white items-center mt-6">
            <p className="flex text-2xl font-bold">Chart of CO<sub>2</sub> Data</p>
            <select 
            id="date-range" 
            onChange={handleCreateChart}
            className="flex bg-green-600 text-white">
                <option value="" disabled={!errorMessage && !showChart}>Select a date range</option>
                <option value="0">Today</option>
                <option value="1">Yesterday</option>
                <option value="7">Last 7 days</option>
                <option value="28">Last 28 days</option>
                <option value="30">Last 30 days</option>
                <option value="31">Last 31 days</option>
            </select>
            {
                (showChart && fetchedCO2Data.length > 0 && !errorMessage) ? 
                <div className="w-4/5 h-72 bg-white/60 border rounded-md mt-3 p-4">
                    <Bar data={chartData} options={chartOptions} className="w-full h-full"/>
                </div> : 
                ((fetchedCO2Data.length === 0) || errorMessage) ? 
                <div className="
                flex 
                bg-red-300 
                text-red-600 
                rounded-md 
                border-red-900 
                items-center
                justify-center
                p-4">
                    <h1>No data found</h1>
                </div> : ""
            }
        </div>
    )
};

export default LoggerChart;