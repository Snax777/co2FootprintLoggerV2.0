import Router from "express";
import { connectToUserDB, closeUserDB } from "../models/userDB";
import config from "dotenv";
import bcryptjs from "bcryptjs";
import pino from "pino";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import validationResult from "express-validator";
import { ObjectId } from "mongodb";
import { getUTC } from "../../util/dateTimeToUTCConverter";

const router = Router();
const logger = pino();

config.config();

if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = crypto.randomBytes(64).toString('base64');
}

const currentDate = new Date();

router.post('/register', async (req, res) => {
    try {
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

        return res.status(500).send("Internal Server Error");
    } finally {
        logger.info("Closing connection to 'UserDB' database");

        await closeUserDB();
    }
});

router.post('/login', async (req, res) => {
    try {
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

        return res.status(500).send("Internal Server Error");
    } finally {
        logger.info("Closing connection to 'UserDB' database");

        await closeUserDB();
    }
});

router.put('/update', async (req, res) => {
    try {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            logger.error("Validation error(s) in the update request: ", errors.array());

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
        logger.error("Server failed to connect to UserDB database: ", error.message);

        return res.status(500).send("Internal Server Error");
    } finally {
        logger.info("Closing connection to 'UserDB' database");

        await closeUserDB();
    }
});

export {router as userRoutes};