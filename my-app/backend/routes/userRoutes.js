import Router from "express";
import { connectToUserDB } from "../models/userDB.js";
import { config } from "dotenv";
import bcryptjs from "bcryptjs";
import pino from "pino";
import jwt from "jsonwebtoken";
import { validationResult } from "express-validator";
import { ObjectId } from "mongodb";
import { getUTC } from "../../util/dateTimeToUTCConverter.js";
import { co2DataDB } from "../models/CO2DataDB.js";

const router = Router();
const logger = pino();

config();

const currentDate = new Date();

router.post('/register', async (req, res, next) => {
    try {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            logger.error("Validation error(s) in the '/register' POST request: ", errors.array());
            return res.status(400).json({error: errors.array()});
        }

        const db = await connectToUserDB();

        logger.info("Server connected to 'UserDB' database");

        const collection = db.collection("users");
        const name = req.body.name;
        const surname = req.body.surname;
        const username = req.body.username;
        const email = req.body.email;
        const salt = await bcryptjs.genSalt();
        const hash = await bcryptjs.hash(req.body.password, salt);
        const existingUser = await collection.findOne({$or: [{username: username}, {email: email}]});
        const date = getUTC(currentDate)[0];
        const data = {
            name: name,
            surname: surname,
            username: username,
            email: email,
            password: hash,
            createdAt: date,
            loggedInAt: date,
        };

        if (existingUser) {
            logger.error(`User with email ${email} already exists.`);
            res.status(404).json(
                {message: `User with email ${email} already exists.`}
            );
        }
        
        const newUser = await collection.insertOne(data);
        const payload = {
            user: {
                id: newUser.insertedId, 
                email: email,
            },
        };
        const authtoken = jwt.sign(payload, process.env.JWT_SECRET, {
            expiresIn: "1h"
        });

        logger.info(`User with email ${email} registered successfully`);
        return res.status(200).json({
            message: `User with email ${email} registered successfully`,
            authtoken,
            username,
            email,
            expiresIn: 3600000,
            expiresAt: Date.now() + 3600000
        });
    } catch (error) {
        logger.error("Server failed to connect to 'UserDB' database: ", error.message);
        next(error);
    }
});

router.post('/login', async (req, res, next) => {
    try {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            logger.error("Validation error(s) in the '/login' POST request");

            return res.status(400).json({error: errors.array()});
        }

        const db = await connectToUserDB();

        logger.info("Server connected to 'UserDB' database");

        const collection = db.collection("users");
        const password = req.body.password;
        const date = getUTC(currentDate)[0];
        const existingUser = await collection.findOne({email: req.body.email});

        if (!existingUser) {
            logger.error(
                `User with email ${req.body.email} does not exist`
            );
            console.error(`User with email ${req.body.email} does not exist`);

            return res.status(404).json({
                message: `User with email ${req.body.email} does not exist`,
            });
        } else {
            const result = await bcryptjs.compare(password, existingUser.password);

            if (!result) {
                logger.error("Incorrect password.");

                return res.status(404).json({
                    message: "Incorrect password.",
                });
            }

            const updateLoginInDate = await collection.findOneAndUpdate(
                {email: req.body.email},
                {$set: {loggedInAt: date}}, 
                {returnDocument: 'after'},
            );
            const payload = {
                user: {
                    id: existingUser._id.toString(), 
                    email: existingUser.email,
                },
            };
            const authtoken = jwt.sign(payload, process.env.JWT_SECRET, {
                expiresIn: "1h"
            });

            logger.info(`User ${existingUser.username} logged in successfully`);
            return res.status(200).json({
                message: `User ${existingUser.username} logged in successfully`,
                username: existingUser.username, 
                email: req.body.email,
                authtoken,
                expiresIn: 3600000,
                expiresAt: Date.now() + 3600000
            });
        }
    } catch (error) {
        logger.error("Server failed to connect to 'UserDB' database: ", error.message);
        next(error);
    }
});

router.put('/update', async (req, res, next) => {
    try {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            logger.error("Validation error(s) in the '/update' PUT request");

            return res.status(400).json({error: errors.array()});
        }

        const authHeader = req.header('Authorization');

        if (!(authHeader || authHeader.startsWith('Bearer '))) {
            logger.error("Access denied. No token provided");

            return res.status(401).json({
                message: "Access denied. No token provided"
            });
        }

        const token = authHeader.replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.user.id;

        const db = await connectToUserDB();

        logger.info("Server connected to 'UserDB' database");

        const collection = db.collection("users");
        const currentUser = await collection.findOne({_id: new ObjectId(userId)});
        const result = await bcryptjs.compare(req.body.oldPassword, currentUser.password);
        const date = getUTC(currentDate)[0];

        if (!currentUser) {
            logger.error("User not found");

            return res.status(404).send("User not found");
        } else if (!result) {
            logger.error("User's current password does not match with given password");

            return res.status(400).send("User's current password does not match with given password");
        }

        const salt = await bcryptjs.genSalt();
        const hash = await bcryptjs.hash(req.body.newPassword, salt);
        const updatePassword = {
            password: hash,
            updatedAt: date,
        };
        const updateUserDetails = await collection.findOneAndUpdate(
            {_id: new ObjectId(userId)},
            {$set: updatePassword},
            {returnDocument: 'after'},
        );
        const payload = {
            user: {id: updateUserDetails._id.toString()}, 
        };
        const authtoken = jwt.sign(payload, process.env.JWT_SECRET);

        logger.info(`Password of user ${currentUser.username} changed successfully`);

        return res.status(200).json({
            message: `Password changed successfully`,
            authtoken,
            username: currentUser.username,
        });
    } catch (error) {
        logger.error("Server failed to connect to 'UserDB' database: ", error.message);
        next(error);
    }
});

router.delete('/delete', async (req, res, next) => {
    try {
        const errors = validationResult(req);
        
        if (!errors.isEmpty()) {
            logger.error("Validation error(s) in the '/delete' DELETE request");
        
            return res.status(400).json({error: errors.array()});
        }
        
        const authHeader = req.header('Authorization');
        
        if (!authHeader) {
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

        const db1 = await connectToUserDB();
        const db2 = await co2DataDB();

        logger.info("Server connected to 'CO2DataDB' database");
        logger.info("Server connected to 'UserDB' database");

        const collection1 = db1.collection("users");
        const collection2 = db2.collection("co2Data");
        const collection3 = db2.collection("co2Goals");
        const currentUser = await collection1.findOne({email: userEmail});

        if (!currentUser) {
            logger.error(`Authenticated user ${userEmail} not found in database`);

            return res.status(404).json({ message: "User account not found" });
        }

        let deleteUser = null;
        let deleteUserData = null;
        let deleteUserGoals = null;

        const shouldDeleteData = req.body.deleteData === true || req.body.deleteUser === true;

        if (shouldDeleteData) {
            deleteUserData = await collection2.deleteMany({email: userEmail});
            deleteUserGoals = await collection3.deleteOne({email: userEmail});
        }

        if (req.body.deleteUser === true) {
            deleteUser = await collection1.deleteOne({email: userEmail});
        }

        const dataDeleted = deleteUserData?.deletedCount > 0;
        const userDeleted = deleteUser?.deletedCount > 0;
        const userGoalsDeleted = deleteUserGoals?.deletedCount > 0;

        if (!shouldDeleteData && !req.body.deleteUser) {
            logger.warn(`No deletions performed for ${userEmail} - both flags were false`);
            return res.status(400).json({
                message: "No deletions performed.",
            });
        }

        return res.status(200).json({
            message: "Deletion successful",
            deletionsSuccessful: {
                data: {
                    performed: dataDeleted,
                    recordsDeleted: deleteUserData?.deletedCount || 0,
                },
                user: {
                    performed: !!req.body.deleteUser,
                    accountDeleted: userDeleted
                }, 
                goals: {
                    performed: userGoalsDeleted,
                    goalsDeleted: deleteUserGoals?.deletedCount || 0
                }
            }
        });
    } catch (error) {
        logger.error("Server failed to connect to 'UserDB' & 'CO2UserDB' databases: ", error.message);
        next(error);
    }
});

export {router as userRoutes};