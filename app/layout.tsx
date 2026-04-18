import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Canon Law Tribunal",
  description:
    "Judicial process management for marriage nullity cases per 1983 CIC (Mitis Iudex, 2015).",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
