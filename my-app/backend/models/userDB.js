import { MongoClient } from "mongodb";
import { config } from "dotenv";

config();

let dbInstance = null;
let clientInstance = null;
const dbName = "UserDB";
let url = `${process.env.MONGODB_URI}`;

async function connectToUserDB() {
    if (dbInstance) {
        return dbInstance;
    }

    clientInstance = new MongoClient(url);

    try {
    await clientInstance.connect();

    dbInstance = clientInstance.db(dbName);

    return dbInstance;
    } catch (error) {
        await clientInstance.close();

        clientInstance = null;
        
        throw error;
    }
}

async function closeUserDBConnection() {
    if (clientInstance) {
        await clientInstance.close();
    }
    clientInstance = null;
    dbInstance = null;
}

export {connectToUserDB, closeUserDBConnection as closeUserDB};