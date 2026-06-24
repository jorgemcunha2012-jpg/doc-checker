import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ConferIA | Conferência documental imobiliária",
  description: "Conferência documental imobiliária com checklist inteligente por IA.",
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
