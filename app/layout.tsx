import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kbin IPTV — Watch Live TV from Around the World",
  description:
    "Browse and stream thousands of free, publicly available IPTV channels from across the globe. Powered by the iptv-org community database.",
  keywords: ["IPTV", "live TV", "streaming", "channels", "free TV"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
