import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "2026",
  description: "See the fireworks light up the night sky as we welcome the new year!",
  keywords: ["New Year", "Fireworks", "Countdown", "2026", "Celebration", "new year 2026", "countdown", "fireworks", "celebration", "happy new year", "new year's eve"],
  authors: [{ name: "Harry Ruiz", url: "https://harryruiz.com" }],
  creator: "Harry Ruiz",
  publisher: "Harry Ruiz",
  metadataBase: new URL('https://2026.harryruiz.com'),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
