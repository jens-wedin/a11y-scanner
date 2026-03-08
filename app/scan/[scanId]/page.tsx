import { ScanProgressView } from "@/components/ScanProgressView";
import { ThemeToggle } from "@/components/ThemeToggle";

interface Props {
  params: Promise<{ scanId: string }>;
}

export default async function ScanPage({ params }: Props) {
  const { scanId } = await params;

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-2xl bg-card rounded-2xl shadow-sm border border-border p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-foreground">
            Scanning in progress
          </h1>
          <ThemeToggle />
        </div>
        <ScanProgressView scanId={scanId} />
      </div>
    </main>
  );
}
