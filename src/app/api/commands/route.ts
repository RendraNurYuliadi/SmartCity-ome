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
      { deviceId, rgbLedOn: command?.rgbLedOn ?? false },
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
    if (
      typeof body !== "object" ||
      body === null ||
      typeof (body as Record<string, unknown>).rgbLedOn !== "boolean"
    ) {
      return NextResponse.json({ error: "rgbLedOn harus bernilai true atau false." }, { status: 400 });
    }

    const rgbLedOn = (body as { rgbLedOn: boolean }).rgbLedOn;
    await getCommandsCollection().then((collection) =>
      collection.updateOne(
        { _id: deviceId },
        { $set: { rgbLedOn, updatedAt: new Date() } },
        { upsert: true },
      ),
    );

    return NextResponse.json(
      { ok: true, deviceId, rgbLedOn },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Gagal mengirim perintah ke perangkat:", error);
    return NextResponse.json({ error: "Gagal mengirim perintah ke perangkat." }, { status: 500 });
  }
}
