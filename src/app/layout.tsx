import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Smart City | IoT Dashboard",
  description: "Pemantauan realtime sensor dan kontrol perangkat ESP32.",
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
