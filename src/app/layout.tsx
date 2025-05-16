import type {Metadata} from 'next';
import { GeistSans } from 'next/font/google'; // Corrected import for GeistSans
import { GeistMono } from 'next/font/google'; // Corrected import for GeistMono
import './globals.css';
import { Toaster } from "@/components/ui/toaster";

const geistSans = GeistSans({ // Use GeistSans as a function
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = GeistMono({ // Use GeistMono as a function
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'NexusConnect',
  description: 'Connecting businesses and people intelligently.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
