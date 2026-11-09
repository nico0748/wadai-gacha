import type { Metadata, Viewport } from "next";
import { Dela_Gothic_One, Zen_Maru_Gothic } from "next/font/google";
import "./globals.css";

const dela = Dela_Gothic_One({
  variable: "--font-dela",
  weight: "400",
  subsets: ["latin"],
  preload: false,
  display: "swap",
});

const zen = Zen_Maru_Gothic({
  variable: "--font-zen",
  weight: ["500", "700", "900"],
  subsets: ["latin"],
  preload: false,
  display: "swap",
});

const NAME = "めくトーク";
const DESCRIPTION = "その場のみんなで話題を出し合って、カードのガチャで引く。飲み会や雑談のお供に。";

export const metadata: Metadata = {
  // Share images need an absolute URL. On Vercel, Next fills this in by itself.
  metadataBase: process.env.SITE_URL ? new URL(process.env.SITE_URL) : undefined,
  title: { default: NAME, template: `%s | ${NAME}` },
  description: DESCRIPTION,
  applicationName: NAME,
  appleWebApp: { title: NAME },
  openGraph: { type: "website", siteName: NAME, title: NAME, description: DESCRIPTION, locale: "ja_JP" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#16122b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className={`${dela.variable} ${zen.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
