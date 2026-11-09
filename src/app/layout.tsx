import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Noventra | IoT Dashboard",
  description: "Pemantauan realtime sensor dan kontrol perangkat ESP32.",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
