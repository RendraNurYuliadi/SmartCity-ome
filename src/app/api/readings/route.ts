import { NextResponse } from "next/server";
import {
  getMessagesCollection,
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

function createAlertMessages(
  previous: SensorReading | null,
  current: Omit<SensorReading, "recordedAt">,
  occurredAt: Date,
) {
  const alerts: Array<{
    deviceId: string;
    type: string;
    title: string;
    body: string;
    severity: "critical" | "warning" | "info";
    occurredAt: Date;
    isRead: boolean;
    readAt: null;
  }> = [];
  const risingEdge = (active: boolean, wasActive: boolean) => active && !wasActive;

  if (risingEdge(current.floodDetected, previous?.floodDetected ?? false)) {
    alerts.push({
      deviceId: current.deviceId,
      type: "flood",
      title: "Peringatan banjir",
      body: `Water level mencapai ADC ${current.waterLevelRaw} (ambang banjir firmware: 500). Periksa sensor dan area.`,
      severity: "critical",
      occurredAt,
      isRead: false,
      readAt: null,
    });
  }

  if (risingEdge(current.vibrationDetected, previous?.vibrationDetected ?? false)) {
    alerts.push({
      deviceId: current.deviceId,
      type: "vibration",
      title: "Getaran terdeteksi",
      body: "Sensor getaran SW-420 mengaktifkan alarm. Periksa perangkat dan lokasi sensor.",
      severity: "warning",
      occurredAt,
      isRead: false,
      readAt: null,
    });
  }

  if (risingEdge(current.pirDetected, previous?.pirDetected ?? false)) {
    alerts.push({
      deviceId: current.deviceId,
      type: "motion",
      title: "Gerakan terdeteksi",
      body: "Sensor PIR mendeteksi gerakan dan membuka palang keluar.",
      severity: "info",
      occurredAt,
      isRead: false,
      readAt: null,
    });
  }

  if (
    current.temperatureC !== null &&
    current.temperatureC > 28 &&
    !(previous?.temperatureC !== null && previous?.temperatureC !== undefined && previous.temperatureC > 28)
  ) {
    alerts.push({
      deviceId: current.deviceId,
      type: "high-temperature",
      title: "Suhu melewati ambang",
      body: `Suhu ${current.temperatureC.toFixed(1)} °C melewati ambang firmware 28 °C; servo suhu dapat terbuka.`,
      severity: "warning",
      occurredAt,
      isRead: false,
      readAt: null,
    });
  }

  if (
    current.parking.occupied === 3 &&
    (previous?.parking.occupied ?? 0) < 3
  ) {
    alerts.push({
      deviceId: current.deviceId,
      type: "parking-full",
      title: "Parkir penuh",
      body: "Semua 3 slot parkir terdeteksi terisi.",
      severity: "info",
      occurredAt,
      isRead: false,
      readAt: null,
    });
  }

  return alerts;
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
    const readingsCollection = await getReadingsCollection();
    const previous = await readingsCollection.findOne(
      { deviceId: reading.deviceId },
      { sort: { recordedAt: -1 } },
    );
    const result = await readingsCollection.insertOne(reading);
    const alerts = createAlertMessages(previous, reading, reading.recordedAt);
    if (alerts.length > 0) {
      await getMessagesCollection().then((collection) =>
        collection.insertMany(
          alerts.map((alert) => ({ ...alert, readingId: result.insertedId })),
        ),
      );
    }

    return NextResponse.json(
      { ok: true, id: result.insertedId.toString(), recordedAt: reading.recordedAt },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Gagal menyimpan data sensor:", error);
    return NextResponse.json({ error: "Gagal menyimpan data sensor ke MongoDB." }, { status: 500 });
  }
}
