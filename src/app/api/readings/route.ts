import { NextResponse } from "next/server";
import {
  getReadingsCollection,
  maxReadings,
  type SensorReading,
} from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isFiniteNumberOrNull(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function isReadingPayload(
  value: unknown,
): value is Omit<SensorReading, "recordedAt"> {
  if (typeof value !== "object" || value === null) return false;
  const reading = value as Record<string, unknown>;
  const parking = reading.parking;
  if (typeof parking !== "object" || parking === null) return false;
  const slots = parking as Record<string, unknown>;
  const validTrafficLight = ["green", "yellow", "red"].includes(
    String(reading.trafficLight),
  );

  return (
    typeof reading.deviceId === "string" &&
    reading.deviceId.length > 0 &&
    reading.deviceId.length <= 64 &&
    isFiniteNumberOrNull(reading.temperatureC) &&
    isFiniteNumberOrNull(reading.humidityPercent) &&
    isFiniteNumberOrNull(reading.distanceCm) &&
    isBoolean(slots.slotAOccupied) &&
    isBoolean(slots.slotBOccupied) &&
    isBoolean(slots.slotCOccupied) &&
    Number.isInteger(slots.occupied) &&
    Number.isInteger(slots.available) &&
    isBoolean(reading.pirDetected) &&
    Number.isInteger(reading.ldrRaw) &&
    isBoolean(reading.streetLightOn) &&
    Number.isInteger(reading.waterLevelRaw) &&
    isBoolean(reading.floodDetected) &&
    isBoolean(reading.vibrationDetected) &&
    isBoolean(reading.rgbLedOn) &&
    validTrafficLight &&
    isBoolean(reading.entryGateOpen) &&
    isBoolean(reading.exitGateOpen)
  );
}

export async function GET(request: Request) {
  try {
    const requestedLimit = Number(new URL(request.url).searchParams.get("limit") ?? maxReadings);
    const limit =
      Number.isInteger(requestedLimit) && requestedLimit > 0
        ? Math.min(requestedLimit, maxReadings)
        : maxReadings;
    const collection = await getReadingsCollection();
    const readings = await collection
      .find({})
      .sort({ recordedAt: -1 })
      .limit(limit)
      .toArray();

    return NextResponse.json(
      { readings: readings.map((reading) => ({ ...reading, _id: reading._id.toString() })) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Gagal mengambil data sensor:", error);
    return NextResponse.json({ error: "Gagal mengambil data sensor dari MongoDB." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload: unknown = await request.json();
    if (!isReadingPayload(payload)) {
      return NextResponse.json({ error: "Format data sensor tidak valid." }, { status: 400 });
    }

    const reading = {
      ...payload,
      recordedAt: new Date(),
    };
    const result = await getReadingsCollection().then((collection) =>
      collection.insertOne(reading),
    );

    return NextResponse.json(
      { ok: true, id: result.insertedId.toString(), recordedAt: reading.recordedAt },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Gagal menyimpan data sensor:", error);
    return NextResponse.json({ error: "Gagal menyimpan data sensor ke MongoDB." }, { status: 500 });
  }
}
