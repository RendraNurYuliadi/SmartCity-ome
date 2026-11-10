"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  Activity,
  ArrowDown,
  Bot,
  CheckCheck,
  CarFront,
  Check,
  CheckCircle2,
  ChevronRight,
  CloudRain,
  Droplets,
  Gauge,
  Images,
  Lightbulb,
  LoaderCircle,
  Menu,
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
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { SensorReading } from "@/lib/mongodb";

type Reading = Omit<SensorReading, "recordedAt"> & {
  _id: string;
  recordedAt: string;
};
type Page = "dashboard" | "control" | "messages" | "chat" | "gallery";
type DeviceCommands = {
  rgbLedOn: boolean;
  streetLightOverride: boolean | null;
  temperatureServoOverride: boolean | null;
};
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

const pageArtwork: Record<Page, { image: string; kicker: string; description: string }> = {
  dashboard: {
    image: "/images/dashboard-scene.svg",
    kicker: "Smart City · Live overview",
    description: "Sensor, akses, dan kondisi kawasan dalam satu pandangan.",
  },
  control: {
    image: "/images/control-scene.svg",
    kicker: "ESP32 · Device control",
    description: "Pilih otomatis dari sensor atau ambil kendali dari web.",
  },
  messages: {
    image: "/images/messages-scene.svg",
    kicker: "Sensor · Alert center",
    description: "Peringatan membantu Anda merespons perubahan kondisi lebih cepat.",
  },
  chat: {
    image: "/images/chat-scene.svg",
    kicker: "AI · Sensor assistant",
    description: "Tanyakan kondisi terkini perangkat dan sensor ESP32.",
  },
  gallery: {
    image: "/images/dashboard-scene.svg",
    kicker: "NOVENTRA · Project gallery",
    description: "Dokumentasi prototipe Smart Home & City dan tim Kelompok 3.",
  },
};

const teamMembers = [
  {
    name: "Amelia Puji Lestari",
    image: "/images/ourTeam/Amelia Puji Lestari.jpeg",
    alt: "Foto anggota tim Amelia Puji Lestari",
  },
  {
    name: "Herliana Tri Cahyanti",
    image: "/images/ourTeam/Herliana Tri Cahyanti.jpeg",
    alt: "Foto anggota tim Herliana Tri Cahyanti",
  },
  {
    name: "Rendra Nur Yuliadi",
    image: "/images/ourTeam/Rendra Nur Yuliadi.jpg",
    alt: "Foto anggota tim Rendra Nur Yuliadi",
  },
  {
    name: "Wulan Nurfitriani",
    image: "/images/ourTeam/Wulan Nurfitriani.jpeg",
    alt: "Foto anggota tim Wulan Nurfitriani",
  },
];

const projectImages = [
  {
    image: "/images/galeryProject/WhatsApp Image 2026-11-10 at 11.49.21.jpeg",
    title: "Marka dan koridor jalan",
    description:
      "Sudut miniatur memperlihatkan marka jalan berwarna cerah, rambu lalu lintas, serta lampu di tepi jalur. Elemen ini membangun konteks kawasan yang dipantau sebagai sebuah sistem kota, bukan sekadar rangkaian sensor terpisah.",
    alt: "Miniatur koridor jalan dengan marka dan rambu lalu lintas",
  },
  {
    image: "/images/galeryProject/WhatsApp Image 2026-11-10 at 11.49.24 (1).jpeg",
    title: "Indikator slot parkir",
    description:
      "Dokumentasi area parkir menampilkan penanda slot B dan C di samping modul berlampu. Pada implementasi, tiga sensor IR memantau okupansi setiap slot dan dashboard merangkum status terisi maupun tersedia.",
    alt: "Area miniatur parkir dengan penanda slot B dan C serta modul indikator",
  },
  {
    image: "/images/galeryProject/WhatsApp Image 2026-11-10 at 11.49.24.jpeg",
    title: "Persimpangan dari sisi kawasan",
    description:
      "Tampak lintasan dan persimpangan dari sudut rendah, dengan lampu lalu lintas, rambu, serta bangunan miniatur di sepanjang jalan. Susunan ini menunjukkan bagaimana beberapa titik aktivitas disatukan dalam satu prototipe Smart City.",
    alt: "Persimpangan miniatur dengan lampu lalu lintas dan bangunan",
  },
  {
    image: "/images/galeryProject/WhatsApp Image 2026-11-10 at 11.49.31.jpeg",
    title: "Lampu lalu lintas pada jalur utama",
    description:
      "Foto menyorot beberapa lampu sinyal yang ditempatkan di sepanjang ruas jalan model. Pada sistem, keluaran lampu lalu lintas berganti melalui fase hijau, kuning, dan merah secara berkala.",
    alt: "Lampu lalu lintas miniatur pada jalur utama prototipe",
  },
  {
    image: "/images/galeryProject/WhatsApp Image 2026-11-10 at 11.49.32.jpeg",
    title: "Tata letak jalur dan parkir",
    description:
      "Tampak atas memperlihatkan garis pembatas jalan dan area dengan label slot parkir. Tata letak ini membantu menjelaskan hubungan antara jalur kendaraan, titik parkir, dan pembacaan sensor IR yang dikirim ke dashboard.",
    alt: "Tata letak miniatur jalan dan area parkir berlabel",
  },
  {
    image: "/images/galeryProject/WhatsApp Image 2026-11-10 at 11.49.33.jpeg",
    title: "Rangkaian kawasan dan simpang",
    description:
      "Sudut pandang lebar memperlihatkan beberapa ruas yang bertemu, lampu sinyal, marka, dan elemen lanskap dalam satu maket. Proyek menghubungkan gambaran fisik ini dengan monitoring sensor dan kendali perangkat melalui web.",
    alt: "Pemandangan lebar maket kawasan dengan persimpangan dan lampu",
  },
  {
    image: "/images/galeryProject/WhatsApp Image 2026-11-10 at 11.49.34 (1).jpeg",
    title: "Detail ruang hijau kota",
    description:
      "Dokumentasi dekat menampilkan pohon dan area hijau yang menjadi bagian dari lingkungan maket. Detail lanskap melengkapi konteks rumah dan jalan pada simulasi Smart Home & City.",
    alt: "Detail pohon dan ruang hijau pada maket kota",
  },
  {
    image: "/images/galeryProject/WhatsApp Image 2026-11-10 at 11.49.34 (2).jpeg",
    title: "Bangunan dan akses kawasan",
    description:
      "Foto horizontal menangkap beberapa bangunan miniatur, jalan penghubung, dan area biru di bagian depan. Komposisi tersebut memperlihatkan skala kawasan serta jalur yang menghubungkan tiap bagian maket.",
    alt: "Bangunan miniatur dan akses jalan pada kawasan Smart City",
  },
  {
    image: "/images/galeryProject/WhatsApp Image 2026-11-10 at 11.49.34.jpeg",
    title: "Perspektif lengkap lintasan kota",
    description:
      "Tampak menyeluruh dari sisi lain memperlihatkan jaringan jalan, persimpangan, bangunan, dan penanda kawasan. Dokumentasi ini menjadi penutup rangkaian foto untuk melihat maket sebagai satu kesatuan.",
    alt: "Perspektif menyeluruh maket lintasan dan persimpangan kota",
  },
];

function GalleryContent() {
  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl border border-[#b7f36b]/15 bg-[linear-gradient(125deg,rgba(183,243,107,0.09),rgba(16,23,20,0.96)_52%,rgba(131,201,255,0.07))] p-6 sm:p-8">
        <div className="absolute -right-10 -top-20 h-64 w-64 rounded-full bg-[#b7f36b]/[0.07] blur-3xl" />
        <div className="relative grid gap-8 xl:grid-cols-[1.3fr_0.7fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-[#b7f36b]/20 bg-[#b7f36b]/[0.07] px-3 py-1.5 text-[10px] font-medium tracking-[0.12em] text-[#c7fa8f]">
              <Activity size={13} /> PROYEK IOT · KELOMPOK 3
            </span>
            <h2 className="mt-5 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              NOVEN<span className="text-[#b7f36b]">TRA</span>
            </h2>
            <p className="mt-2 text-sm font-medium text-[#dce5de]">
              Smart Home &amp; City Monitoring System
            </p>
            <p className="mt-5 max-w-3xl text-sm leading-7 text-[#aab5ad]">
              Noventra menggabungkan prototipe kawasan kota dengan sensor dan
              aktuator berbasis ESP32. Data suhu dan kelembapan, kondisi parkir,
              gerakan, intensitas cahaya, jarak, level air, serta getaran
              dikumpulkan untuk membantu pengguna memahami keadaan perangkat
              dan lingkungan. Informasi disajikan dalam dashboard web, sementara
              beberapa output dapat berjalan otomatis berdasarkan sensor atau
              dipilih melalui menu kontrol.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {["ESP32", "IoT Monitoring", "Sensor & Aktuator", "Dashboard Web"].map((item) => (
                <span key={item} className="rounded-full border border-white/[0.08] bg-black/10 px-3 py-1.5 text-[10px] text-[#bdc8c0]">
                  {item}
                </span>
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            {[
              {
                title: "Pantau",
                detail: "DHT11, ultrasonik, PIR, IR parkir, LDR, sensor air, dan SW-420.",
                icon: Gauge,
              },
              {
                title: "Otomatiskan",
                detail: "Lampu jalan, palang servo, lampu lalu lintas, dan alarm merespons sistem sensor.",
                icon: Radio,
              },
              {
                title: "Kendalikan",
                detail: "Dashboard menyediakan status perangkat dan pilihan kontrol web untuk output terpilih.",
                icon: Lightbulb,
              },
            ].map(({ title, detail, icon: Icon }) => (
              <article key={title} className="flex gap-3 rounded-2xl border border-white/[0.07] bg-[#0b110e]/55 p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#b7f36b]/10 text-[#b7f36b]">
                  <Icon size={17} />
                </span>
                <div>
                  <h3 className="text-xs font-semibold text-[#e5eee7]">{title}</h3>
                  <p className="mt-1 text-[10px] leading-5 text-[#95a198]">{detail}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.18em] text-[#9daa9f]">DOKUMENTASI</p>
            <h2 className="mt-1 text-xl font-semibold">Galeri prototipe proyek</h2>
            <p className="mt-1 text-xs leading-5 text-[#89968e]">
              Sembilan foto maket: jalur, persimpangan, lampu, parkir, dan detail kawasan.
            </p>
          </div>
          <span className="rounded-full border border-white/[0.08] px-3 py-1.5 text-[10px] text-[#aab5ad]">
            {projectImages.length} foto dokumentasi
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
          {projectImages.map((item, index) => (
            <article
              key={item.image}
              className="group overflow-hidden rounded-2xl border border-white/[0.08] bg-[#101714]/90 transition duration-300 hover:-translate-y-1 hover:border-[#b7f36b]/25 hover:shadow-[0_18px_48px_rgba(0,0,0,0.25)]"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-[#0b110e]">
                <Image
                  src={item.image}
                  alt={item.alt}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
                  className="object-cover transition duration-500 group-hover:scale-[1.04]"
                />
                <span className="absolute left-3 top-3 rounded-full border border-white/10 bg-[#090e0c]/75 px-2.5 py-1 text-[9px] font-medium tracking-[0.1em] text-[#dce5de] backdrop-blur">
                  FOTO {String(index + 1).padStart(2, "0")}
                </span>
              </div>
              <div className="p-4 sm:p-5">
                <h3 className="text-sm font-semibold text-[#e8f0ea]">{item.title}</h3>
                <p className="mt-2 text-xs leading-6 text-[#98a49d]">{item.description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4">
          <p className="text-[10px] font-semibold tracking-[0.18em] text-[#9daa9f]">DI BALIK NOVENTRA</p>
          <h2 className="mt-1 text-xl font-semibold">Anggota Kelompok 3</h2>
          <p className="mt-1 text-xs leading-5 text-[#89968e]">
            Tim pengembang proyek IoT Noventra · Fakultas Teknik Informasi.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {teamMembers.map((member, index) => (
            <article
              key={member.name}
              className="group overflow-hidden rounded-2xl border border-white/[0.08] bg-[#101714]/90 transition hover:border-[#b7f36b]/25"
            >
              <div className="relative aspect-[4/4.3] overflow-hidden bg-[#18221b]">
                <Image
                  src={member.image}
                  alt={member.alt}
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 25vw"
                  className="object-cover transition duration-500 group-hover:scale-[1.04]"
                />
                <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#090e0c]/90 to-transparent" />
                <span className="absolute bottom-3 left-4 text-[9px] font-medium tracking-[0.16em] text-[#c7fa8f]">
                  NOVENTRA · 0{index + 1}
                </span>
              </div>
              <div className="p-4">
                <h3 className="text-sm font-semibold text-[#e8f0ea]">{member.name}</h3>
                <p className="mt-1 text-[10px] text-[#89968e]">Anggota Kelompok 3</p>
              </div>
            </article>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] px-5 py-4">
          <div>
            <p className="text-xs font-semibold text-[#dce5de]">NOVENTRA · Proyek IoT Kelompok 3</p>
            <p className="mt-1 text-[10px] text-[#89968e]">Fakultas Teknik Informasi</p>
          </div>
          <span className="rounded-full border border-[#b7f36b]/15 bg-[#b7f36b]/[0.05] px-3 py-1.5 text-[10px] text-[#c7fa8f]">
            Smart Home &amp; City
          </span>
        </div>
      </section>
    </div>
  );
}

function PageArtwork({ page }: { page: Page }) {
  const artwork = pageArtwork[page];

  return (
    <article className="relative mb-6 min-h-[150px] overflow-hidden rounded-2xl border border-white/[0.09] bg-[#101714]">
      <Image
        src={artwork.image}
        alt=""
        fill
        sizes="(max-width: 768px) 100vw, 80vw"
        className="object-cover object-center opacity-75"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#0b110e] via-[#0b110e]/75 to-transparent" />
      <div className="relative flex min-h-[150px] max-w-xl flex-col justify-center p-5 sm:p-7">
        <p className="text-[10px] font-semibold tracking-[0.2em] text-[#c7fa8f]">{artwork.kicker}</p>
        <p className="mt-2 text-sm leading-6 text-[#dce5de] sm:text-base">{artwork.description}</p>
      </div>
    </article>
  );
}

function OverrideControl({
  value,
  disabled,
  onChange,
}: {
  value: boolean | null;
  disabled: boolean;
  onChange: (value: boolean | null) => void;
}) {
  const options: Array<{ label: string; value: boolean | null }> = [
    { label: "Otomatis", value: null },
    { label: "Web ON", value: true },
    { label: "Web OFF", value: false },
  ];

  return (
    <div className="grid grid-cols-3 gap-2" role="group" aria-label="Mode kontrol perangkat">
      {options.map((option) => (
        <button
          key={option.label}
          type="button"
          disabled={disabled}
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={`rounded-lg border px-2 py-2 text-[11px] font-medium transition disabled:cursor-wait disabled:opacity-60 ${
            value === option.value
              ? "border-[#b7f36b]/30 bg-[#b7f36b]/10 text-[#c7fa8f]"
              : "border-white/[0.07] bg-white/[0.02] text-[#98a49d] hover:bg-white/[0.06]"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

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
  const [deviceCommands, setDeviceCommands] = useState<DeviceCommands>({
    rgbLedOn: false,
    streetLightOverride: null,
    temperatureServoOverride: null,
  });
  const [loadingCommand, setLoadingCommand] = useState(false);
  const [online, setOnline] = useState(false);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [chatEntries, setChatEntries] = useState<ChatEntry[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const enteringDashboard = true;

  useEffect(() => {
    const timer = window.setTimeout(() => setShowSplash(false), 5000);
    return () => window.clearTimeout(timer);
  }, []);

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
      const commandData: DeviceCommands = await commandResponse.json();
      const messagesData: { messages: InboxMessage[]; unreadCount: number } =
        await messagesResponse.json();
      setReadings(readingsData.readings);
      setDeviceCommands(commandData);
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
  const temperatureServoOpen =
    latest?.temperatureServoOpen ??
    (deviceCommands.temperatureServoOverride ??
      (latest?.temperatureC != null && latest.temperatureC > 28));
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

  const updateDeviceCommands = async (updates: Partial<DeviceCommands>) => {
    setLoadingCommand(true);
    try {
      const response = await fetch("/api/commands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const result: DeviceCommands & { error?: string } = await response.json();
      if (!response.ok) throw new Error(result.error || "Perintah perangkat gagal dikirim.");
      setDeviceCommands(result);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal mengirim perintah.");
    } finally {
      setLoadingCommand(false);
    }
  };

  const rgbLedOn = deviceCommands.rgbLedOn;

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

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history }),
      });
      const result: {
        answer?: string;
        error?: string;
      } = await response.json();
      if (!response.ok || !result.answer) {
        throw new Error(result.error || "AI gagal menjawab.");
      }

      setChatEntries((current) => [
        ...current,
        { role: "assistant", content: result.answer! },
      ]);
      void refresh();
    } catch (cause) {
      setChatError(cause instanceof Error ? cause.message : "Gagal menghubungi AI.");
    } finally {
      setChatLoading(false);
    }
  };

  const selectPage = (nextPage: Page) => {
    setPage(nextPage);
    setMobileMenuOpen(false);
    if (nextPage === "messages") void refresh();
  };

  const occupied = latest?.parking.occupied ?? 0;
  const slots = [
    { name: "Slot A", occupied: latest?.parking.slotBOccupied ?? false },
    { name: "Slot B", occupied: latest?.parking.slotAOccupied ?? false },
    { name: "Slot C", occupied: latest?.parking.slotCOccupied ?? false },
  ];
  const pageTitle =
    page === "dashboard"
      ? "Data Dashboard"
      : page === "control"
        ? "Kontrol ESP32"
        : page === "gallery"
          ? "Galeri Noventra"
        : page === "messages"
          ? "Message"
          : "AI Sensor";

  return (
    <main className="grid-lines min-h-screen">
      {showSplash && (
        <section
          className="fixed inset-0 z-[100] flex min-h-screen items-center justify-center overflow-hidden bg-[#080d0a] px-5 py-10"
          aria-label="Selamat datang"
        >
          <div className="splash-grid pointer-events-none absolute inset-0" />
          <div className="splash-orb pointer-events-none absolute left-1/2 top-1/2 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#9fe85d]/[0.08] blur-[110px]" />
          <div className="relative w-full max-w-2xl animate-[splash-in_.7s_ease-out_both] rounded-[2rem] border border-white/[0.1] bg-[#0e1511]/90 p-7 shadow-[0_35px_120px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:p-12">
            <div className="flex items-center gap-3">
              <span className="splash-logo flex h-12 w-12 items-center justify-center rounded-2xl bg-[#b7f36b] text-[#11180e] shadow-[0_0_38px_rgba(183,243,107,0.2)]">
                <Activity size={25} strokeWidth={2.4} />
              </span>
              <div>
                <p className="text-sm font-semibold tracking-wide">NOVEN<span className="text-[#b7f36b]">TRA</span></p>
                <p className="mt-0.5 text-[10px] tracking-[0.2em] text-[#86948a]">SMART CITY SYSTEM</p>
              </div>
              <span className="ml-auto hidden items-center gap-2 rounded-full border border-[#b7f36b]/15 bg-[#b7f36b]/[0.05] px-3 py-1.5 text-[10px] text-[#c7fa8f] sm:flex">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#b7f36b]" /> LIVE MONITORING
              </span>
            </div>

            <div className="mt-12 max-w-xl">
              <p className="flex items-center gap-2 text-[11px] font-medium tracking-[0.22em] text-[#a5b497]">
                <span className="h-px w-6 bg-[#b7f36b]" /> SMART HOME &amp; CITY
              </p>
              <h1 className="mt-5 text-4xl font-semibold leading-[1.13] tracking-tight text-white sm:text-6xl">
                Kota lebih<br /><span className="text-[#b7f36b]">cerdas.</span> Data lebih<br className="hidden sm:block" /> dekat.
              </h1>
              <p className="mt-5 max-w-lg text-sm leading-7 text-[#9ba79e] sm:text-base">
                Pantau sensor, baca peringatan, dan kendalikan ESP32 dari satu dashboard—dengan bantuan AI untuk memahami kondisi perangkat.
              </p>
            </div>

            <div className="mt-9 grid gap-2 sm:grid-cols-3">
              {[
                { label: "Monitoring", value: "Data sensor realtime", icon: Radio },
                { label: "Notifikasi", value: "Peringatan perangkat", icon: MessageSquare },
                { label: "AI Assistant", value: "Analisis kondisi ESP32", icon: Bot },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="splash-feature rounded-xl border border-white/[0.07] bg-white/[0.025] p-3.5">
                  <Icon size={16} className="text-[#b7f36b]" />
                  <p className="mt-3 text-[10px] tracking-[0.12em] text-[#76837a]">{label}</p>
                  <p className="mt-1 text-xs font-medium text-[#dce5de]">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
              <span className="flex items-center gap-2 text-[11px] text-[#7d8a81]">
                {enteringDashboard ? (
                  <span id="dashboard-loading" role="status" aria-live="polite">
                    Dashboard akan terbuka dalam 5 detik
                  </span>
                ) : (
                  <><CheckCircle2 size={14} className="text-[#b7f36b}" /> Tanpa login · ESP32 terhubung</>
                )}
              </span>
            </div>
            {enteringDashboard && (
              <div
                className="mt-5 h-1 overflow-hidden rounded-full bg-white/10"
                role="progressbar"
                aria-label="Menyiapkan dashboard"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuetext="Menyiapkan dashboard selama 5 detik"
              >
                <div className="h-full w-full origin-left animate-[dashboard-loading_5s_linear_forwards] rounded-full bg-[#b7f36b]" />
              </div>
            )}
          </div>
          <style jsx>{`@keyframes splash-in { from { opacity: 0; transform: translateY(14px) scale(.985); } to { opacity: 1; transform: translateY(0) scale(1); } }`}</style>
        </section>
      )}
      <div className="flex min-h-screen w-full">
        {mobileMenuOpen && (
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/65 backdrop-blur-sm lg:hidden"
            aria-label="Tutup menu"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}
        <aside className={`sidebar-drawer fixed inset-y-0 left-0 z-50 flex h-screen w-[280px] shrink-0 flex-col border-r border-white/[0.07] bg-[#0b110e] px-5 py-7 lg:sticky lg:top-0 lg:z-20 lg:w-[248px] ${mobileMenuOpen ? "is-open" : ""}`}>
          <a className="flex items-center gap-3 px-2" href="#" onClick={() => selectPage("dashboard")}>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#b7f36b] text-[#121a10]">
              <Activity size={21} strokeWidth={2.5} />
            </span>
            <span>
              <span className="block text-sm font-semibold tracking-wide">NOVEN<span className="text-[#b7f36b]">TRA</span></span>
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
            <button
              onClick={() => selectPage("gallery")}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${
                page === "gallery" ? "bg-[#b7f36b]/10 font-medium text-[#c7fa8f]" : "text-[#9ba79f] hover:bg-white/[0.04]"
              }`}
            >
              <Images size={18} /> Galeri Noventra
              {page === "gallery" && <ChevronRight className="ml-auto" size={15} />}
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

        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex min-h-[76px] items-center justify-between border-b border-white/[0.07] bg-[#090e0c]/85 px-4 backdrop-blur-xl sm:px-8">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] text-[#b8c4bb] hover:bg-white/[0.05] lg:hidden"
                aria-label="Buka menu"
              >
                <Menu size={18} />
              </button>
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

          <section className={`px-5 py-7 sm:px-8 sm:py-9 ${page === "chat" ? "flex flex-1 flex-col" : ""}`}>
            <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-medium tracking-[0.16em] text-[#9daa9f]">{page === "messages" ? "PUSAT NOTIFIKASI" : page === "chat" ? "ASISTEN SENSOR" : page === "gallery" ? "CERITA PROYEK" : "MONITORING PERANGKAT"}</p>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-[30px]">
                  {page === "dashboard" ? <>Kondisi <span className="text-[#b7f36b]">saat ini</span></> : page === "control" ? <>Kontrol <span className="text-[#b7f36b]">perangkat</span></> : page === "messages" ? <>Pesan <span className="text-[#b7f36b]">sensor</span></> : page === "gallery" ? <>Galeri <span className="text-[#b7f36b]">Noventra</span></> : <>Chatbot <span className="text-[#b7f36b]">Gen AI</span></>}
                </h1>
                <p className="mt-2 text-sm text-[#8d9a91]">
                  {page === "dashboard" ? "Ringkasan sensor dan aktivitas ESP32 secara realtime." : page === "control" ? "Kendalikan LED RGB, lampu jalan LDR, dan servo suhu DHT11." : page === "messages" ? "Baca dan kelola peringatan yang dikirim dari sensor ESP32." : page === "gallery" ? "Kenali visi proyek, dokumentasi maket, dan anggota tim Kelompok 3." : "Tanya kondisi ESP32; data terbaru dibaca langsung sebelum AI menjawab."}
                </p>
              </div>
              <button onClick={() => void refresh()} className="flex items-center gap-2 rounded-xl border border-white/[0.1] px-3.5 py-2.5 text-xs text-[#c2ccc5] transition hover:bg-white/[0.05]">
                <RefreshCw size={14} /> Perbarui data
              </button>
            </div>

            <PageArtwork page={page} />

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
              <div className="grid gap-5 xl:grid-cols-3">
                <article className="rounded-2xl border border-white/[0.08] bg-[#101714]/90 p-5 sm:p-6">
                  <div className="flex items-center gap-3">
                    <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${rgbLedOn ? "bg-[#b7f36b]/15 text-[#c5f78b]" : "bg-white/[0.06] text-[#9aa69e]"}`}><Lightbulb size={21} /></span>
                    <div><h2 className="text-sm font-semibold">Lampu RGB</h2><p className="mt-1 text-[11px] text-[#89968e]">LED biru · GPIO19</p></div>
                  </div>
                  <div className="my-6 flex items-center gap-4 rounded-xl border border-white/[0.06] bg-[#0b100d] p-4">
                    <span className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full border ${rgbLedOn ? "border-[#b7f36b]/40 bg-[#b7f36b]/[0.12] text-[#c9ff8c]" : "border-white/[0.08] bg-white/[0.025] text-[#59645c]"}`}><Lightbulb size={30} strokeWidth={1.2} /></span>
                    <div><p className="text-sm font-semibold">{rgbLedOn ? "Lampu menyala" : "Lampu mati"}</p><p className="mt-1 text-[11px] text-[#87948b]">Kontrol langsung dari web</p></div>
                  </div>
                  <button
                    onClick={() => void updateDeviceCommands({ rgbLedOn: !rgbLedOn })}
                    disabled={loadingCommand}
                    className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-semibold transition disabled:cursor-wait disabled:opacity-60 ${rgbLedOn ? "border border-white/[0.12] bg-white/[0.06] text-white hover:bg-white/[0.1]" : "bg-[#b7f36b] text-[#17200f] hover:bg-[#c7fa8a]"}`}
                  >
                    {loadingCommand ? <LoaderCircle size={15} className="animate-spin" /> : rgbLedOn ? <Check size={15} /> : <Lightbulb size={15} />}
                    {rgbLedOn ? "Matikan RGB" : "Nyalakan RGB"}
                  </button>
                </article>

                <article className="rounded-2xl border border-white/[0.08] bg-[#101714]/90 p-5 sm:p-6">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f7d879]/10 text-[#f7d879]"><Lightbulb size={21} /></span>
                    <div><h2 className="text-sm font-semibold">Lampu jalan</h2><p className="mt-1 text-[11px] text-[#89968e]">LDR · GPIO34 / LED GPIO26</p></div>
                  </div>
                  <div className="my-6 flex items-center justify-between rounded-xl border border-white/[0.06] bg-[#0b100d] p-4">
                    <div><p className="text-sm font-semibold">{latest?.streetLightOn ? "Lampu menyala" : "Lampu mati"}</p><p className="mt-1 text-[11px] text-[#87948b]">LDR {latest?.ldrRaw ?? "--"} · {deviceCommands.streetLightOverride === null ? "otomatis" : "kontrol web"}</p></div>
                    <StatusPill active={latest?.streetLightOn ?? false} onText="ON" offText="OFF" />
                  </div>
                  <OverrideControl
                    value={deviceCommands.streetLightOverride}
                    disabled={loadingCommand}
                    onChange={(value) => void updateDeviceCommands({ streetLightOverride: value })}
                  />
                  <p className="mt-3 text-[10px] leading-5 text-[#7f8c83]">LDR tetap bekerja di mode otomatis. Jika kondisi LDR memicu lampu, override web diterapkan setelah 10 detik.</p>
                </article>

                <article className="rounded-2xl border border-white/[0.08] bg-[#101714]/90 p-5 sm:p-6">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#83c9ff]/10 text-[#83c9ff]"><Gauge size={21} /></span>
                    <div><h2 className="text-sm font-semibold">Servo suhu</h2><p className="mt-1 text-[11px] text-[#89968e]">DHT11 · GPIO4 / servo GPIO23</p></div>
                  </div>
                  <div className="my-6 flex items-center justify-between rounded-xl border border-white/[0.06] bg-[#0b100d] p-4">
                    <div><p className="text-sm font-semibold">{temperatureServoOpen ? "Servo terbuka" : "Servo tertutup"}</p><p className="mt-1 text-[11px] text-[#87948b]">Suhu {latest?.temperatureC == null ? "--" : `${latest.temperatureC.toFixed(1)} °C`} · {deviceCommands.temperatureServoOverride === null ? "otomatis" : "kontrol web"}</p></div>
                    <StatusPill active={temperatureServoOpen} onText="BUKA" offText="TUTUP" />
                  </div>
                  <OverrideControl
                    value={deviceCommands.temperatureServoOverride}
                    disabled={loadingCommand}
                    onChange={(value) => void updateDeviceCommands({ temperatureServoOverride: value })}
                  />
                  <p className="mt-3 text-[10px] leading-5 text-[#7f8c83]">DHT11 tetap mengatur servo di mode otomatis. Jika suhu di atas 28 °C, override web diterapkan setelah 10 detik.</p>
                </article>
              </div>
            ) : page === "gallery" ? (
              <GalleryContent />
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
              <div className="flex min-h-0 flex-1 flex-col gap-5">
                <article className="flex min-h-[420px] flex-1 flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#101714]/90">
                  <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#b7f36b]/10 text-[#b7f36b]"><Bot size={20} /></span>
                      <div><h2 className="text-sm font-semibold">AI Monitoring ESP32</h2><p className="mt-1 text-[11px] text-[#89968e]">Konteks sensor terbaru dari MongoDB</p></div>
                    </div>
                    <span className="rounded-full border border-[#b7f36b]/15 bg-[#b7f36b]/[0.06] px-2.5 py-1 text-[10px] text-[#c7fa8f]">OpenRouter · Free</span>
                  </div>
                  <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
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
                        <div className={`max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-6 ${entry.role === "user" ? "whitespace-pre-wrap bg-[#b7f36b] text-[#17200f]" : "chat-markdown border border-white/[0.07] bg-white/[0.035] text-[#dce5de]"}`}>
                          {entry.role === "assistant" ? (
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{entry.content}</ReactMarkdown>
                          ) : entry.content}
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
              </div>
            )}
          </section>

          <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] px-5 py-4 text-[10px] text-[#68756c] sm:px-8">
            <span>NOVENTRA · SMART HOME &amp; CITY</span>
            <span>MongoDB · ESP32 · Next.js</span>
          </footer>
        </div>
      </div>
    </main>
  );
}
