export const metadata = {
  title: 'URL Enrichment Test | Catering AI',
  description: 'Test the URL enrichment API with real API calls',
};

export default function TestEnrichmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-grow">{children}</main>
    </div>
  );
} 