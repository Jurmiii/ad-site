import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

import { SiteShell } from "@/components/layout/site-shell";

export const metadata: Metadata = {
  title: "Money Calendar",
  description: "예산 기반 루틴을 만드는 웹 공개형 머니 캘린더",
};

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="ko">
      <body>
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
