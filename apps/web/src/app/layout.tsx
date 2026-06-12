import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Howzzat — Cricket Scoring",
  description:
    "Ball-by-ball cricket scoring, tournament rules, and public dashboards — for managers, scorers, and spectators.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
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
