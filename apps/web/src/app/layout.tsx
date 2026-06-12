import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Howzzat — Cricket Scoring",
  description:
    "Ball-by-ball cricket scoring, tournament rules, and public dashboards — for managers, scorers, and spectators.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
