import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "めくトーク",
    short_name: "めくトーク",
    description: "その場のみんなで話題を出し合って、カードのガチャで引く。飲み会や雑談のお供に。",
    lang: "ja",
    start_url: "/",
    display: "standalone",
    background_color: "#16122b",
    theme_color: "#16122b",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
