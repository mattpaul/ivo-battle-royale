import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Battle Royale",
  description: "Spectate AI coding agents in programming challenge skirmishes."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
