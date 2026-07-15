import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Instrument_Sans } from "next/font/google";
import "./globals.css";

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "FDP — Filho da Puta",
  description:
    "O clássico jogo de cartas brasileiro. Declare seus tentos, blefe e seja o último de pé — solo contra bots ou online com os amigos.",
  applicationName: "FDP",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FDP",
  },
  openGraph: {
    title: "FDP — Filho da Puta",
    description:
      "O clássico jogo de cartas brasileiro. Declare seus tentos, blefe e seja o último de pé.",
    type: "website",
    locale: "pt_BR",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0b1f18",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${instrumentSerif.variable} ${instrumentSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
