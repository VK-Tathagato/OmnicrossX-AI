"use client";

import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { useParams } from "next/navigation";

export default function ResearchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = useAuth();
  const params = useParams();
  const sessionId = params.sessionId as string;

  useEffect(() => {
    const handleBeforeUnload = () => {
      // If the user is anonymous, clean up their temporary session on tab close
      if (!userId && sessionId) {
        fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/research/${sessionId}`, {
          method: "DELETE",
          keepalive: true,
        }).catch(() => {});
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [userId, sessionId]);

  return <>{children}</>;
}
