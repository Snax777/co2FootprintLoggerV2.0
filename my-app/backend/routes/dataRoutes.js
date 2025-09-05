import Router from "express";
import { connectToCO2DataDB, closeCO2DataDB } from "../models/CO2DataDB";
import config from "dotenv";
import { validationResult } from "express-validator";
import pino from "pino";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { getUTC } from "../../util/dateTimeToUTCConverter";

const router = Router();
const logger = pino();

config();

if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET has no value');
}

router.post('/api/data', async (req, res, next) => {
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

        if (!userId) {
            logger.error("User not logged in");

            return res.status(400).json({
                message: "User not logged in",
            });
        }

        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            logger.error("Validation error(s) in the '/sendData' POST request: ", errors.array());

            return res.status(400).json({error: errors.array()});
        }

        const db = await connectToCO2DataDB();

        logger.info("Server connected to 'CO2DataDB' database");

        const email = req.body.email;
        const newCO2Data = Array.isArray(req.body.data) ? req.body.data : [req.body.data];
        const totalCO2 = req.body.totalCO2;
        const newDate = new Date();
        const localDate = formatToGBLocale(newDate);
        const utcDateAndTime = getUTC(newDate);

        if (decoded.user.email !== email) {
            logger.error("User not authorized to modify data");

            return res.status(403).json({
                message: "User not authorized to modify data",
            });
        }

        const collection = await db.collection("co2Data");
        const existingCO2Data = await collection.findOne({
            email, 
            utcDate: utcDateAndTime[0],
        });

        if (!existingCO2Data) {
            const addNewCO2Data = await collection.insertOne({
                username: req.body.username,
                email,
                localDate,
                utcDate: utcDateAndTime[0],
                createdAt: utcDateAndTime,
                updatedAt: utcDateAndTime,
                co2Data: newCO2Data,
                totalCO2,
            });

            logger.info(`CO2 data of user ${req.body.username} successfully added`);
            return res.status(201).json({
                message: "New data added successfully",
                id: addNewCO2Data.insertedId,
            });
        } else {
            const updateCO2Data = await collection.findOneAndUpdate(
                {email, utcDate: utcDateAndTime[0]},
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
    } finally {
        logger.info("Closing connection to 'CO2DataDB' database");

        await closeCO2DataDB();
    }
});

router.get('/api/data', async (req, res, next) => {
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
            logger.error("Validation error(s) in the '/getData' GET request: ", errors.array());

            return res.status(400).json({error: errors.array()});
        }

        const db = await connectToCO2DataDB();

        logger.info("Server connected to 'CO2DataDB' database");

        const startDate = req.query.startDate?.split('T')[0];
        const endDate = req.query.endDate?.split('T')[0];

        const collection = await db.collection('co2Data');
        const findUserCO2Data = await collection.find({
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
    } finally {
        logger.info("Closing connection to 'CO2DataDB' database");

        await closeCO2DataDB();
    }
});

// router.get('/api/data/leaderboard/:id', async (req, res, next) => {
//     try {
        
//     } catch (error) {
        
//     } finally {

//     }
// });