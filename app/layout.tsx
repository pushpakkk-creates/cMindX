import "./globals.css";

export const metadata = {
  title: "cMindX",
  description: "Self-evolving website agent",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-neutral-950 text-neutral-50">{children}</body>
    </html>
  );
}
