import type { Metadata } from "next";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "EtherCast – Retrocausal Affirmations Ledger",
  description: "Retrocausal affirmations inscribed on World Chain."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
