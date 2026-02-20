import Link from "next/link";
import { Button } from "@/components/ui/button";

interface StubPageProps {
  title: string;
  description: string;
}

export function StubPage({ title, description }: StubPageProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <h1 className="text-[38px] font-bold text-text-primary md:text-[56px]">
        {title}
      </h1>
      <p className="mt-4 max-w-md text-center text-text-secondary">
        {description}
      </p>
      <Button variant="outline" className="mt-8" asChild>
        <Link href="/">Back to Home</Link>
      </Button>
    </div>
  );
}
