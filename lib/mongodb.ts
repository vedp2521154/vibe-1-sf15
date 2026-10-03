import { MongoClient, type Db } from "mongodb";

const globalForMongo = globalThis as typeof globalThis & {
  mongoClientPromise?: Promise<MongoClient>;
};

async function getMongoClient(uri: string): Promise<MongoClient> {
  if (!globalForMongo.mongoClientPromise) {
    const client = new MongoClient(uri);
    globalForMongo.mongoClientPromise = client.connect().catch((error: unknown) => {
      globalForMongo.mongoClientPromise = undefined;
      throw error;
    });
  }

  return globalForMongo.mongoClientPromise;
}

export async function getDatabase(): Promise<Db> {
  const uri = process.env.MONGODB_URI;
  const databaseName = process.env.MONGODB_DB;

  if (!uri) {
    throw new Error("MONGODB_URI is not configured.");
  }

  if (!databaseName) {
    throw new Error("MONGODB_DB is not configured.");
  }

  const client = await getMongoClient(uri);
  return client.db(databaseName);
}
