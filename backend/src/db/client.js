import { MongoClient } from "mongodb";
import { env } from "../config/env.js";

let client;
let db;

export async function getDb() {
  if (db) return db;
  if (!env.mongodbUri) {
    throw new Error("MONGODB_URI is required");
  }
  client = new MongoClient(env.mongodbUri);
  await client.connect();
  db = client.db(env.mongodbDb);
  return db;
}

export async function pingDb() {
  const database = await getDb();
  await database.command({ ping: 1 });
  return true;
}

export async function closeDb() {
  if (client) {
    await client.close();
    client = undefined;
    db = undefined;
  }
}
