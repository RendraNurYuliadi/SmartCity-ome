import { NextResponse } from "next/server";
import { getCommandsCollection } from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const deviceId = "esp32-smart-city";

export async function GET() {
  try {
    const command = await getCommandsCollection().then((collection) =>
      collection.findOne({ _id: deviceId }),
    );
    return NextResponse.json(
      {
        deviceId,
        rgbLedOn: command?.rgbLedOn ?? false,
        streetLightOverride: command?.streetLightOverride ?? null,
        temperatureServoOverride: command?.temperatureServoOverride ?? null,
        updatedAt: command?.updatedAt ?? null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Gagal membaca perintah perangkat:", error);
    return NextResponse.json({ error: "Gagal membaca perintah perangkat." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Format perintah perangkat tidak valid." }, { status: 400 });
    }

    const payload = body as Record<string, unknown>;
    const updates: {
      rgbLedOn?: boolean;
      streetLightOverride?: boolean | null;
      temperatureServoOverride?: boolean | null;
      updatedAt: Date;
    } = { updatedAt: new Date() };
    let hasCommand = false;

    if (Object.prototype.hasOwnProperty.call(payload, "rgbLedOn")) {
      if (typeof payload.rgbLedOn !== "boolean") {
        return NextResponse.json({ error: "rgbLedOn harus bernilai true atau false." }, { status: 400 });
      }
      updates.rgbLedOn = payload.rgbLedOn;
      hasCommand = true;
    }

    if (Object.prototype.hasOwnProperty.call(payload, "streetLightOverride")) {
      if (payload.streetLightOverride !== null && typeof payload.streetLightOverride !== "boolean") {
        return NextResponse.json({ error: "streetLightOverride harus bernilai true, false, atau null untuk mode otomatis." }, { status: 400 });
      }
      updates.streetLightOverride = payload.streetLightOverride;
      hasCommand = true;
    }

    if (Object.prototype.hasOwnProperty.call(payload, "temperatureServoOverride")) {
      if (payload.temperatureServoOverride !== null && typeof payload.temperatureServoOverride !== "boolean") {
        return NextResponse.json({ error: "temperatureServoOverride harus bernilai true, false, atau null untuk mode otomatis." }, { status: 400 });
      }
      updates.temperatureServoOverride = payload.temperatureServoOverride;
      hasCommand = true;
    }

    if (!hasCommand) {
      return NextResponse.json({ error: "Minimal satu perintah perangkat harus dikirim." }, { status: 400 });
    }

    const collection = await getCommandsCollection();
    await collection.updateOne(
      { _id: deviceId },
      {
        $set: updates,
        ...(updates.rgbLedOn === undefined
          ? { $setOnInsert: { rgbLedOn: false } }
          : {}),
      },
      { upsert: true },
    );
    const command = await collection.findOne({ _id: deviceId });
    if (!command) {
      throw new Error("Perintah perangkat tidak ditemukan setelah diperbarui.");
    }

    return NextResponse.json(
      {
        ok: true,
        deviceId,
        rgbLedOn: command.rgbLedOn,
        streetLightOverride: command?.streetLightOverride ?? null,
        temperatureServoOverride: command?.temperatureServoOverride ?? null,
        updatedAt: updates.updatedAt,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Gagal mengirim perintah ke perangkat:", error);
    return NextResponse.json({ error: "Gagal mengirim perintah ke perangkat." }, { status: 500 });
  }
}
