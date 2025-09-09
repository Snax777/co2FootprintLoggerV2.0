import { MongoClient } from "mongodb";
import { config } from "dotenv";
import { pino } from "pino";

config();

let url = `${process.env.MONGODB_URI}`;
const logger = pino();

async function connectToCO2DataDB() {
    const clientInstance = new MongoClient(url);

    try {
        await clientInstance.connect();

        const dbInstance = clientInstance.db("co2Data");

        return dbInstance;
    } catch (error) {
        logger.error("Connection to Database failed: ", error);
        await clientInstance.close();

        throw error;
    }
}

export {connectToCO2DataDB as co2DataDB};