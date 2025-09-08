import express from "express";
import cors from "cors";
import helmet from "helmet";
import pino from "pino";
import mongoSanitize from "express-mongo-sanitize";
import { config } from "dotenv";
import { dataRoutes } from "./routes/dataRoutes";
import { userRoutes } from "./routes/userRoutes";

config();

const port = process.env.PORT ? process.env.PORT : 3000;
const server = express();
const logger = pino();

server.use(express.json());
server.use(helmet());
server.use(cors());
server.use(mongoSanitize());

server.use('/api/account', userRoutes);
server.use('/api/data', dataRoutes);
server.use((error, req, res, next) => {
    logger.error("Error: ", error);
    res.status(500).send('Internal Server Error');
});

server.get("/", (req, res) => {
    res.status(200).send("Inside the server");
})

server.listen(port, () => {
    logger.info(`Connected to the server running on port ${port}`);
    console.log(`Connected to the server running on port ${port}`);
});
