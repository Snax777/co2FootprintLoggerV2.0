import express from "express";
import cors from "cors";
import helmet from "helmet";
import pino from "pino";
import { dataRoutes } from "./routes/dataRoutes.js";
import { userRoutes } from "./routes/userRoutes.js";
import { goalRoutes } from "./routes/goalRoutes.js";
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const port = process.env.PORT ? process.env.PORT : 3000;
const server = express();
const logger = pino();

server.use(express.json());
server.use(express.urlencoded({extended: true}));
server.use(helmet());
server.use(cors());
server.use(express.static(path.join(__dirname, '../dist')));

server.use('/api/account', userRoutes);
server.use('/api/data', dataRoutes);
server.use('/api/goals', goalRoutes);
server.use((error, req, res, next) => {
    console.error("Error: ", next(error));
    res.status(500).send('Internal Server Error');
});

server.get("/", (req, res) => {
    res.status(200).send("Inside the server");
})

server.use((req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

server.listen(port, () => {
    // console.log(`Connected to the server running on port ${port}`);
    console.log(`Connected to the server running on port ${port}`);
});
