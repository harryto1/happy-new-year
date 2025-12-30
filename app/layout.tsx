import type { Metadata } from "next";
import { Geist, Geist_Mono, Dancing_Script } from "next/font/google";
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

const dancingScript = Dancing_Script({
  variable: "--font-dancing-script",
  subsets: ["latin"],
  weight: ["700"],
  display: 'swap',
});

export const metadata: Metadata = {
  title: "2026",
  description: "See the fireworks light up the night sky as we welcome the new year!",
  keywords: ["New Year", "Fireworks", "Countdown", "2026", "Celebration", "new year 2026", "countdown", "fireworks", "celebration", "happy new year", "new year's eve"],
  authors: [{ name: "Harry Ruiz", url: "https://harryruiz.com" }],
  creator: "Harry Ruiz",
  publisher: "Harry Ruiz",
  metadataBase: new URL('https://2026.harryruiz.com'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://2026.harryruiz.com',
    title: '2026',
    description: 'See the fireworks light up the night sky as we welcome the new year!',
    siteName: '2026',
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: '2026 - Happy New Year',
        type: 'image/png',
      }
    ]
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    }
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#000000" />
        <link rel="canonical" href="https://2026.harryruiz.com" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${dancingScript.variable} antialiased`}
      >
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
