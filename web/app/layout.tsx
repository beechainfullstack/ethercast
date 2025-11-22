import type { Metadata } from "next";
import "../styles/globals.css";
import { MiniKitProvider } from "@worldcoin/minikit-js/minikit-provider";

export const metadata: Metadata = {
  title: "EtherCast – Retrocausal Affirmations Ledger",
  description: "Retrocausal affirmations inscribed on World Chain."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <MiniKitProvider>
        <body>{children}</body>
      </MiniKitProvider>
    </html>
  );
}
