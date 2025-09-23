import Router from "express";
import { co2DataDB } from "../models/CO2DataDB.js";
import { validationResult } from "express-validator";
import { config } from "dotenv";
import pino from "pino";
import jwt from "jsonwebtoken";
import { 
    getUTC, 
    getMondayDateAndTime, 
    getSundayDateAndTime
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

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            logger.error("Access denied. No token provided");

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
            logger.error("Validation error(s) in the '/' POST request: ", errors.array());

            return res.status(400).json({error: errors.array()});
        }

        const db = await co2DataDB();

        logger.info("Server connected to 'CO2DataDB' database");

        const utcDateAndTime = getUTC(req.body.logDate);
        const goals = req.body.goals;

        const co2Goals = db.collection('co2Goals');
        const findUserGoals = await co2Goals.findOne({user: userEmail});

        if (findUserGoals) {
            if (
                (
                    (utcDateAndTime[0] >= findUserGoals.mondayDate[0]) &&
                    (utcDateAndTime[1] >= findUserGoals.mondayDate[1])
                ) && (
                    (utcDateAndTime[0] <= findUserGoals.sundayDate[0]) && 
                    (utcDateAndTime[1] <= findUserGoals.sundayDate[1])
                )
            ) {
                const updateUserGoals = await co2Goals.findOneAndUpdate(
                    {user: userEmail}, 
                    { $push: {userGoals: {$each: goals}}}, 
                    {returnDocument: "after"},
                );

                return res.status(200).json({
                    message: "New goals appended successfully",
                    id: updateUserGoals.value._id,
                })
            } else {
                const mondayDateAndTime = getMondayDateAndTime(utcDateAndTime[0]);
                const sundayDateAndTime = getSundayDateAndTime(mondayDateAndTime[0]);
                
                const updateUserGoals = await co2Goals.findOneAndUpdate(
                    {user: userEmail}, 
                    {
                        $set: {
                            logDate: utcDateAndTime,
                            mondayDate: mondayDateAndTime,
                            sundayDate: sundayDateAndTime,
                            userGoals: goals
                        }
                    }
                );

                return res.status(200).json({
                    message: "New goals added successfully",
                    id: updateUserGoals.value._id,
                })
            }
        } else {
            const mondayDateAndTime = getMondayDateAndTime(utcDateAndTime[0]);
            const sundayDateAndTime = getSundayDateAndTime(mondayDateAndTime[0]);
            
            const newUserGoals = await co2Goals.insertOne({
                user: userEmail,
                logDate: utcDateAndTime,
                mondayDate: mondayDateAndTime[0],
                sundayDate: sundayDateAndTime[0],
                userGoals: goals
            });

            return res.status(201).json({
                message: "New goals added successfully",
                id: newUserGoals.value._id,
            })
        }
    } catch (error) {
        logger.error("Server failed to connect to 'CO2DataDB' database: ", error.message);
        next(error);
    }
});

router.get("/goals", async (req, res, next) => {
    try {
        const authHeader = req.header('Authorization');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            logger.error("Access denied. No token provided");

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
            logger.error("Validation error(s) in the '/goals' GET request: ", errors.array());

            return res.status(400).json({error: errors.array()});
        }

        const db = await co2DataDB();

        logger.info("Server connected to 'CO2DataDB' database");

        const co2Goals = db.collection("co2Goals");

        const currentDateAndTime = new Date(req.query.date);
        const utcDateAndTime = getUTC(currentDateAndTime);

        const mondayDate = getMondayDateAndTime(utcDateAndTime[0])[0];
        const sundayDate = getSundayDateAndTime(mondayDate)[0];

        const findUserGoals = await co2Goals.findOne({
            user: userEmail, 
            logDate: {
                $gte: mondayDate,
                $lte: sundayDate
            }
        });

        if (!findUserGoals) {
            return res.status(404).json({
                message: "Goals of user not found"
            });
        } else {
            return res.status(200).json({
                data: findUserGoals
            });
        }
    } catch (error) {
        logger.error("Server failed to connect to 'CO2DataDB' database: ", error.message);
        next(error);
    }
});

router.delete("/delete", async (req, res, next) => {
    try {
        
        const authHeader = req.header('Authorization');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            logger.error("Access denied. No token provided");

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
            logger.error("Validation error(s) in the '/delete' DELETE request: ", errors.array());

            return res.status(400).json({error: errors.array()});
        }

        const db = await co2DataDB();

        logger.info("Server connected to 'CO2DataDB' database");

        const co2Goals = db.collection("co2Goals");
        const removeUserGoals = await co2Goals.deleteOne(
            {user: userEmail}
        );

        const userGoalsDeleted = removeUserGoals?.deletedCount > 0;

        if (!userGoalsDeleted) {
            logger.warn(`No deletion performed for ${userEmail} -- deletion flag is ${userGoalsDeleted}`)
            return res.status(400).json({
                message: `Goals of user ${userEmail} don't exist`
            });
        } else {
            return res.status(200).json({
                message: `Goals successfully deleted`,
                deletion: {
                    goals: {
                        performed: userGoalsDeleted,
                        recordsDeleted: removeUserGoals?.deletedCount
                    }
                }
            })
        }
    } catch (error) {
        logger.error("Server failed to connect to 'CO2DataDB' database: ", error.message);
        next(error);
    }
});

export {router as goalRoutes};