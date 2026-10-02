import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const sans = Geist({ subsets: ["latin"], variable: "--font-sans" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

const description = "Design, simulate and launch a token on Meteora's Dynamic Bonding Curve, then trade, graduate and migrate it, all on Solana.";

export const metadata: Metadata = {
  title: { default: "Launchcraft", template: "%s · Launchcraft" },
  description,
  openGraph: { title: "Launchcraft", description, type: "website", siteName: "Launchcraft" },
  twitter: { card: "summary_large_image", title: "Launchcraft", description },
};

export const viewport: Viewport = { themeColor: "#08080a", colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
