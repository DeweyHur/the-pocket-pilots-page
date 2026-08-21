import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Pocket Pilots — Rehearsal HQ",
  description: "The Pocket Pilots rehearsal plan: lineup, setlist, and next session details.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "The Pocket Pilots — Rehearsal HQ",
    description: "Three players. Four songs. One loud evening.",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "The Pocket Pilots rehearsal plan" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Pocket Pilots — Rehearsal HQ",
    description: "Three players. Four songs. One loud evening.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
