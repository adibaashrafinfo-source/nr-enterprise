import { EmptyState } from "./EmptyState";

export function StubPage({ title, note = "This page is built in a later phase." }: { title: string; note?: string }) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16">
      <h1 className="heading-bar mb-8 text-3xl font-bold tracking-tight">{title}</h1>
      <EmptyState title="Coming soon" description={note} />
    </section>
  );
}
