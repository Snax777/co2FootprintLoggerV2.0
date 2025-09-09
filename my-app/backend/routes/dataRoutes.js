import Router from "express";
import { co2DataDB } from "../models/CO2DataDB.js";
import { config } from "dotenv";
import { validationResult } from "express-validator";
import pino from "pino";
import jwt from "jsonwebtoken";
import { getUTC } from "../../util/dateTimeToUTCConverter.js";

const router = Router();
const logger = pino();

config();

function formatToGBLocale(date) {
    return date.toLocaleDateString("en-GB");
}

if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET has no value');
}

router.post('/', async (req, res, next) => {
    try {
        const authHeader = req.header('Authorization');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            logger.error("Access denied. No token provided");

            return res.status(401).json({
                message: "Access denied. No token provided"
            });
        }

        const token = authHeader.replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET, {
            expiresIn: "1h"
        });
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
            logger.error("Validation error(s) in the '/' POST request: ", errors.array());

            return res.status(400).json({error: errors.array()});
        }

        const db = await co2DataDB();

        logger.info("Server connected to 'CO2DataDB' database");

        const newCO2Data = Array.isArray(req.body.data) ? req.body.data : [req.body.data];
        const totalCO2 = req.body.totalCO2;
        const currentDate = req.body.currentDate;
        const localDate = formatToGBLocale(currentDate);
        const utcDateAndTime = getUTC(currentDate);
        let prevDate = new Date(utcDateAndTime[0]);

        prevDate.setDate(prevDate.getDate() - 1);

        prevDate = getUTC(prevDate)[0];

        const co2Data = await db.collection("co2Data");
        const existingCO2Data = await co2Data.findOne({
            email: userEmail, 
            utcDate: utcDateAndTime[0],
        });
        const previousCO2Data = await co2Data.findOne({
            email: userEmail,
            utcDate: prevDate,
        });

        if (!existingCO2Data) {
            const addNewCO2Data = await co2Data.insertOne({
                username: req.body.username,
                email: userEmail,
                localDate,
                utcDate: utcDateAndTime[0],
                createdAt: utcDateAndTime,
                updatedAt: utcDateAndTime,
                co2Data: newCO2Data,
                totalCO2,
                loggingStreak: 1,
            });

            if (previousCO2Data) {
                let mondayDate = new Date(utcDateAndTime[0]);
                const dayOfWeek = mondayDate.getDay();
                const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

                mondayDate.setDate(mondayDate.getDate() - daysSinceMonday);
                mondayDate.setHours(0, 0, 0, 0);

                const mondayDateString = getUTC(mondayDate)[0];

                let sundayDate = new Date(mondayDate);

                sundayDate.setDate(mondayDate.getDate() + 6);
                sundayDate.setHours(23, 59, 59, 999);

                const sundayDateString = getUTC(sundayDate)[0];

                if (
                (previousCO2Data.utcDate >= mondayDateString) && 
                (previousCO2Data.utcDate <= sundayDateString)) { 
                    let newStreak = Math.min(previousCO2Data.loggingStreak + 1, 7);

                    const updateNewCO2Data = await co2Data.findOneAndUpdate(
                        {email: userEmail, utcDate: utcDateAndTime[0]}, 
                        {$set: {loggingStreak: newStreak}},
                        {returnDocument: "after"},
                    );

                    logger.info(
                        `Logging streak of ${updateNewCO2Data.value.username} on
                         ${updateNewCO2Data.value.utcDate} is successfully updated to ${newStreak}`
                    );
                }
                
            }

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
                id: updateCO2Data.value._id,
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

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            logger.error("Access denied. No token provided");

            return res.status(401).json({
                message: "Access denied. No token provided"
            });
        }

        const token = authHeader.replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET,  {
            expiresIn: "1h"
        });
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

        const startDate = getUTC(req.query.startDate)[0];
        const endDate = getUTC(req.query.endDate)[0];

        if ((!startDate || !endDate) || (startDate > endDate)) {
            logger.error("User did not provide valid data range");

            return res.status(400).json({
                message: "Provide a valid date range (startDate <= endDate)",
            });
        }

        const co2Data = await db.collection('co2Data');
        const findUserCO2Data = await co2Data.find({
            email: userEmail,
            utcDate: {
                $gte: startDate, 
                $lte: endDate,
            }
        }).sort({utcDate: -1}).toArray();

        if (startDate === endDate) {
            logger.info(`Data of the date ${startDate} successfully retrieved`);
        } else {
            logger.info(`Data between the dates ${startDate} and ${endDate} successfully retrieved`);
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

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            logger.error("Access denied. No token provided");

            return res.status(401).json({
                message: "Access denied. No token provided"
            });
        }

        const token = authHeader.replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET, {
            expiresIn: "1h"
        });
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

        const startDate = getUTC(req.query.startDate)[0];
        const endDate = getUTC(req.query.endDate)[0];
        const co2Data = await db.collection('co2Data');

        if ((!startDate || !endDate) || (startDate > endDate)) {
            logger.error("User did not provide valid data range");

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

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            logger.error("Access denied. No token provided");

            return res.status(401).json({
                message: "Access denied. No token provided"
            });
        }

        const token = authHeader.replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET, {
            expiresIn: "1h"
        });
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

        const startDate = getUTC(req.query.startDate)[0];
        const endDate = getUTC(req.query.endDate)[0];
        const co2Data = await db.collection('co2Data');

        if ((!startDate || !endDate) || (startDate > endDate)) {
            logger.error("User did not provide valid data range");

            return res.status(400).json({
                message: "Provide a valid date range (startDate <= endDate)",
            });
        }

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
                    averageCO2: {$round: [{$divide: ["$totalCO2", "$totalRecords"]}, 2]},
                    activeUsersCount: {$size: "$activeUsers"},
                }
            },
            {
                $project: {
                    _id: 0,
                    totalCO2: 1,
                    averageCO2: 1,
                    totalRecords: 1,
                    activeUsersCount: 1,
                }
            },
        ];

        const aggregatedData = await co2Data.aggregate(aggregationPipeline).toArray();

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