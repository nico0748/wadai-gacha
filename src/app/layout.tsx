import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Shippori_Mincho_B1, Zen_Kaku_Gothic_New } from "next/font/google";
import { BRAND } from "@/lib/brand";
import "./globals.css";

// Headings and card topics: a mincho with a calligraphic hand.
const mincho = Shippori_Mincho_B1({
  variable: "--font-mincho",
  weight: ["500", "600", "700"],
  subsets: ["latin"],
  preload: false,
  display: "swap",
});

// Body text, buttons and fields: a plain, quiet gothic.
const gothic = Zen_Kaku_Gothic_New({
  variable: "--font-gothic",
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  preload: false,
  display: "swap",
});

// The Latin wordmark and card numbers.
const serif = Cormorant_Garamond({
  variable: "--font-serif",
  weight: ["500", "600"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  display: "swap",
});

const NAME = BRAND.name;
const DESCRIPTION = BRAND.description;

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
  themeColor: BRAND.themeColor,
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className={`${mincho.variable} ${gothic.variable} ${serif.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
