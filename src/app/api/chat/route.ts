import { NextResponse } from "next/server";
import { getReadingsCollection } from "@/lib/mongodb";
import { sensorAssistantPrompt } from "@/lib/chat-prompt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const freeModel = "openrouter/free";
const fallbackFreeModel = "nvidia/nemotron-3.5-lightning:free";
const maxHistoryMessages = 10;

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function extractText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (!Array.isArray(value)) return "";

  return value
    .map((part) => {
      if (typeof part === "string") return part;
      const item = asRecord(part);
      return item &&
        (item.type === "text" || item.type === "output_text") &&
        typeof item.text === "string"
        ? item.text
        : "";
    })
    .filter(Boolean)
    .join("\n")
    .trim();
}

function getAssistantText(result: unknown) {
  const responseBody = asRecord(result);
  const choices = responseBody?.choices;
  const firstChoice = Array.isArray(choices) ? asRecord(choices[0]) : null;
  const message = asRecord(firstChoice?.message);
  const content =
    extractText(message?.content) ||
    (typeof message?.refusal === "string" ? message.refusal.trim() : "");

  return { responseBody, firstChoice, message, content };
}

async function requestFallbackModel(messages: Array<{ role: string; content: string }>) {
  return fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://smarcityandhome.vercel.app",
      "X-OpenRouter-Title": "Smart Home & City",
    },
    body: JSON.stringify({
      model: fallbackFreeModel,
      messages,
      max_tokens: 1200,
      temperature: 0.2,
    }),
    signal: AbortSignal.timeout(30_000),
    cache: "no-store",
  });
}

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
    const formatReadingForAssistant = (reading: (typeof readings)[number]) => ({
      ...reading,
      _id: reading._id.toString(),
      recordedAt: reading.recordedAt.toISOString(),
      parking: {
        ...reading.parking,
        dashboardSlots: [
          { slot: "A", occupied: reading.parking.slotBOccupied },
          { slot: "B", occupied: reading.parking.slotAOccupied },
          { slot: "C", occupied: reading.parking.slotCOccupied },
        ],
      },
    });
    const sensorSnapshot = {
      refreshedAt: refreshedAt.toISOString(),
      latestReading: latest ? formatReadingForAssistant(latest) : null,
      recentReadings: readings.map(formatReadingForAssistant),
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
        max_tokens: 1200,
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
    let { responseBody, firstChoice, message: assistantMessage, content } =
      getAssistantText(result);
    let responseModel =
      typeof responseBody?.model === "string" ? responseBody.model : freeModel;

    if (!content) {
      console.error("OpenRouter mengembalikan pilihan tanpa teks:", {
        model: responseModel,
        finishReason: firstChoice?.finish_reason,
        nativeFinishReason: firstChoice?.native_finish_reason,
        messageFields: assistantMessage ? Object.keys(assistantMessage) : [],
        generationId: response.headers.get("X-Generation-Id"),
      });

      const fallbackResponse = await requestFallbackModel(messages);
      if (!fallbackResponse.ok) {
        const fallbackError: unknown = await fallbackResponse.json().catch(() => null);
        console.error("Model fallback OpenRouter gagal:", {
          status: fallbackResponse.status,
          model: fallbackFreeModel,
          generationId: fallbackResponse.headers.get("X-Generation-Id"),
          error: asRecord(asRecord(fallbackError)?.error)?.message,
        });
        return NextResponse.json(
          {
            error:
              fallbackResponse.status === 429
                ? "Model AI gratis sedang mencapai batas penggunaan. Coba lagi beberapa saat."
                : "Model AI gratis sementara tidak tersedia. Coba kirim pertanyaan lagi.",
          },
          { status: 502 },
        );
      }

      const fallbackResult: unknown = await fallbackResponse.json();
      const fallback = getAssistantText(fallbackResult);
      responseBody = fallback.responseBody;
      firstChoice = fallback.firstChoice;
      assistantMessage = fallback.message;
      content = fallback.content;
      responseModel =
        typeof responseBody?.model === "string" ? responseBody.model : fallbackFreeModel;

      if (!content) {
        console.error("Model fallback OpenRouter juga tidak menghasilkan teks:", {
          model: responseModel,
          finishReason: firstChoice?.finish_reason,
          nativeFinishReason: firstChoice?.native_finish_reason,
          messageFields: assistantMessage ? Object.keys(assistantMessage) : [],
          generationId: fallbackResponse.headers.get("X-Generation-Id"),
        });
        return NextResponse.json(
          { error: "Model AI gratis tidak menghasilkan jawaban. Silakan coba lagi." },
          { status: 502 },
        );
      }
    }

    return NextResponse.json(
      {
        answer: content,
        model: responseModel,
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
