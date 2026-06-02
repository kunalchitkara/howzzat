import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Howzzat — Junior cricket scoring & dashboards",
  description:
    "Ball-by-ball scoring, tournament rules, and public dashboards for youth cricket in London and beyond.",
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
