import { MongoClient } from "mongodb";
import { config } from "dotenv";

config();

let dbInstance = null;
let clientInstance = null;
const dbName = "CO2Data";
let url = `${process.env.MONGODB_URI}`;

async function connectToCO2DataDB() {
    if (dbInstance) {
        return dbInstance;
    }

    clientInstance = new MongoClient(url);

    try {
    await clientInstance.connect();

    dbInstance = clientInstance.db(dbName);

    return dbInstance;
    } catch (error) {
        console.error("Connection to Database failed: ", error);
        await clientInstance.close();

        clientInstance = null;
        
        throw error;
    }
}

async function closeCO2DataDBConnection() {
    if (clientInstance) {
        await clientInstance.close();
    }
    clientInstance = null;
    dbInstance = null;
}

export {connectToCO2DataDB as co2DataDB, closeCO2DataDBConnection as closeCO2DataDB};