import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import HomeHeader from "@/components/home/HomeHeader";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "coffee'n'laundry — Good coffee. Clean clothes. Keep moving.",
  description:
    "A community map of good coffee and good laundry for people on the road. Real prices, real payment methods, recent updates.",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-slate-100">

        {/* GLOBAL HEADER — present on every page */}

        <HomeHeader />

        <div className="flex-1">{children}</div>

      </body>
    </html>
  );
}
