export const metadata = {
  title: 'Outreach Template Test',
  description: 'Test page for generating outreach email templates',
};

export default function TestOutreachLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      {children}
    </div>
  );
} 