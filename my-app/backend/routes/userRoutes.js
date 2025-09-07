import Router from "express";
import { connectToUserDB, closeUserDB } from "../models/userDB";
import config from "dotenv";
import bcryptjs from "bcryptjs";
import pino from "pino";
import jwt from "jsonwebtoken";
import validationResult from "express-validator";
import { ObjectId } from "mongodb";
import { getUTC } from "../../util/dateTimeToUTCConverter";
import { co2DataDB, closeCO2DataDB } from "../models/CO2DataDB";

const router = Router();
const logger = pino();

config.config();

const currentDate = new Date();

router.post('/api/account/register', async (req, res, next) => {
    try {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            logger.error("Validation error(s) in the '/api/account/register' POST request: ", errors.array());

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
        const existingUser = await collection.findOne({username, email});
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
            user: {id: newUser.insertedId},
        };
        const authtoken = jwt.sign(payload, process.env.JWT_SECRET);

        logger.info(`User with email ${email} registered successfully`);
        return res.status(200).json({
            message: `User with email ${email} registered successfully`,
            authtoken,
            email,
        });
    } catch (error) {
        logger.error("Server failed to connect to 'UserDB' database: ", error.message);
        next(error);
    } finally {
        logger.info("Closing connection to 'UserDB' database");

        await closeUserDB();
    }
});

router.post('/api/account/login', async (req, res, next) => {
    try {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            logger.error("Validation error(s) in the '/api/account/login' POST request: ", errors.array());

            return res.status(400).json({error: errors.array()});
        }

        const db = await connectToUserDB();

        logger.info("Server connected to 'UserDB' database");

        const collection = db.collection("users");
        const email = req.body.email;
        const password = req.body.password;
        const date = getUTC(currentDate)[0];
        const existingUser = collection.findOne({email});

        if (!existingUser) {
            logger.error(
                `User with email ${email} does not exist`
            );

            return res.status(404).json({
                message: `User with email ${email} does not exist`,
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
                {email},
                {$set: {loggedInAt: date}},
            );
            const payload = {
                user: {id: updateLoginInDate.value._id},
            };
            const authtoken = jwt.sign(payload, process.env.JWT_SECRET);

            logger.info(`User ${existingUser.username} logged in successfully`);
            return res.status(200).json({
                message: `User ${existingUser.username} logged in successfully`,
                email,
                authtoken,
            });
        }
    } catch (error) {
        logger.error("Server failed to connect to 'UserDB' database: ", error.message);
        next(error);
    } finally {
        logger.info("Closing connection to 'UserDB' database");

        await closeUserDB();
    }
});

router.put('/api/account/update', async (req, res, next) => {
    try {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            logger.error("Validation error(s) in the '/api/account/update' PUT request: ", errors.array());

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

        const collection = await db.collection("users");
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
    } finally {
        logger.info("Closing connection to 'UserDB' database");

        await closeUserDB();
    }
});

router.delete('/api/account/delete', async (req, res, next) => {
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
            logger.error("Validation error(s) in the '/api/account/delete' DELETE request: ", errors.array());
        
            return res.status(400).json({error: errors.array()});
        }

        if (!req.body.password) {
            logger.info("User did not input password");

            res.status(400).json({
                message: "Password is required",
            });
        }

        const db1 = await connectToUserDB();
        const db2 = await co2DataDB();

        logger.info("Server connected to 'CO2DataDB' database");
        logger.info("Server connected to 'UserDB' database");

        const collection1 = await db1.collection("users");
        const collection2 = await db2.collection("co2Data");
        const currentUser = await collection1.findOne({email: userEmail});
        const passwordResult = await bcryptjs.compare(req.body.password, currentUser.hash);

        if (!currentUser) {
            logger.error(`Authenticated user ${userEmail} not found in database`);

            return res.status(404).json({ message: "User account not found" });
        }

        if (passwordResult) {
            let deleteUser = null;
            let deleteUserData = null;

            if (req.body.deleteData === true) {
                deleteUserData = await collection2.deleteMany({email: userEmail});
            }

            if (req.body.deleteUser === true) {
                deleteUser = await collection1.deleteOne({email: userEmail});
            }

            const dataDeleted = deleteUserData?.deletedCount > 0;
            const userDeleted = deleteUser?.deletedCount > 0;

            if (!dataDeleted && !userDeleted) {
                logger.warn(`No deletions performed for ${userEmail} - both flags were false`);
                return res.status(400).json({
                    message: "No deletions performed. Set deleteData or deleteUser to true.",
                });
            }

            return res.status(200).json({
                message: "Deletion successful",
                deletions: {
                    data: {
                        performed: dataDeleted,
                        recordsDeleted: deleteUserData?.deletedCount || 0,
                    },
                    user: {
                        performed: userDeleted,
                        accountDeleted: userDeleted
                    }
                }
            });
        } else {
            logger.error(`User with email ${userEmail} entered wrong password`);

            return res.status(401).json({
                message: "Incorrect password",
            });
        }
    } catch (error) {
        logger.error("Server failed to connect to 'UserDB' & 'CO2UserDB' databases: ", error.message);
        next(error);
    } finally {
        logger.info("Closing connection to 'UserDB' & 'CO2UserDB' databases");

        await closeUserDB();
        await closeCO2DataDB();
    }
});

export {router as userRoutes};