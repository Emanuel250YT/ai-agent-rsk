import type { Metadata } from "next";
import { Fraunces, Nunito } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import ContextProvider from "@/context";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-nunito",
  display: "swap",
});

export const metadata: Metadata = {
  title: "BlitzPay — DeFi Chat on Bitcoin",
  description: "Agente financiero con IA en Rootstock. Enviá pagos, ahorrá automáticamente y consultá tu balance usando lenguaje natural.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersData = await headers();
  const cookies = headersData.get('cookie');

  return (
    <html lang="es" className={`${fraunces.variable} ${nunito.variable}`}>
      <body>
        <ContextProvider cookies={cookies}>{children}</ContextProvider>
      </body>
    </html>
  );
}
