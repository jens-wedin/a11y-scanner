import { ScanProgressView } from "@/components/ScanProgressView";

interface Props {
  params: Promise<{ scanId: string }>;
}

export default async function ScanPage({ params }: Props) {
  const { scanId } = await params;

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <h1 className="text-xl font-bold text-gray-900 mb-6">
          Scanning in progress
        </h1>
        <ScanProgressView scanId={scanId} />
      </div>
    </main>
  );
}
