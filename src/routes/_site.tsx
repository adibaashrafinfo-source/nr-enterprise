import { Outlet, createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/layouts/PublicLayout";
import { canPrefetch } from "@/config/flags";
import { categoriesQuery, productsQuery, settingsQuery } from "@/lib/queries";
import spec from "@/data/spec.json";

const c = spec.company.contact;
const orgJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "NR Enterprise",
  description: spec.brand.tagline,
  logo: "/assets/brand/nr-logo-full.png",
  email: c.email,
  telephone: c.phones[0],
  address: { "@type": "PostalAddress", streetAddress: "House # 375/C, Chanpara, Uttarkhan", addressLocality: "Dhaka", postalCode: "1230", addressCountry: "BD" },
};

export const Route = createFileRoute("/_site")({
  loader: async ({ context }) => {
    if (!canPrefetch()) return;
    await Promise.all([
      context.queryClient.ensureQueryData(settingsQuery()),
      context.queryClient.ensureQueryData(categoriesQuery()),
      context.queryClient.ensureQueryData(productsQuery({ per_page: 48 })),
    ]);
  },
  head: () => ({ scripts: [{ type: "application/ld+json", children: JSON.stringify(orgJsonLd) }] }),
  component: () => <PublicLayout><Outlet /></PublicLayout>,
});
