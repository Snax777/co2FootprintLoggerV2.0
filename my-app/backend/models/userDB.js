import { MongoClient } from "mongodb";
import { config } from "dotenv";

config();

let url = process.env.MONGODB_URI !== "mongodb://localhost:27017" ?
 `${process.env.MONGODB_URI}` : 
 "mongodb://localhost:27017";

async function connectToUserDB() {
    const clientInstance = new MongoClient(url);

    try {
        await clientInstance.connect();

        const dbInstance = clientInstance.db("UserDB");

        return dbInstance;
    } catch (error) {
        await clientInstance.close();

        throw error;
    }
}

export {connectToUserDB};