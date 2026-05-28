import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

// Wordmark only — soft editorial serif for the "flowwww" logotype.
const fraunces = Fraunces({
  variable: "--font-wordmark",
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  display: "swap",
});

const APP_NAME = "flowwww";
const APP_DESCRIPTION =
  "flowwww is a calm presentation console for worship and gatherings — project scripture in any translation, sermon notes, media, and stream background music from Spotify or YouTube to a second screen.";

export const metadata: Metadata = {
  metadataBase: new URL("https://bible.kelvinamoaba.com"),
  title: {
    default: "flowwww — worship presentation console",
    template: "%s · flowwww",
  },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  // Theme-aware favicon: the browser picks the file matching the OS/browser
  // color scheme via the media attribute — dark waves on light, white on dark.
  icons: {
    icon: [
      { url: "/icon-light.svg", type: "image/svg+xml", media: "(prefers-color-scheme: light)" },
      { url: "/icon-dark.svg", type: "image/svg+xml", media: "(prefers-color-scheme: dark)" },
    ],
  },
  keywords: [
    "worship presentation",
    "scripture projection",
    "church slides",
    "sermon notes",
    "lyrics projection",
    "bible presenter",
  ],
  authors: [{ name: "Kelvin Amoaba" }],
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    title: "flowwww — worship presentation console",
    description: APP_DESCRIPTION,
    url: "https://bible.kelvinamoaba.com",
  },
  twitter: {
    card: "summary",
    title: "flowwww — worship presentation console",
    description: APP_DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} antialiased overflow-hidden`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
