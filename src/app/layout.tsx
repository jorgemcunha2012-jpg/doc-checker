import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ConferIA",
  description: "SaaS de conferência documental imobiliária com IA e OCR.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
