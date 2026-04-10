import type { ReactNode } from "react";
import { SiteHeader } from "@/components/layout/site-header";

type SiteShellProps = Readonly<{
  children: ReactNode;
}>;

export function SiteShell({ children }: SiteShellProps) {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
