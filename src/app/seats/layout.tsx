import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function SeatsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[calc(100vh-72px)] bg-zinc-50/50">
      <div className="border-b border-zinc-100 bg-white">
        <div className="mx-auto max-w-[1120px] px-5 py-4 sm:px-8">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 transition hover:text-zinc-900"
          >
            <ArrowLeft className="size-4" strokeWidth={1.75} />
            Back to flight search
          </Link>
        </div>
      </div>
      <div className="mx-auto max-w-[1120px] px-5 py-8 sm:px-8">{children}</div>
    </div>
  );
}
