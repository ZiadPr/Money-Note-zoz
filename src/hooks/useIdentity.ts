import { useEffect, useState } from "react";
import { db, type UserIdentity } from "@/lib/db";
import { getIdentity } from "@/lib/identity";

export function useIdentity() {
  const [identity, setIdentity] = useState<UserIdentity | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getIdentity().then((id) => {
      if (!mounted) return;
      setIdentity(id ?? null);
      setLoading(false);
    });
    const handler = () => getIdentity().then((id) => mounted && setIdentity(id ?? null));
    window.addEventListener("mn-identity-changed", handler);
    return () => {
      mounted = false;
      window.removeEventListener("mn-identity-changed", handler);
    };
  }, []);

  return { identity, loading, refresh: () => getIdentity().then((id) => setIdentity(id ?? null)) };
}

export function notifyIdentityChanged() {
  window.dispatchEvent(new Event("mn-identity-changed"));
}
