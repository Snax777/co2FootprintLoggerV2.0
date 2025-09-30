import Router from "express";
import { co2DataDB } from "../models/CO2DataDB.js";
import { config } from "dotenv";
import { validationResult } from "express-validator";
import pino from "pino";
import jwt from "jsonwebtoken";
import { 
    getUTC, 
    getMondayDateAndTime, 
    getSundayDateAndTime, 
    formatToGBLocale 
} from "../../util/dateTimeToUTCConverter.js";

const router = Router();
const logger = pino();

config();

if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET has no value');
}

router.post('/', async (req, res, next) => { 
    try {
        const authHeader = req.header('Authorization');

        if (!authHeader) {
            logger.error("Access denied. No token provided (/ POST request)");

            return res.status(401).json({
                message: "Access denied. No token provided"
            });
        }

        const token = authHeader.replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.user.id;
        const userEmail = decoded.user.email;

        if (!userId || !userEmail) {
            logger.error("User not logged in");

            return res.status(400).json({
                message: "User not logged in",
            });
        }

        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            console.error("Validation error(s) in the '/' POST request: ", errors.array());

            return res.status(400).json({error: errors.array()});
        }

        const db = await co2DataDB();

        logger.info("Server connected to 'CO2DataDB' database");

        const newCO2Data = Array.isArray(req.body.co2Data) ? req.body.co2Data : [req.body.co2Data];
        const totalCO2 = req.body.totalCO2;
        const currentDate = new Date();
        const localDate = formatToGBLocale(currentDate);
        const utcDateAndTime = getUTC(currentDate);
        let prevDate = new Date(utcDateAndTime[0]);

        prevDate.setDate(prevDate.getDate() - 1);

        prevDate = getUTC(prevDate)[0];

        const co2Data = db.collection("co2Data");
        const existingCO2Data = await co2Data.findOne({
            email: userEmail, 
            utcDate: utcDateAndTime[0],
        });
        const previousCO2Data = await co2Data.findOne({
            email: userEmail,
            utcDate: prevDate,
        });

        if (!existingCO2Data) {
            const lastPrevious = await co2Data.findOne({
                email: userEmail,
                utcDate: { $lt: utcDateAndTime[0] },
            }, {
                sort: { utcDate: -1 }
            });

            let previousHighest = lastPrevious ? lastPrevious.highestStreak : 0;
            let newCurrentStreak = 1;
            let newHighest = previousHighest;

            if (previousCO2Data) {
                const mondayDateString = getMondayDateAndTime(utcDateAndTime[0])[0];
                const sundayDateString = getSundayDateAndTime(mondayDateString)[0];

                if (previousCO2Data.utcDate >= mondayDateString && previousCO2Data.utcDate <= sundayDateString) {
                    newCurrentStreak = previousCO2Data.currentStreak + 1;
                    newCurrentStreak = Math.min(newCurrentStreak, 7);

                    if (newCurrentStreak > previousHighest) {
                        newHighest = newCurrentStreak;
                    }

                    logger.info(
                        `Logging streak of ${req.body.username} on ${utcDateAndTime[0]} is successfully updated to ${newCurrentStreak}`
                    );
                }
            }

            if (newHighest === 0) {
                newHighest = newCurrentStreak;
            }

            const addNewCO2Data = await co2Data.insertOne({
                username: req.body.username,
                email: userEmail,
                localDate,
                utcDate: utcDateAndTime[0],
                createdAt: utcDateAndTime,
                updatedAt: utcDateAndTime,
                co2Data: newCO2Data,
                totalCO2,
                currentStreak: newCurrentStreak,
                highestStreak: newHighest
            });

            logger.info(`CO2 data successfully added`);
            return res.status(201).json({
                message: "New data added successfully",
                id: addNewCO2Data.insertedId,
            });
        } else {
            const updateCO2Data = await co2Data.findOneAndUpdate(
                {email: userEmail, utcDate: utcDateAndTime[0]},
                {
                    $set: {updatedAt: utcDateAndTime},
                    $push: { co2Data: {$each: newCO2Data}},
                    $inc: {totalCO2: totalCO2},
                },
                {returnDocument: 'after'},
            );

            logger.info(`New CO2 data of user ${existingCO2Data.username} successfully appended`);
            return res.status(200).json({
                message: "New data appended successfully",
                id: updateCO2Data.insertedId,
            });
        }
    } catch (error) {
        logger.error("Server failed to connect to 'CO2DataDB' database: ", error.message);
        next(error);
    }
});

router.get('/search', async (req, res, next) => {
    try {
        const authHeader = req.header('Authorization');

        if (!authHeader) {
            logger.error("Access denied. No token provided (/search GET request)");

            return res.status(401).json({
                message: "Access denied. No token provided"
            });
        }

        const token = authHeader.replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.user.id;
        const userEmail = decoded.user.email;

        if (!userId || !userEmail) {
            logger.error("User not logged in or missing email");

            return res.status(400).json({
                message: "User not logged in or properly authenticated",
            });
        }

        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            logger.error("Validation error(s) in the '/search' GET request: ", errors.array());

            return res.status(400).json({error: errors.array()});
        }

        const db = await co2DataDB();

        logger.info("Server connected to 'CO2DataDB' database");

        let startDate = req.query.startDate;
        let endDate = req.query.endDate;

        if (!startDate && !endDate) {
            startDate = getUTC(new Date())[0];
            endDate = getUTC(new Date())[0];
        } else if (!startDate || !endDate) {
            startDate = startDate || endDate;
            endDate = endDate || startDate;
        }

        if ((startDate && endDate) && (startDate > endDate)) {
            logger.error("User did not provide valid data range (/search GET request)");

            return res.status(400).json({
                message: "Provide a valid date range (startDate <= endDate)",
            });
        }

        const co2Data = db.collection('co2Data');

        await co2Data.createIndex({email: 1, utcDate: -1})

        let findUserCO2Data = null;

        if (startDate && endDate) {
            findUserCO2Data = await co2Data.find({
                email: userEmail,
                utcDate: {
                    $gte: startDate, 
                    $lte: endDate,
                }
            }).sort({utcDate: -1}).toArray();

            if (startDate === endDate) {
                logger.info(`Data of the date ${startDate} successfully retrieved`);
            } else {
                logger.info(
                    `Data between the dates ${startDate} and ${endDate} successfully retrieved`
                );
            }
        } else {
            findUserCO2Data = await co2Data
            .find({email: userEmail})
            .sort({utcDate: -1})
            .limit(1)
            .toArray();
        }

        return res.status(200).json({
            data: findUserCO2Data,
        });
    } catch (error) {
        logger.error("Server failed to connect to 'CO2DataDB' database: ", error.message);
        next(error);
    }
});

router.get('/leaderboard/search', async (req, res, next) => {
    try {
        const authHeader = req.header('Authorization');

        if (!authHeader) {
            logger.error("Access denied. No token provided (/leaderboard/search GET request)");

            return res.status(401).json({
                message: "Access denied. No token provided"
            });
        }

        const token = authHeader.replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.user.id;
        const userEmail = decoded.user.email;

        if (!userId || !userEmail) {
            logger.error("User not logged in or missing email");

            return res.status(400).json({
                message: "User not logged in or properly authenticated",
            });
        }

        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            logger.error("Validation error(s) in the '/leaderboard/search' GET request: ", errors.array());

            return res.status(400).json({error: errors.array()});
        }

        const db = await co2DataDB();

        logger.info("Server connected to 'CO2DataDB' database");

        const startDate = req.query.startDate;
        const endDate = req.query.endDate ? req.query.endDate : startDate;
        const co2Data = db.collection('co2Data');

        if ((!startDate || !endDate) || (startDate > endDate)) {
            logger.error("User did not provide valid data range (/leaderboard/search GET request)");

            return res.status(400).json({
                message: "Provide a valid date range (startDate <= endDate)",
            });
        }

        const aggregationPipeline = [
            {
                $match: {utcDate: {$gte: startDate, $lte: endDate}},
            }, 
            {
                $group: {
                    _id: "$email",
                    username: {$first: "$username"},
                    totalCO2: {$sum: "$totalCO2"},
                    recordCount: {$sum: 1},
                }
            }, 
            {
                $addFields: {
                    averageCO2: {$round: [{$divide: ["$totalCO2", "$recordCount"]}, 2]},
                }
            }, 
            {
                $sort: {
                    averageCO2: 1,
                }
            }, 
            {$limit: 20}, 
            {
                $project: {
                    _id: 0,
                    email: "$_id",
                    username: 1,
                    averageCO2: 1,
                    totalCO2: 1,
                    recordCount: 1,
                    period: {start: startDate, end: endDate},
                }
            }
        ]

        const aggregatedData = await co2Data.aggregate(aggregationPipeline).toArray();

        logger.info("Leaderboard data successfully retrieved");
        return res.status(200).json({
            message: "Aggregation process complete",
            data: aggregatedData,
        });
    } catch (error) {
        logger.error("Server failed to connect to 'CO2DataDB' database: ", error.message);
        next(error);
    }
});

router.get("/averageCO2/search", async (req, res, next) => {
    try {
        const authHeader = req.header('Authorization');

        if (!authHeader) {
            logger.error("Access denied. No token provided (/averageCO2/search GET request)");

            return res.status(401).json({
                message: "Access denied. No token provided"
            });
        }

        const token = authHeader.replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.user.id;
        const userEmail = decoded.user.email;

        if (!userId || !userEmail) {
            logger.error("User not logged in or missing email");

            return res.status(400).json({
                message: "User not logged in or properly authenticated",
            });
        }

        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            logger.error("Validation error(s) in the '/averageCO2/search' GET request: ", errors.array());

            return res.status(400).json({error: errors.array()});
        }

        const db = await co2DataDB();

        logger.info("Server connected to 'CO2DataDB' database");

        let startDate = req.query.startDate;
        let endDate = req.query.endDate;

        if (!startDate || !endDate) {
            const today = getUTC(new Date())[0];
            startDate = today;
            endDate = today;
        }

        if (startDate > endDate) {
            logger.error("User did not provide valid data range (/averageCO2/search GET request)");

            return res.status(400).json({
                message: "Provide a valid date range (startDate <= endDate)",
            });
        }

        const co2Data = db.collection('co2Data');

        const aggregationPipeline = [
            {$match: {utcDate: {$gte: startDate, $lte: endDate}}},
            {
                $group: {
                    _id: null,
                    totalCO2: {$sum: "$totalCO2"},
                    totalRecords: {$sum: 1},
                    activeUsers: {$addToSet: "$email"},
                }
            }, 
            {
                $addFields: {
                    activeUsersCount: {$size: "$activeUsers"},
                }
            },
            {
                $project: {
                    _id: 0,
                    totalCO2: 1,
                    totalRecords: 1,
                    activeUsersCount: 1,
                }
            },
        ];

        const aggregatedData = await co2Data.aggregate(aggregationPipeline).toArray();

        let responseData = aggregatedData[0] || {
            totalCO2: 0,
            totalRecords: 0,
            activeUsersCount: 0
        };

        const start = new Date(startDate);
        const end = new Date(endDate);
        const days = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;

        responseData.averageCO2 = responseData.activeUsersCount > 0 && days > 0 
            ? Math.round((responseData.totalCO2 / responseData.activeUsersCount / days) * 100) / 100 
            : 0;

        logger.info("Average CO2 data successfully retrieved");
        return res.status(200).json({
            message: "Aggregation process complete",
            data: [responseData], 
            period: startDate === endDate ? `${startDate}` : `${startDate} - ${endDate}`
        });
    } catch (error) {
        logger.error("Server failed to connect to 'CO2DataDB' database: ", error.message);
        next(error);
    }
});

router.get("/totalCO2", async (req, res, next) => {
    try {
        const authHeader = req.header('Authorization');

        if (!authHeader) {
            console.error("Access denied. No token provided (/totalCO2 GET request)");

            return res.status(401).json({
                message: "Access denied. No token provided"
            });
        }

        const token = authHeader.replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.user.id;
        const userEmail = decoded.user.email;

        if (!userId || !userEmail) {
            logger.error("User not logged in or missing email");

            return res.status(400).json({
                message: "User not logged in or properly authenticated",
            });
        }

        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            logger.error("Validation error(s) in the '/averageCO2/search' GET request: ", errors.array());

            return res.status(400).json({error: errors.array()});
        }

        const db = await co2DataDB();

        logger.info("Server connected to 'CO2DataDB' database");

        const startDate = req.query.startDate ? req.query.startDate : getUTC(new Date())[0];
        const endDate = req.query.endDate ? req.query.endDate : getUTC(new Date())[0];
        const co2Data = db.collection('co2Data');
        const userEmailObj = {email: userEmail};

        if ((!startDate || !endDate) || (startDate > endDate)) {
            logger.error("User did not provide valid data range");

            return res.status(400).json({
                message: "Provide a valid date range (startDate <= endDate)",
            });
        }

        const aggregationPipeline = [
            {$match: {
                utcDate: {$gte: startDate, $lte: endDate}, 
                ...userEmailObj
            }},
            {
                $group: {
                    _id: null,
                    totalCO2: {$sum: "$totalCO2"},
                    totalRecords: {$sum: 1},
                    activeUsers: {$addToSet: "$email"},
                }
            }, 
            {
                $project: {
                    _id: 0,
                    totalCO2: 1,
                    totalRecords: 1,
                }
            },
        ];

        const aggregatedData = await co2Data.aggregate(aggregationPipeline).toArray();

        logger.info("Total CO2 data successfully retrieved");
        return res.status(200).json({
            message: "Aggregation process complete",
            data: aggregatedData,
            period: startDate === endDate ? `${startDate}` : `${startDate} - ${endDate}`
        });
    } catch (error) {
        logger.error("Server failed to connect to 'CO2DataDB' database: ", error.message);
        next(error);
    }
});

export {router as dataRoutes}; 