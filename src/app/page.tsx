"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDown,
  ArrowUpRight,
  Bot,
  CheckCheck,
  CarFront,
  Check,
  ChevronRight,
  CloudRain,
  Droplets,
  Gauge,
  Lightbulb,
  LoaderCircle,
  MessageCircle,
  MessageSquare,
  Radio,
  RefreshCw,
  Send,
  ShieldAlert,
  Thermometer,
  Vibrate,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SensorReading } from "@/lib/mongodb";

type Reading = Omit<SensorReading, "recordedAt"> & {
  _id: string;
  recordedAt: string;
};
type Page = "dashboard" | "control" | "messages" | "chat";
type InboxMessage = {
  _id: string;
  type: string;
  title: string;
  body: string;
  severity: "critical" | "warning" | "info";
  occurredAt: string;
  isRead: boolean;
};
type ChatEntry = { role: "user" | "assistant"; content: string };

const formatTime = (date: string) =>
  new Date(date).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

function MetricCard({
  label,
  value,
  unit,
  icon: Icon,
  detail,
  accent = "text-[#b7f36b]",
}: {
  label: string;
  value: string;
  unit: string;
  icon: typeof Thermometer;
  detail: string;
  accent?: string;
}) {
  return (
    <article className="rounded-2xl border border-white/[0.08] bg-[#101714]/90 p-5 transition hover:border-white/[0.15]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-[#98a49d]">{label}</p>
          <div className="mt-4 flex items-baseline gap-1.5">
            <span className="text-3xl font-semibold tracking-tight text-white">{value}</span>
            <span className="text-sm text-[#98a49d]">{unit}</span>
          </div>
        </div>
        <span className={`rounded-xl bg-white/[0.05] p-2.5 ${accent}`}>
          <Icon size={19} strokeWidth={1.8} />
        </span>
      </div>
      <p className="mt-4 border-t border-white/[0.06] pt-3 text-xs text-[#8c9991]">{detail}</p>
    </article>
  );
}

function StatusPill({ active, onText, offText }: { active: boolean; onText: string; offText: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
        active ? "bg-[#b7f36b]/10 text-[#b7f36b]" : "bg-white/[0.06] text-[#98a49d]"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-[#b7f36b]" : "bg-[#6c7770]"}`} />
      {active ? onText : offText}
    </span>
  );
}

export default function Home() {
  const [page, setPage] = useState<Page>("dashboard");
  const [readings, setReadings] = useState<Reading[]>([]);
  const [rgbLedOn, setRgbLedOn] = useState(false);
  const [loadingCommand, setLoadingCommand] = useState(false);
  const [online, setOnline] = useState(false);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [chatEntries, setChatEntries] = useState<ChatEntry[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");
  const [chatSnapshot, setChatSnapshot] = useState<{
    model: string;
    refreshedAt: string;
    readingAt: string | null;
  } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [readingsResponse, commandResponse, messagesResponse] = await Promise.all([
        fetch("/api/readings?limit=50", { cache: "no-store" }),
        fetch("/api/commands", { cache: "no-store" }),
        fetch("/api/messages", { cache: "no-store" }),
      ]);
      if (!readingsResponse.ok || !commandResponse.ok || !messagesResponse.ok) {
        throw new Error("Tidak dapat terhubung ke API atau MongoDB.");
      }
      const readingsData: { readings: Reading[] } = await readingsResponse.json();
      const commandData: { rgbLedOn: boolean } = await commandResponse.json();
      const messagesData: { messages: InboxMessage[]; unreadCount: number } =
        await messagesResponse.json();
      setReadings(readingsData.readings);
      setRgbLedOn(commandData.rgbLedOn);
      setMessages(messagesData.messages);
      setUnreadCount(messagesData.unreadCount);
      setOnline(true);
      setError("");
    } catch (cause) {
      setOnline(false);
      setError(cause instanceof Error ? cause.message : "Terjadi kesalahan koneksi.");
    }
  }, []);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      await refresh();
      if (active) timer = setTimeout(poll, 1500);
    };
    void poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [refresh]);

  const latest = readings[0];
  const chartData = useMemo(
    () =>
      [...readings]
        .reverse()
        .map((reading) => ({
          time: formatTime(reading.recordedAt),
          suhu: reading.temperatureC,
          kelembapan: reading.humidityPercent,
        })),
    [readings],
  );

  const toggleLight = async () => {
    setLoadingCommand(true);
    try {
      const response = await fetch("/api/commands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rgbLedOn: !rgbLedOn }),
      });
      if (!response.ok) throw new Error("Perintah lampu gagal dikirim.");
      const result: { rgbLedOn: boolean } = await response.json();
      setRgbLedOn(result.rgbLedOn);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal mengirim perintah.");
    } finally {
      setLoadingCommand(false);
    }
  };

  const markMessageRead = async (messageId: string) => {
    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [messageId] }),
      });
      if (!response.ok) throw new Error("Status pesan gagal diperbarui.");
      const result: { unreadCount: number } = await response.json();
      setMessages((current) =>
        current.map((message) =>
          message._id === messageId ? { ...message, isRead: true } : message,
        ),
      );
      setUnreadCount(result.unreadCount);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal memperbarui pesan.");
    }
  };

  const markAllMessagesRead = async () => {
    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      if (!response.ok) throw new Error("Pesan gagal ditandai sudah dibaca.");
      const result: { unreadCount: number } = await response.json();
      setMessages((current) => current.map((message) => ({ ...message, isRead: true })));
      setUnreadCount(result.unreadCount);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal memperbarui pesan.");
    }
  };

  const sendChatMessage = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = chatInput.trim();
    if (!message || chatLoading) return;

    const history = chatEntries.slice(-8);
    setChatEntries((current) => [...current, { role: "user", content: message }]);
    setChatInput("");
    setChatLoading(true);
    setChatError("");
    setChatSnapshot(null);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history }),
      });
      const result: {
        answer?: string;
        model?: string;
        refreshedAt?: string;
        readingAt?: string | null;
        error?: string;
      } = await response.json();
      if (!response.ok || !result.answer || !result.model || !result.refreshedAt) {
        throw new Error(result.error || "AI gagal menjawab.");
      }

      setChatEntries((current) => [
        ...current,
        { role: "assistant", content: result.answer! },
      ]);
      setChatSnapshot({
        model: result.model,
        refreshedAt: result.refreshedAt,
        readingAt: result.readingAt ?? null,
      });
      void refresh();
    } catch (cause) {
      setChatError(cause instanceof Error ? cause.message : "Gagal menghubungi AI.");
    } finally {
      setChatLoading(false);
    }
  };

  const selectPage = (nextPage: Page) => {
    setPage(nextPage);
    if (nextPage === "messages") void refresh();
  };

  const occupied = latest?.parking.occupied ?? 0;
  const slots = [
    { name: "Slot A", occupied: latest?.parking.slotAOccupied ?? false },
    { name: "Slot B", occupied: latest?.parking.slotBOccupied ?? false },
    { name: "Slot C", occupied: latest?.parking.slotCOccupied ?? false },
  ];
  const pageTitle =
    page === "dashboard"
      ? "Data Dashboard"
      : page === "control"
        ? "Kontrol ESP32"
        : page === "messages"
          ? "Message"
          : "AI Sensor";

  return (
    <main className="grid-lines min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-[1440px]">
        <aside className="hidden w-[248px] shrink-0 border-r border-white/[0.07] px-5 py-7 lg:flex lg:flex-col">
          <a className="flex items-center gap-3 px-2" href="#" onClick={() => setPage("dashboard")}>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#b7f36b] text-[#121a10]">
              <Activity size={21} strokeWidth={2.5} />
            </span>
            <span>
              <span className="block text-sm font-semibold tracking-wide">NUSA<span className="text-[#b7f36b]">IOT</span></span>
              <span className="mt-0.5 block text-[10px] tracking-[0.18em] text-[#87948b]">SMART CITY SYSTEM</span>
            </span>
          </a>

          <div className="mt-12 px-3 text-[10px] font-semibold tracking-[0.18em] text-[#69766d]">MENU UTAMA</div>
          <nav className="mt-3 space-y-1">
            <button
              onClick={() => selectPage("dashboard")}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${
                page === "dashboard" ? "bg-[#b7f36b]/10 font-medium text-[#c7fa8f]" : "text-[#9ba79f] hover:bg-white/[0.04]"
              }`}
            >
              <Activity size={18} /> Data Dashboard
              {page === "dashboard" && <ChevronRight className="ml-auto" size={15} />}
            </button>
            <button
              onClick={() => selectPage("control")}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${
                page === "control" ? "bg-[#b7f36b]/10 font-medium text-[#c7fa8f]" : "text-[#9ba79f] hover:bg-white/[0.04]"
              }`}
            >
              <Lightbulb size={18} /> Kontrol ESP32
              {page === "control" && <ChevronRight className="ml-auto" size={15} />}
            </button>
            <button
              onClick={() => selectPage("messages")}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${
                page === "messages" ? "bg-[#b7f36b]/10 font-medium text-[#c7fa8f]" : "text-[#9ba79f] hover:bg-white/[0.04]"
              }`}
            >
              <MessageSquare size={18} /> Message
              {unreadCount > 0 && (
                <span className="ml-auto flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[#f45f57] px-1.5 text-[10px] font-bold text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
              {page === "messages" && <ChevronRight className="ml-1" size={15} />}
            </button>
            <button
              onClick={() => selectPage("chat")}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${
                page === "chat" ? "bg-[#b7f36b]/10 font-medium text-[#c7fa8f]" : "text-[#9ba79f] hover:bg-white/[0.04]"
              }`}
            >
              <Bot size={18} /> Chatbot AI
              {page === "chat" && <ChevronRight className="ml-auto" size={15} />}
            </button>
          </nav>

          <div className="mt-auto rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-white">
              <span className={`h-2 w-2 rounded-full ${online ? "bg-[#b7f36b]" : "bg-[#f5a76e]"}`} />
              {online ? "API terhubung" : "Menunggu koneksi"}
            </div>
            <p className="mt-2 text-[11px] leading-5 text-[#849188]">Data diperbarui otomatis setiap 1,5 detik.</p>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="flex min-h-[76px] items-center justify-between border-b border-white/[0.07] px-5 sm:px-8">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#b7f36b] text-[#121a10] lg:hidden">
                <Activity size={19} />
              </span>
              <div>
                <p className="text-sm font-semibold">{pageTitle}</p>
                <p className="mt-0.5 text-[11px] text-[#839087]">Smart Home &amp; City · Monitoring System</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <span className="hidden items-center gap-2 rounded-full border border-white/[0.08] px-3 py-1.5 text-xs text-[#adb8b0] sm:flex">
                {online ? <Wifi size={14} className="text-[#b7f36b]" /> : <WifiOff size={14} className="text-[#f5a76e]" />}
                {online ? "Sistem online" : "Offline"}
              </span>
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.1] bg-[#171f1a] text-xs font-semibold text-[#c3d2c7]">SC</span>
            </div>
          </header>

          <div className="flex gap-2 border-b border-white/[0.07] px-5 py-3 lg:hidden">
            <button onClick={() => selectPage("dashboard")} className={`rounded-lg px-3 py-2 text-xs ${page === "dashboard" ? "bg-[#b7f36b]/10 text-[#c7fa8f]" : "text-[#98a49d]"}`}>Dashboard</button>
            <button onClick={() => selectPage("control")} className={`rounded-lg px-3 py-2 text-xs ${page === "control" ? "bg-[#b7f36b]/10 text-[#c7fa8f]" : "text-[#98a49d]"}`}>Kontrol</button>
            <button onClick={() => selectPage("messages")} className={`relative rounded-lg px-3 py-2 text-xs ${page === "messages" ? "bg-[#b7f36b]/10 text-[#c7fa8f]" : "text-[#98a49d]"}`}>
              Message {unreadCount > 0 && <span className="ml-1 rounded-full bg-[#f45f57] px-1.5 py-0.5 text-[10px] text-white">{unreadCount > 99 ? "99+" : unreadCount}</span>}
            </button>
            <button onClick={() => selectPage("chat")} className={`rounded-lg px-3 py-2 text-xs ${page === "chat" ? "bg-[#b7f36b]/10 text-[#c7fa8f]" : "text-[#98a49d]"}`}>Chat AI</button>
          </div>

          <section className="px-5 py-7 sm:px-8 sm:py-9">
            <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-medium tracking-[0.16em] text-[#9daa9f]">{page === "messages" ? "PUSAT NOTIFIKASI" : page === "chat" ? "ASISTEN SENSOR" : "MONITORING PERANGKAT"}</p>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-[30px]">
                  {page === "dashboard" ? <>Kondisi <span className="text-[#b7f36b]">saat ini</span></> : page === "control" ? <>Kontrol <span className="text-[#b7f36b]">perangkat</span></> : page === "messages" ? <>Pesan <span className="text-[#b7f36b]">sensor</span></> : <>Chatbot <span className="text-[#b7f36b]">Gen AI</span></>}
                </h1>
                <p className="mt-2 text-sm text-[#8d9a91]">
                  {page === "dashboard" ? "Ringkasan sensor dan aktivitas ESP32 secara realtime." : page === "control" ? "Kirim perintah langsung ke LED RGB pada board ESP32." : page === "messages" ? "Baca dan kelola peringatan yang dikirim dari sensor ESP32." : "Tanya kondisi ESP32; data terbaru dibaca langsung sebelum AI menjawab."}
                </p>
              </div>
              <button onClick={() => void refresh()} className="flex items-center gap-2 rounded-xl border border-white/[0.1] px-3.5 py-2.5 text-xs text-[#c2ccc5] transition hover:bg-white/[0.05]">
                <RefreshCw size={14} /> Perbarui data
              </button>
            </div>

            {error && (
              <div className="mb-5 flex items-center gap-2 rounded-xl border border-[#f5a76e]/20 bg-[#f5a76e]/[0.07] px-4 py-3 text-xs text-[#f3b58a]">
                <WifiOff size={15} /> {error}
              </div>
            )}

            {page === "dashboard" ? (
              <>
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-[#101714]/90 px-5 py-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#b7f36b]/10 text-[#b7f36b]"><Radio size={19} /></span>
                    <div><p className="text-sm font-medium">ESP32 Smart City</p><p className="mt-1 text-xs text-[#87948b]">ID perangkat · esp32-smart-city</p></div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusPill active={online && Boolean(latest)} onText="TERHUBUNG" offText="MENUNGGU DATA" />
                    <span className="hidden text-xs text-[#849188] sm:block">{latest ? `Update ${formatTime(latest.recordedAt)}` : "Belum ada data"}</span>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricCard label="Suhu udara" value={latest?.temperatureC == null ? "--" : latest.temperatureC.toFixed(1)} unit="°C" icon={Thermometer} detail="Sensor DHT11 · GPIO4" />
                  <MetricCard label="Kelembapan" value={latest?.humidityPercent == null ? "--" : latest.humidityPercent.toFixed(0)} unit="%" icon={Droplets} detail="Sensor DHT11 · GPIO4" accent="text-[#83c9ff]" />
                  <MetricCard label="Parkir terisi" value={String(occupied)} unit="/ 3 slot" icon={CarFront} detail={`${3 - occupied} slot tersedia`} accent="text-[#d3b8ff]" />
                  <MetricCard label="Level air" value={latest ? String(latest.waterLevelRaw) : "--"} unit="ADC" icon={CloudRain} detail={latest?.floodDetected ? "Peringatan · banjir terdeteksi" : "Sensor water level · GPIO35"} accent={latest?.floodDetected ? "text-[#ff896f]" : "text-[#83c9ff]"} />
                </div>

                <div className="mt-5 grid gap-5 xl:grid-cols-[1.65fr_1fr]">
                  <article className="rounded-2xl border border-white/[0.08] bg-[#101714]/90 p-5 sm:p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div><h2 className="text-sm font-semibold">Tren suhu &amp; kelembapan</h2><p className="mt-1 text-xs text-[#89968e]">Maksimal 50 pembacaan terakhir</p></div>
                      <div className="flex gap-4 text-[11px]"><span className="flex items-center gap-1.5 text-[#b7f36b]"><span className="h-2 w-2 rounded-full bg-[#b7f36b]" /> Suhu °C</span><span className="flex items-center gap-1.5 text-[#83c9ff]"><span className="h-2 w-2 rounded-full bg-[#83c9ff]" /> Kelembapan %</span></div>
                    </div>
                    <div className="mt-6 h-[250px]">
                      {chartData.length ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData} margin={{ top: 4, right: 6, left: -20, bottom: 0 }}>
                            <CartesianGrid stroke="rgba(255,255,255,0.07)" strokeDasharray="3 5" vertical={false} />
                            <XAxis dataKey="time" tick={{ fill: "#829087", fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={34} />
                            <YAxis tick={{ fill: "#829087", fontSize: 10 }} tickLine={false} axisLine={false} />
                            <Tooltip contentStyle={{ background: "#151d18", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontSize: 12 }} labelStyle={{ color: "#dce5de" }} />
                            <Line type="monotone" dataKey="suhu" name="Suhu °C" stroke="#b7f36b" strokeWidth={2} dot={false} connectNulls />
                            <Line type="monotone" dataKey="kelembapan" name="Kelembapan %" stroke="#83c9ff" strokeWidth={2} dot={false} connectNulls />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-xs text-[#89968e]">
                          <Activity size={22} className="text-[#617066]" /> Menunggu data pertama dari ESP32
                        </div>
                      )}
                    </div>
                  </article>

                  <article className="rounded-2xl border border-white/[0.08] bg-[#101714]/90 p-5 sm:p-6">
                    <div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold">Status sensor</h2><p className="mt-1 text-xs text-[#89968e]">Kondisi pembacaan terakhir</p></div><Gauge size={18} className="text-[#87948b]" /></div>
                    <div className="mt-5 space-y-3">
                      <div className="flex items-center justify-between rounded-xl bg-white/[0.025] px-3.5 py-3"><span className="flex items-center gap-2.5 text-xs text-[#c3cdc6]"><Vibrate size={15} className="text-[#b7f36b]" /> Sensor getaran</span><StatusPill active={latest?.vibrationDetected ?? false} onText="GETARAN" offText="NORMAL" /></div>
                      <div className="flex items-center justify-between rounded-xl bg-white/[0.025] px-3.5 py-3"><span className="flex items-center gap-2.5 text-xs text-[#c3cdc6]"><CloudRain size={15} className="text-[#83c9ff]" /> Deteksi banjir</span><StatusPill active={latest?.floodDetected ?? false} onText="TERDETEKSI" offText="NORMAL" /></div>
                      <div className="flex items-center justify-between rounded-xl bg-white/[0.025] px-3.5 py-3"><span className="flex items-center gap-2.5 text-xs text-[#c3cdc6]"><Lightbulb size={15} className="text-[#f7d879]" /> Lampu jalan</span><StatusPill active={latest?.streetLightOn ?? false} onText="MENYALA" offText="MATI" /></div>
                      <div className="flex items-center justify-between rounded-xl bg-white/[0.025] px-3.5 py-3"><span className="flex items-center gap-2.5 text-xs text-[#c3cdc6]"><Activity size={15} className="text-[#d3b8ff]" /> Gerakan PIR</span><StatusPill active={latest?.pirDetected ?? false} onText="TERDETEKSI" offText="NORMAL" /></div>
                    </div>
                    <div className="mt-5 flex items-center justify-between border-t border-white/[0.07] pt-4"><span className="text-xs text-[#89968e]">LED RGB · GPIO19</span><StatusPill active={rgbLedOn} onText="MENYALA" offText="MATI" /></div>
                  </article>
                </div>

                <article className="mt-5 rounded-2xl border border-white/[0.08] bg-[#101714]/90 p-5 sm:p-6">
                  <div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold">Ketersediaan slot parkir</h2><p className="mt-1 text-xs text-[#89968e]">Sensor IR pada masing-masing slot</p></div><span className="text-xs text-[#aeb9b1]">{occupied} / 3 terisi</span></div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    {slots.map((slot) => (
                      <div key={slot.name} className={`flex items-center justify-between rounded-xl border px-4 py-3.5 ${slot.occupied ? "border-[#f5a76e]/15 bg-[#f5a76e]/[0.04]" : "border-[#b7f36b]/10 bg-[#b7f36b]/[0.035]"}`}>
                        <div className="flex items-center gap-3"><span className={`h-2.5 w-2.5 rounded-full ${slot.occupied ? "bg-[#f5a76e]" : "bg-[#b7f36b]"}`} /><span className="text-sm">{slot.name}</span></div>
                        <span className={`text-xs ${slot.occupied ? "text-[#f5b586]" : "text-[#b7f36b]"}`}>{slot.occupied ? "Terisi" : "Kosong"}</span>
                      </div>
                    ))}
                  </div>
                </article>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 px-1 text-[11px] text-[#7f8c83]">
                  <span className="flex items-center gap-2"><RefreshCw size={12} /> Sinkronisasi otomatis setiap 1,5 detik</span>
                  <span className="flex items-center gap-1">Maksimum 50 data tersimpan di MongoDB <ArrowDown size={12} /></span>
                </div>
              </>
            ) : page === "control" ? (
              <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
                <article className="rounded-2xl border border-white/[0.08] bg-[#101714]/90 p-6 sm:p-8">
                  <div className="flex items-center gap-3">
                    <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${rgbLedOn ? "bg-[#b7f36b]/15 text-[#c5f78b]" : "bg-white/[0.06] text-[#9aa69e]"}`}><Lightbulb size={23} /></span>
                    <div><h2 className="text-base font-semibold">Lampu RGB · GPIO19</h2><p className="mt-1 text-xs text-[#89968e]">LED biru pada modul RGB ESP32</p></div>
                  </div>
                  <div className="my-9 flex flex-col items-center rounded-2xl border border-white/[0.06] bg-[#0b100d] px-5 py-10">
                    <span className={`relative flex h-28 w-28 items-center justify-center rounded-full border ${rgbLedOn ? "border-[#b7f36b]/40 bg-[#b7f36b]/[0.12] shadow-[0_0_70px_rgba(183,243,107,0.16)]" : "border-white/[0.08] bg-white/[0.025]"}`}>
                      <Lightbulb size={42} strokeWidth={1.2} className={rgbLedOn ? "text-[#c9ff8c]" : "text-[#59645c]"} />
                      {rgbLedOn && <span className="absolute inset-[-10px] rounded-full border border-[#b7f36b]/10" />}
                    </span>
                    <p className="mt-6 text-lg font-semibold">{rgbLedOn ? "Lampu menyala" : "Lampu mati"}</p>
                    <p className="mt-1 text-xs text-[#87948b]">{rgbLedOn ? "GPIO19 berada pada kondisi HIGH" : "GPIO19 berada pada kondisi LOW"}</p>
                    <button
                      onClick={() => void toggleLight()}
                      disabled={loadingCommand}
                      className={`mt-7 flex min-w-[180px] items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition disabled:cursor-wait disabled:opacity-60 ${rgbLedOn ? "border border-white/[0.12] bg-white/[0.06] text-white hover:bg-white/[0.1]" : "bg-[#b7f36b] text-[#17200f] hover:bg-[#c7fa8a]"}`}
                    >
                      {loadingCommand ? <LoaderCircle size={16} className="animate-spin" /> : rgbLedOn ? <Check size={16} /> : <Lightbulb size={16} />}
                      {loadingCommand ? "Mengirim perintah..." : rgbLedOn ? "Matikan lampu" : "Nyalakan lampu"}
                    </button>
                  </div>
                  <p className="text-center text-[11px] leading-5 text-[#7f8c83]">Perintah diteruskan melalui API. ESP32 memeriksa perintah secara berkala dan memperbarui pin GPIO19.</p>
                </article>

                <div className="space-y-5">
                  <article className="rounded-2xl border border-white/[0.08] bg-[#101714]/90 p-5">
                    <h2 className="text-sm font-semibold">Status perangkat</h2>
                    <div className="mt-4 flex items-center justify-between rounded-xl bg-white/[0.025] p-4">
                      <div className="flex items-center gap-3"><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${online ? "bg-[#b7f36b]/10 text-[#b7f36b]" : "bg-white/[0.05] text-[#89968e]"}`}><Radio size={17} /></span><div><p className="text-xs font-medium">ESP32 Smart City</p><p className="mt-1 text-[10px] text-[#849188]">esp32-smart-city</p></div></div>
                      <StatusPill active={online && Boolean(latest)} onText="ONLINE" offText="OFFLINE" />
                    </div>
                    <div className="mt-4 space-y-3 text-xs">
                      <div className="flex justify-between"><span className="text-[#89968e]">Pin output</span><span className="text-[#d4ddd6]">GPIO19 · LED biru</span></div>
                      <div className="flex justify-between"><span className="text-[#89968e]">Terakhir menerima data</span><span className="text-[#d4ddd6]">{latest ? formatTime(latest.recordedAt) : "--"}</span></div>
                    </div>
                  </article>
                  <article className="rounded-2xl border border-[#b7f36b]/10 bg-[#b7f36b]/[0.035] p-5">
                    <div className="flex items-center gap-2 text-sm font-medium text-[#d5f8b3]"><Wifi size={16} /> Cara kerja kontrol</div>
                    <ol className="mt-4 space-y-3 text-xs leading-5 text-[#a0afa2]">
                      <li className="flex gap-2"><span className="text-[#b7f36b]">01</span> Dashboard menyimpan perintah ON/OFF ke MongoDB.</li>
                      <li className="flex gap-2"><span className="text-[#b7f36b]">02</span> ESP32 memeriksa API dan membaca perintah terbaru.</li>
                      <li className="flex gap-2"><span className="text-[#b7f36b]">03</span> Perubahan diterapkan pada pin LED GPIO19.</li>
                    </ol>
                  </article>
                  <button onClick={() => setPage("dashboard")} className="flex w-full items-center justify-between rounded-xl border border-white/[0.08] px-4 py-3 text-xs text-[#aeb9b1] transition hover:bg-white/[0.04]">
                    Kembali ke data dashboard <ArrowUpRight size={14} />
                  </button>
                </div>
              </div>
            ) : page === "messages" ? (
              <article className="rounded-2xl border border-white/[0.08] bg-[#101714]/90 p-5 sm:p-6">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold">Inbox peringatan sensor</h2>
                    <p className="mt-1 text-xs text-[#89968e]">
                      Pesan dibuat saat sensor berubah menjadi kondisi peringatan.
                    </p>
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={() => void markAllMessagesRead()}
                      className="flex items-center gap-2 rounded-lg border border-white/[0.09] px-3 py-2 text-xs text-[#c2ccc5] hover:bg-white/[0.05]"
                    >
                      <CheckCheck size={14} /> Tandai semua dibaca
                    </button>
                  )}
                </div>
                {messages.length === 0 ? (
                  <div className="flex min-h-52 flex-col items-center justify-center gap-3 text-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.04] text-[#829087]">
                      <MessageSquare size={21} />
                    </span>
                    <p className="text-sm text-[#c3cdc6]">Belum ada pesan sensor</p>
                    <p className="max-w-sm text-xs leading-5 text-[#849188]">
                      Peringatan banjir, getaran, gerakan, suhu tinggi, dan parkir penuh akan muncul di sini saat terdeteksi.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {messages.map((message) => {
                      const severityClass =
                        message.severity === "critical"
                          ? "border-[#ff896f]/20 bg-[#ff896f]/[0.045]"
                          : message.severity === "warning"
                            ? "border-[#f5b586]/15 bg-[#f5b586]/[0.035]"
                            : "border-white/[0.07] bg-white/[0.02]";
                      return (
                        <article
                          key={message._id}
                          className={`flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-start ${severityClass} ${message.isRead ? "opacity-70" : ""}`}
                        >
                          <span className={`mt-0.5 ${message.severity === "critical" ? "text-[#ff896f]" : message.severity === "warning" ? "text-[#f5b586]" : "text-[#b7f36b]"}`}>
                            <ShieldAlert size={18} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-sm font-medium text-[#eef4ef]">{message.title}</h3>
                              {!message.isRead && <span className="h-2 w-2 rounded-full bg-[#f45f57]" title="Belum dibaca" />}
                              <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[#98a49d]">{message.severity}</span>
                            </div>
                            <p className="mt-1.5 text-xs leading-5 text-[#a5b0a8]">{message.body}</p>
                            <p className="mt-2 text-[10px] text-[#758279]">{new Date(message.occurredAt).toLocaleString("id-ID")}</p>
                          </div>
                          {!message.isRead && (
                            <button
                              onClick={() => void markMessageRead(message._id)}
                              className="self-start rounded-lg border border-white/[0.1] px-3 py-2 text-xs text-[#c7fa8f] hover:bg-white/[0.05]"
                            >
                              Tandai dibaca
                            </button>
                          )}
                        </article>
                      );
                    })}
                  </div>
                )}
              </article>
            ) : (
              <div className="grid gap-5 xl:grid-cols-[1.4fr_0.8fr]">
                <article className="flex min-h-[560px] flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#101714]/90">
                  <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#b7f36b]/10 text-[#b7f36b]"><Bot size={20} /></span>
                      <div><h2 className="text-sm font-semibold">AI Monitoring ESP32</h2><p className="mt-1 text-[11px] text-[#89968e]">Konteks sensor terbaru dari MongoDB</p></div>
                    </div>
                    <span className="rounded-full border border-[#b7f36b]/15 bg-[#b7f36b]/[0.06] px-2.5 py-1 text-[10px] text-[#c7fa8f]">OpenRouter · Free</span>
                  </div>
                  <div className="flex-1 space-y-4 overflow-y-auto p-5">
                    {chatEntries.length === 0 && (
                      <div className="mx-auto mt-10 max-w-md text-center">
                        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.04] text-[#b7f36b]"><MessageCircle size={22} /></span>
                        <h3 className="mt-4 text-sm font-medium">Tanyakan kondisi perangkat</h3>
                        <p className="mt-2 text-xs leading-5 text-[#89968e]">AI memahami pin, sensor, ambang, dan data ESP32. Snapshot terbaru dibaca dari server setiap kali Anda bertanya.</p>
                        <div className="mt-5 flex flex-wrap justify-center gap-2">
                          {["Bagaimana kondisi sensor sekarang?", "Apakah ada peringatan banjir?", "Slot parkir mana yang kosong?"].map((suggestion) => (
                            <button key={suggestion} onClick={() => setChatInput(suggestion)} className="rounded-full border border-white/[0.08] px-3 py-2 text-[11px] text-[#aab5ad] hover:bg-white/[0.04]">{suggestion}</button>
                          ))}
                        </div>
                      </div>
                    )}
                    {chatEntries.map((entry, index) => (
                      <div key={`${entry.role}-${index}`} className={`flex ${entry.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${entry.role === "user" ? "bg-[#b7f36b] text-[#17200f]" : "border border-white/[0.07] bg-white/[0.035] text-[#dce5de]"}`}>
                          {entry.content}
                        </div>
                      </div>
                    ))}
                    {chatLoading && (
                      <div className="flex items-center gap-2 text-xs text-[#a4b09f]"><LoaderCircle size={15} className="animate-spin" /> Mengambil data sensor terbaru lalu bertanya ke model gratis...</div>
                    )}
                  </div>
                  {chatError && <p className="mx-5 mb-2 flex items-center gap-2 text-xs text-[#f3b58a]"><X size={14} /> {chatError}</p>}
                  <form onSubmit={sendChatMessage} className="border-t border-white/[0.07] p-4">
                    <div className="flex gap-2 rounded-xl border border-white/[0.1] bg-[#0b100d] p-2 focus-within:border-[#b7f36b]/35">
                      <input
                        value={chatInput}
                        onChange={(event) => setChatInput(event.target.value)}
                        maxLength={1500}
                        placeholder="Tanya tentang data sensor..."
                        className="min-w-0 flex-1 bg-transparent px-2 text-sm text-white outline-none placeholder:text-[#66736a]"
                        disabled={chatLoading}
                      />
                      <button type="submit" disabled={!chatInput.trim() || chatLoading} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#b7f36b] text-[#17200f] transition hover:bg-[#c7fa8a] disabled:cursor-not-allowed disabled:opacity-40" aria-label="Kirim pertanyaan">
                        {chatLoading ? <LoaderCircle size={16} className="animate-spin" /> : <Send size={16} />}
                      </button>
                    </div>
                    <p className="mt-2 px-1 text-[10px] text-[#718078]">Menggunakan router model gratis OpenRouter. Model gratis bisa mengalami batas penggunaan.</p>
                  </form>
                </article>
                <div className="space-y-5">
                  <article className="rounded-2xl border border-white/[0.08] bg-[#101714]/90 p-5">
                    <div className="flex items-center gap-2 text-sm font-semibold"><Radio size={16} className="text-[#b7f36b]" /> Snapshot sensor</div>
                    <p className="mt-2 text-xs leading-5 text-[#89968e]">Setiap pertanyaan mengambil 5 pembacaan terbaru langsung dari database sebelum dikirim ke AI.</p>
                    <div className="mt-4 space-y-3">
                      {[
                        ["Suhu", latest?.temperatureC == null ? "--" : `${latest.temperatureC.toFixed(1)} °C`],
                        ["Kelembapan", latest?.humidityPercent == null ? "--" : `${latest.humidityPercent.toFixed(0)} %`],
                        ["Slot terisi", `${latest?.parking.occupied ?? 0} / 3`],
                        ["Level air", latest ? `${latest.waterLevelRaw} ADC` : "--"],
                        ["Update diterima", latest ? formatTime(latest.recordedAt) : "Belum ada data"],
                      ].map(([label, value]) => (
                        <div key={label} className="flex justify-between gap-3 border-b border-white/[0.05] pb-2 text-xs last:border-0"><span className="text-[#89968e]">{label}</span><span className="text-right text-[#d4ddd6]">{value}</span></div>
                      ))}
                    </div>
                  </article>
                  <article className="rounded-2xl border border-[#b7f36b]/10 bg-[#b7f36b]/[0.035] p-5">
                    <div className="flex items-center gap-2 text-sm font-medium text-[#d5f8b3]"><CheckCheck size={16} /> Model dan biaya</div>
                    <p className="mt-3 text-xs leading-5 text-[#a0afa2]">Request hanya memakai <code className="text-[#d5f8b3]">openrouter/free</code>. Router ini memilih model gratis; tidak ada fallback ke model berbayar. Jika model gratis mencapai batas, chat menampilkan error untuk dicoba lagi.</p>
                    {chatSnapshot && (
                      <div className="mt-4 border-t border-white/[0.07] pt-3 text-[10px] leading-5 text-[#89968e]">
                        Model: {chatSnapshot.model}<br />
                        Snapshot dimuat: {new Date(chatSnapshot.refreshedAt).toLocaleTimeString("id-ID")}<br />
                        Waktu data: {chatSnapshot.readingAt ? new Date(chatSnapshot.readingAt).toLocaleTimeString("id-ID") : "belum ada pembacaan"}
                      </div>
                    )}
                  </article>
                </div>
              </div>
            )}
          </section>

          <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] px-5 py-4 text-[10px] text-[#68756c] sm:px-8">
            <span>NUSAIOT · SMART HOME &amp; CITY</span>
            <span>MongoDB · ESP32 · Next.js</span>
          </footer>
        </div>
      </div>
    </main>
  );
}
