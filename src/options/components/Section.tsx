import type { ReactNode } from "react";

export const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="card mt-4 w-full">
    <h2 className="text-base font-semibold">{title}</h2>
    <div className="mt-2 space-y-3 text-sm">{children}</div>
  </section>
);
