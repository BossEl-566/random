import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Financial Statement Studio",
  description:
    "Professional desktop financial accounting and statement preparation software.",
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