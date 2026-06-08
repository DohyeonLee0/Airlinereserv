import type { Metadata } from "next";
import { Inter } from "next/font/google";
import ChatWidget from "./components/chat/ChatWidget";
import SiteHeader from "./components/SiteHeader";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap"
});

export const metadata: Metadata = {
  title: "Airline Reservation System",
  description: "MariaDB stored procedure based airline reservation demo"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased">
        <SiteHeader />
        <main>{children}</main>
        <ChatWidget />
      </body>
    </html>
  );
}
