import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({ 
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "900"],
  variable: '--font-poppins',
});

export const metadata: Metadata = {
  title: "FMC Board Question App",
  description: "Advanced Resident Performance & Quiz System",
  manifest: "/manifest.json",
  themeColor: "#1e3a8a",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "FMC QBank",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${poppins.variable} font-sans bg-slate-50 text-slate-800`}>
        {children}
      </body>
    </html>
  );
}
