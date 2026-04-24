import { useEffect, useState } from "react";
import { db } from "@/lib/db";

export function useIdentityVerification(publicId?: string) {
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!publicId) {
        if (!mounted) return;
        setVerified(false);
        setLoading(false);
        return;
      }

      const memberships = await db.members.where("publicId").equals(publicId).toArray();
      if (!mounted) return;

      setVerified(memberships.some((member) => member.verified));
      setLoading(false);
    };

    load();

    return () => {
      mounted = false;
    };
  }, [publicId]);

  return { verified, loading };
}
