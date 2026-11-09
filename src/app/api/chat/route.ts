import { NextResponse } from "next/server";
import { getReadingsCollection } from "@/lib/mongodb";
import { sensorAssistantPrompt } from "@/lib/chat-prompt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const freeModel = "openrouter/free";
const maxHistoryMessages = 10;

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

function isChatHistory(value: unknown): value is ChatMessage[] {
  return (
    Array.isArray(value) &&
    value.length <= maxHistoryMessages &&
    value.every(
      (message) =>
        typeof message === "object" &&
        message !== null &&
        ((message as Record<string, unknown>).role === "user" ||
          (message as Record<string, unknown>).role === "assistant") &&
        typeof (message as Record<string, unknown>).content === "string" &&
        ((message as { content: string }).content.length <= 1500),
    )
  );
}

export async function POST(request: Request) {
  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json(
      { error: "OPENROUTER_API_KEY belum diatur pada environment Vercel." },
      { status: 503 },
    );
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "Body harus berupa JSON yang valid." }, { status: 400 });
  }

  if (typeof input !== "object" || input === null) {
    return NextResponse.json({ error: "Permintaan chat tidak valid." }, { status: 400 });
  }

  const body = input as Record<string, unknown>;
  if (
    typeof body.message !== "string" ||
    body.message.trim().length === 0 ||
    body.message.length > 1500 ||
    (body.history !== undefined && !isChatHistory(body.history))
  ) {
    return NextResponse.json(
      { error: "Pesan wajib diisi (maksimal 1500 karakter) dan riwayat chat harus valid." },
      { status: 400 },
    );
  }

  try {
    const readings = await getReadingsCollection().then((collection) =>
      collection.find({ deviceId: "esp32-smart-city" })
        .sort({ recordedAt: -1 })
        .limit(5)
        .toArray(),
    );
    const latest = readings[0] ?? null;
    const refreshedAt = new Date();
    const sensorSnapshot = {
      refreshedAt: refreshedAt.toISOString(),
      latestReading: latest
        ? {
            ...latest,
            _id: latest._id.toString(),
            recordedAt: latest.recordedAt.toISOString(),
          }
        : null,
      recentReadings: readings.map((reading) => ({
        ...reading,
        _id: reading._id.toString(),
        recordedAt: reading.recordedAt.toISOString(),
      })),
    };

    const history = isChatHistory(body.history) ? body.history.slice(-maxHistoryMessages) : [];
    const messages = [
      { role: "system", content: sensorAssistantPrompt },
      {
        role: "system",
        content: `Snapshot sensor terbaru dari MongoDB (JSON):\n${JSON.stringify(sensorSnapshot)}`,
      },
      ...history,
      { role: "user", content: body.message.trim() },
    ];

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://smarcityandhome.vercel.app",
        "X-OpenRouter-Title": "Smart Home & City",
      },
      body: JSON.stringify({
        model: freeModel,
        messages,
        max_tokens: 600,
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    });

    if (!response.ok) {
      const errorBody: unknown = await response.json().catch(() => null);
      console.error("OpenRouter request gagal:", {
        status: response.status,
        error:
          typeof errorBody === "object" && errorBody !== null
            ? (errorBody as Record<string, unknown>).error
            : undefined,
      });
      return NextResponse.json(
        {
          error:
            response.status === 429
              ? "Model gratis sedang mencapai batas penggunaan. Coba lagi beberapa saat."
              : "OpenRouter gagal menjawab. Periksa API key dan pengaturan proyek OpenRouter.",
        },
        { status: response.status === 401 ? 503 : 502 },
      );
    }

    const result: unknown = await response.json();
    const responseBody =
      typeof result === "object" &&
      result !== null &&
      Array.isArray((result as { choices?: unknown }).choices)
        ? result as {
            model?: unknown;
            choices: Array<{ message?: { content?: unknown } }>;
          }
        : null;
    const content = responseBody?.choices[0]?.message?.content;

    if (typeof content !== "string" || content.trim().length === 0) {
      console.error("OpenRouter mengembalikan respons chat kosong.");
      return NextResponse.json({ error: "AI tidak mengembalikan jawaban teks." }, { status: 502 });
    }

    return NextResponse.json(
      {
        answer: content.trim(),
        model: typeof responseBody?.model === "string" ? responseBody.model : freeModel,
        refreshedAt: refreshedAt.toISOString(),
        readingAt: latest?.recordedAt.toISOString() ?? null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Gagal memproses chat sensor:", error);
    const timedOut =
      typeof error === "object" &&
      error !== null &&
      "name" in error &&
      error.name === "TimeoutError";
    return NextResponse.json(
      {
        error: timedOut
          ? "Permintaan AI melewati batas waktu. Coba lagi."
          : "Gagal membaca data sensor terbaru atau menghubungi OpenRouter.",
      },
      { status: timedOut ? 504 : 500 },
    );
  }
}
