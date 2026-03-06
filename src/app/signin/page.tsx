"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AuthModal } from "@/components/auth/AuthModal";

export default function SignInPage() {
  const [showModal, setShowModal] = useState(false);
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? undefined;
  const error = searchParams.get("error");

  useEffect(() => {
    setShowModal(true);
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center pt-[72px]">
      {error && (
        <div className="absolute top-[100px] left-1/2 -translate-x-1/2 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2 text-red-400 text-sm">
          Authentication failed. Please try again.
        </div>
      )}
      <AuthModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        redirectTo={redirect}
      />
    </main>
  );
}
