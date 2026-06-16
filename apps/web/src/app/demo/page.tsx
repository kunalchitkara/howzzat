import type { Metadata, Viewport } from "next";
import { DemoPresentation } from "@/components/demo/DemoPresentation";

export const metadata: Metadata = {
  title: "Howzzat — End-to-End Demo",
  description:
    "Interactive walkthrough for coaches, managers, and parents — sign-in, scheduling, live scoring, and tournament insights.",
  openGraph: {
    title: "Howzzat — End-to-End Demo",
    description: "Youth cricket scoring from sign-in to live scorecards and season insights.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#0a1628",
};

/** Public coach/parent demo deck — no auth required. */
export default function DemoPresentationPage() {
  return <DemoPresentation />;
}
