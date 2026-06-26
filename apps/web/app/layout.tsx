import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "RevealID",
  description: "Privacy-preserving academic credential wallet and verifier",
  icons: {
    icon: "/revealid.png",
    apple: "/revealid.png"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
