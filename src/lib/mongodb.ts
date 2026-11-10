import {
  MongoClient,
  type ObjectId,
  type Collection,
  type Db,
  type Document,
} from "mongodb";

const readingsCollectionName = "sensor_readings";
const cappedReadingsCollectionName = "sensor_readings_latest50";
const commandsCollectionName = "device_commands";
const messagesCollectionName = "sensor_messages";
const maxReadings = 50;

const readingsValidator: Document = {
  $jsonSchema: {
    bsonType: "object",
    required: [
      "deviceId",
      "recordedAt",
      "temperatureC",
      "humidityPercent",
      "distanceCm",
      "parking",
      "pirDetected",
      "ldrRaw",
      "streetLightOn",
      "waterLevelRaw",
      "floodDetected",
      "vibrationDetected",
      "rgbLedOn",
      "trafficLight",
      "entryGateOpen",
      "exitGateOpen",
    ],
    properties: {
      deviceId: { bsonType: "string" },
      recordedAt: { bsonType: "date" },
      temperatureC: { bsonType: ["double", "int", "long", "decimal", "null"] },
      humidityPercent: { bsonType: ["double", "int", "long", "decimal", "null"] },
      distanceCm: { bsonType: ["double", "int", "long", "decimal", "null"] },
      parking: {
        bsonType: "object",
        required: [
          "slotAOccupied",
          "slotBOccupied",
          "slotCOccupied",
          "occupied",
          "available",
        ],
        properties: {
          slotAOccupied: { bsonType: "bool" },
          slotBOccupied: { bsonType: "bool" },
          slotCOccupied: { bsonType: "bool" },
          occupied: { bsonType: ["int", "long", "double"] },
          available: { bsonType: ["int", "long", "double"] },
        },
      },
      pirDetected: { bsonType: "bool" },
      ldrRaw: { bsonType: ["int", "long", "double"] },
      streetLightOn: { bsonType: "bool" },
      waterLevelRaw: { bsonType: ["int", "long", "double"] },
      floodDetected: { bsonType: "bool" },
      vibrationDetected: { bsonType: "bool" },
      rgbLedOn: { bsonType: "bool" },
      trafficLight: { enum: ["green", "yellow", "red"] },
      entryGateOpen: { bsonType: "bool" },
      exitGateOpen: { bsonType: "bool" },
    },
  },
};

const commandsValidator: Document = {
  $jsonSchema: {
    bsonType: "object",
    required: ["_id", "rgbLedOn", "updatedAt"],
    properties: {
      _id: { bsonType: "string" },
      rgbLedOn: { bsonType: "bool" },
      streetLightOverride: { bsonType: ["bool", "null"] },
      temperatureServoOverride: { bsonType: ["bool", "null"] },
      updatedAt: { bsonType: "date" },
    },
  },
};

const messagesValidator: Document = {
  $jsonSchema: {
    bsonType: "object",
    required: [
      "deviceId",
      "type",
      "title",
      "body",
      "severity",
      "occurredAt",
      "isRead",
      "readAt",
      "readingId",
    ],
    properties: {
      deviceId: { bsonType: "string" },
      type: { bsonType: "string" },
      title: { bsonType: "string" },
      body: { bsonType: "string" },
      severity: { enum: ["critical", "warning", "info"] },
      occurredAt: { bsonType: "date" },
      isRead: { bsonType: "bool" },
      readAt: { bsonType: ["date", "null"] },
      readingId: { bsonType: "objectId" },
    },
  },
};

type MongoGlobal = typeof globalThis & {
  _mongoClientPromise?: Promise<MongoClient>;
  _mongoSetupPromise?: Promise<void>;
};

const mongoGlobal = globalThis as MongoGlobal;
let activeReadingsCollectionName = readingsCollectionName;

function getClientPromise() {
  if (!mongoGlobal._mongoClientPromise) {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error("MONGODB_URI belum diatur. Salin .env.example menjadi .env.local.");
    }

    const client = new MongoClient(uri);
    mongoGlobal._mongoClientPromise = client.connect();
  }

  return mongoGlobal._mongoClientPromise;
}

async function getDatabase(): Promise<Db> {
  const client = await getClientPromise();
  return client.db(process.env.MONGODB_DB || "smart_home_city");
}

async function ensureCollections(db: Db) {
  if (!mongoGlobal._mongoSetupPromise) {
    mongoGlobal._mongoSetupPromise = (async () => {
      const originalReadings = await db
        .listCollections({ name: readingsCollectionName }, { nameOnly: false })
        .next();
      activeReadingsCollectionName =
        originalReadings &&
        (!originalReadings.options?.capped ||
          originalReadings.options.max !== maxReadings)
          ? cappedReadingsCollectionName
          : readingsCollectionName;

      let readingsInfo = await db
        .listCollections(
          { name: activeReadingsCollectionName },
          { nameOnly: false },
        )
        .next();

      if (!readingsInfo) {
        try {
          await db.createCollection(activeReadingsCollectionName, {
            capped: true,
            size: 1024 * 1024,
            max: maxReadings,
            validator: readingsValidator,
          });
        } catch (error) {
          if (
            typeof error !== "object" ||
            error === null ||
            !("code" in error) ||
            error.code !== 48
          ) {
            throw error;
          }
        }
        readingsInfo = await db
          .listCollections(
            { name: activeReadingsCollectionName },
            { nameOnly: false },
          )
          .next();
      }

      if (
        !readingsInfo?.options?.capped ||
        readingsInfo.options.max !== maxReadings
      ) {
        throw new Error(
          `Collection ${activeReadingsCollectionName} harus capped dengan max ${maxReadings}. Data collection yang sudah ada tidak dihapus.`,
        );
      }

      const commandsExists = await db
        .listCollections({ name: commandsCollectionName }, { nameOnly: true })
        .hasNext();
      if (!commandsExists) {
        try {
          await db.createCollection(commandsCollectionName, {
            validator: commandsValidator,
          });
        } catch (error) {
          if (
            typeof error !== "object" ||
            error === null ||
            !("code" in error) ||
            error.code !== 48
          ) {
            throw error;
          }
        }
      }

      const messagesExists = await db
        .listCollections({ name: messagesCollectionName }, { nameOnly: true })
        .hasNext();
      if (!messagesExists) {
        try {
          await db.createCollection(messagesCollectionName, {
            validator: messagesValidator,
          });
        } catch (error) {
          if (
            typeof error !== "object" ||
            error === null ||
            !("code" in error) ||
            error.code !== 48
          ) {
            throw error;
          }
        }
      }

      await db
        .collection(messagesCollectionName)
        .createIndex({ isRead: 1, occurredAt: -1 });
    })().catch((error: unknown) => {
      mongoGlobal._mongoSetupPromise = undefined;
      throw error;
    });
  }

  await mongoGlobal._mongoSetupPromise;
}

export type SensorReading = {
  deviceId: string;
  recordedAt: Date;
  temperatureC: number | null;
  humidityPercent: number | null;
  distanceCm: number | null;
  parking: {
    slotAOccupied: boolean;
    slotBOccupied: boolean;
    slotCOccupied: boolean;
    occupied: number;
    available: number;
  };
  pirDetected: boolean;
  ldrRaw: number;
  streetLightOn: boolean;
  temperatureServoOpen?: boolean;
  waterLevelRaw: number;
  floodDetected: boolean;
  vibrationDetected: boolean;
  rgbLedOn: boolean;
  trafficLight: "green" | "yellow" | "red";
  entryGateOpen: boolean;
  exitGateOpen: boolean;
};

export type DeviceCommand = {
  _id: string;
  rgbLedOn: boolean;
  streetLightOverride?: boolean | null;
  temperatureServoOverride?: boolean | null;
  updatedAt: Date;
};

export type SensorMessage = {
  deviceId: string;
  type: string;
  title: string;
  body: string;
  severity: "critical" | "warning" | "info";
  occurredAt: Date;
  isRead: boolean;
  readAt: Date | null;
  readingId: ObjectId;
};

export async function getReadingsCollection(): Promise<Collection<SensorReading>> {
  const db = await getDatabase();
  await ensureCollections(db);
  return db.collection<SensorReading>(activeReadingsCollectionName);
}

export async function getCommandsCollection(): Promise<Collection<DeviceCommand>> {
  const db = await getDatabase();
  await ensureCollections(db);
  return db.collection<DeviceCommand>(commandsCollectionName);
}

export async function getMessagesCollection(): Promise<Collection<SensorMessage>> {
  const db = await getDatabase();
  await ensureCollections(db);
  return db.collection<SensorMessage>(messagesCollectionName);
}

export async function closeMongoConnection() {
  const clientPromise = mongoGlobal._mongoClientPromise;
  if (clientPromise) {
    const client = await clientPromise;
    await client.close();
  }
  mongoGlobal._mongoClientPromise = undefined;
  mongoGlobal._mongoSetupPromise = undefined;
}

export { maxReadings };
