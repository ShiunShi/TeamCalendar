"use client";

import * as React from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function InviteLinkRow({ token }: { token: string }) {
  const [copied, setCopied] = React.useState(false);

  // Build the join URL from the current origin so it works in any environment
  // (localhost, preview, production) without needing an env var.
  const url = React.useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/join/${token}`;
  }, [token]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Invite link copied.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy. Select the link and copy it manually.");
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Input
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        className="font-mono text-xs"
      />
      <Button type="button" variant="outline" size="icon" onClick={copy} aria-label="Copy invite link">
        {copied ? <Check className="size-4 text-green-600" /> : <Copy className="size-4" />}
      </Button>
    </div>
  );
}
