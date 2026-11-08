import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { getMessagesCollection } from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const collection = await getMessagesCollection();
    const [messages, unreadCount] = await Promise.all([
      collection.find({}).sort({ occurredAt: -1 }).limit(100).toArray(),
      collection.countDocuments({ isRead: false }),
    ]);

    return NextResponse.json(
      {
        messages: messages.map((message) => ({
          ...message,
          _id: message._id.toString(),
          readingId: message.readingId.toString(),
        })),
        unreadCount,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Gagal mengambil pesan sensor:", error);
    return NextResponse.json(
      { error: "Gagal mengambil pesan sensor dari MongoDB." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null) {
      return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });
    }

    const input = body as Record<string, unknown>;
    const collection = await getMessagesCollection();
    let filter: { isRead: false; _id?: { $in: ObjectId[] } } = { isRead: false };

    if (input.all !== true) {
      if (
        !Array.isArray(input.ids) ||
        input.ids.length < 1 ||
        input.ids.length > 100 ||
        !input.ids.every(
          (id) => typeof id === "string" && /^[a-f\d]{24}$/i.test(id),
        )
      ) {
        return NextResponse.json(
          { error: "ids harus berisi 1 sampai 100 ID pesan yang valid." },
          { status: 400 },
        );
      }
      filter = {
        isRead: false,
        _id: { $in: input.ids.map((id) => new ObjectId(id as string)) },
      };
    }

    const result = await collection.updateMany(filter, {
      $set: { isRead: true, readAt: new Date() },
    });
    const unreadCount = await collection.countDocuments({ isRead: false });

    return NextResponse.json(
      { ok: true, markedRead: result.modifiedCount, unreadCount },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Gagal menandai pesan sudah dibaca:", error);
    return NextResponse.json(
      { error: "Gagal memperbarui status pesan." },
      { status: 500 },
    );
  }
}
