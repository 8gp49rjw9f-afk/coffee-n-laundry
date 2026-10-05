import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import HomeHeader from "@/components/home/HomeHeader";
import SiteFooter from "@/components/home/SiteFooter";
import ErrorPopup from "@/components/ui/ErrorPopup";

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

        {/* GLOBAL FOOTER — the two ways to tell us something, plus
            the parts of the site a visitor might not think to look
            for in the hamburger menu. */}

        <SiteFooter />

        {/* ONE POPUP FOR THE WHOLE SITE.

            Mounted here and nowhere else, so every failure lands in
            the same place and looks the same. Components do not
            render it — they call showError(), because the thing that
            failed is often a panel inside the map or a card that has
            already unmounted, with nowhere to draw. */}

        <ErrorPopup />
      </body>
    </html>
  );
}
