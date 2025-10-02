import Router from "express";
import { co2DataDB } from "../models/CO2DataDB.js";
import { validationResult } from "express-validator";
import { config } from "dotenv";
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

const sendGoalNotification = (req, userId, type, data) => {
  try {
    const broadcastToUser = req.app.get('broadcastToUser');
    if (broadcastToUser && userId) {
      broadcastToUser(userId, {
        type: type,
        payload: {
          ...data,
          timestamp: new Date().toISOString()
        }
      });
      logger.info(`WebSocket goal notification sent to user ${userId}: ${type}`);
    }
  } catch (error) {
    logger.error('Failed to send WebSocket goal notification:', error.message);
  }
};

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
            logger.error("Validation error(s) in the '/' POST request");
            return res.status(400).json({error: errors.array()});
        }

        const db = await co2DataDB();
        logger.info("Server connected to 'CO2DataDB' database");

        const localDateAndTime = formatToGBLocale(new Date());
        const utcDateAndTime = getUTC(new Date());
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
                    { $set: {userGoals: goals}}, 
                    {returnDocument: "after"},
                );

                logger.info("New goals of user successfully appended");
                
                sendGoalNotification(req, userId, 'goals-updated', {
                    message: 'Weekly goals updated successfully',
                    action: 'updated',
                    goalsCount: goals.length,
                    week: {
                        monday: findUserGoals.mondayDate[0],
                        sunday: findUserGoals.sundayDate[0]
                    },
                    goals: goals.map(goal => ({
                        type: goal.type,
                        target: goal.target,
                        current: goal.current || 0
                    }))
                });

                return res.status(200).json({
                    message: "New goals appended successfully",
                    id: updateUserGoals.value._id,
                })
            } else {
                const mondayDateAndTime = getMondayDateAndTime(utcDateAndTime[0]);
                const sundayDateAndTime = getSundayDateAndTime();
                
                const updateUserGoals = await co2Goals.findOneAndUpdate(
                    {user: userEmail}, 
                    {
                        $set: {
                            localDateAndTime,
                            logDate: utcDateAndTime,
                            mondayDate: mondayDateAndTime,
                            sundayDate: sundayDateAndTime,
                            userGoals: goals
                        }
                    }, 
                    {returnDocument: "after"},
                );

                logger.info("New goals of user successfully added");
                
                sendGoalNotification(req, userId, 'goals-created', {
                    message: 'New weekly goals set successfully',
                    action: 'created',
                    goalsCount: goals.length,
                    week: {
                        monday: mondayDateAndTime[0],
                        sunday: sundayDateAndTime[0]
                    },
                    goals: goals.map(goal => ({
                        type: goal.type,
                        target: goal.target,
                        current: goal.current || 0
                    })),
                    motivationalMessage: 'Start working towards your CO2 reduction goals!'
                });

                return res.status(200).json({
                    message: "New goals added successfully",
                    id: updateUserGoals._id
                })
            }
        } else {
            const mondayDateAndTime = getMondayDateAndTime(utcDateAndTime[0]);
            const sundayDateAndTime = getSundayDateAndTime();
            
            const newUserGoals = await co2Goals.insertOne({
                user: userEmail,
                localDateAndTime,
                logDate: utcDateAndTime,
                mondayDate: mondayDateAndTime[0],
                sundayDate: sundayDateAndTime[0],
                userGoals: goals
            });

            logger.info("New goals of user successfully added");
            
            sendGoalNotification(req, userId, 'goals-created', {
                message: 'Weekly goals created successfully',
                action: 'first-time',
                goalsCount: goals.length,
                week: {
                    monday: mondayDateAndTime[0],
                    sunday: sundayDateAndTime[0]
                },
                goals: goals.map(goal => ({
                    type: goal.type,
                    target: goal.target,
                    current: goal.current || 0
                })),
                motivationalMessage: 'Great start! Track your progress throughout the week.'
            });

            return res.status(201).json({
                message: "New goals added successfully",
                id: newUserGoals.insertedId,
            })
        }
    } catch (error) {
        logger.error("Server failed to connect to 'CO2DataDB' database: ", error.message);
        next(error);
    }
});

router.get("/weeklyGoals", async (req, res, next) => {
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

        const currentDateAndTime = new Date();
        const utcDateAndTime = getUTC(currentDateAndTime);
        const mondayDate = getMondayDateAndTime(utcDateAndTime[0])[0];
        const sundayDate = getSundayDateAndTime()[0];

        const findUserGoals = await co2Goals.findOne({
            user: userEmail, 
            logDate: {
                $gte: mondayDate,
                $lte: sundayDate
            }
        });

        if (!findUserGoals) {
            logger.info("Goals of user not found");
            
            sendGoalNotification(req, userId, 'goals-not-found', {
                message: 'No goals set for this week',
                suggestion: 'Set your weekly CO2 reduction goals to start tracking your progress',
                week: {
                    monday: mondayDate,
                    sunday: sundayDate
                }
            });

            return res.status(404).json({
                message: "Goals of user not found"
            });
        } else {
            logger.info("Goals of user successfully retrieved");
            
            const goalsWithProgress = findUserGoals.userGoals.map(goal => {
                const progress = goal.current ? (goal.current / goal.target) * 100 : 0;
                return {
                    type: goal.type,
                    target: goal.target,
                    current: goal.current || 0,
                    progress: Math.round(progress),
                    status: progress >= 100 ? 'completed' : progress >= 75 ? 'almost-there' : 'in-progress'
                };
            });

            const completedGoals = goalsWithProgress.filter(g => g.status === 'completed').length;
            const totalGoals = goalsWithProgress.length;
            
            sendGoalNotification(req, userId, 'goals-retrieved', {
                message: 'Weekly goals retrieved successfully',
                progress: {
                    completed: completedGoals,
                    total: totalGoals,
                    percentage: totalGoals > 0 ? Math.round((completedGoals / totalGoals) * 100) : 0
                },
                goals: goalsWithProgress,
                weekProgress: calculateWeekProgress(mondayDate, sundayDate) // You'd implement this helper
            });

            return res.status(200).json({
                data: findUserGoals
            });
        }
    } catch (error) {
        logger.error("Server failed to connect to 'CO2DataDB' database: ", error);
        next(error);
    }
});

function calculateWeekProgress(mondayDate, sundayDate) {
    const now = new Date();
    const weekStart = new Date(mondayDate);
    const weekEnd = new Date(sundayDate);
    const totalWeekMs = weekEnd - weekStart;
    const elapsedMs = now - weekStart;
    
    return Math.min(Math.round((elapsedMs / totalWeekMs) * 100), 100);
}

export class GoalProgressService {
    static async updateGoalProgress(req, userId, userEmail, co2Data) {
        try {
            const db = await co2DataDB();
            const co2Goals = db.collection('co2Goals');
            
            const currentDateAndTime = new Date();
            const utcDateAndTime = getUTC(currentDateAndTime);
            const mondayDate = getMondayDateAndTime(utcDateAndTime[0])[0];
            const sundayDate = getSundayDateAndTime()[0];

            const userGoals = await co2Goals.findOne({
                user: userEmail, 
                logDate: {
                    $gte: mondayDate,
                    $lte: sundayDate
                }
            });

            if (!userGoals) return;

            let goalsUpdated = false;
            const updatedGoals = userGoals.userGoals.map(goal => {
                const goalImpact = calculateGoalImpact(goal, co2Data);
                if (goalImpact > 0) {
                    goalsUpdated = true;
                    return {
                        ...goal,
                        current: (goal.current || 0) + goalImpact
                    };
                }
                return goal;
            });

            if (goalsUpdated) {
                const result = await co2Goals.findOneAndUpdate(
                    { _id: userGoals._id },
                    { $set: { userGoals: updatedGoals } },
                    { returnDocument: 'after' }
                );

                const completedGoals = updatedGoals.filter(goal => 
                    goal.current >= goal.target
                );

                sendGoalNotification(req, userId, 'goal-progress-updated', {
                    message: 'Goal progress updated',
                    updatedGoals: updatedGoals.map(goal => ({
                        type: goal.type,
                        target: goal.target,
                        current: goal.current,
                        progress: Math.round((goal.current / goal.target) * 100)
                    })),
                    newlyCompleted: completedGoals.filter(goal => 
                        !userGoals.userGoals.find(g => g.type === goal.type && g.current >= g.target)
                    ).map(goal => goal.type)
                });

                completedGoals.forEach(goal => {
                    if (!userGoals.userGoals.find(g => g.type === goal.type && g.current >= g.target)) {
                        sendGoalNotification(req, userId, 'goal-completed', {
                            message: `Congratulations! You completed your ${goal.type} goal!`,
                            goalType: goal.type,
                            target: goal.target,
                            achieved: goal.current,
                            celebration: true
                        });
                    }
                });
            }
        } catch (error) {
            logger.error('Error updating goal progress:', error.message);
        }
    }
}

function calculateGoalImpact(goal, co2Data) {
    switch (goal.type) {
        case 'transportation':
            return co2Data.transportation || 0;
        case 'diet':
            return co2Data.diet || 0;
        case 'energy':
            return co2Data.energy || 0;
        default:
            return co2Data.totalCO2 || 0;
    }
}

export { router as goalRoutes };