type BadgeStatus = "PASS" | "PROBE" | "REMEDIATE" | "FAIL" | "IN_PROGRESS";

interface StatusBadgeProps {
  status: BadgeStatus;
  className?: string;
}

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const styles = {
    PASS: "bg-[#22c55e]/10 text-[#22c55e] border-[#22c55e]/20",
    PROBE: "bg-[#fbbf24]/10 text-[#fbbf24] border-[#fbbf24]/20",
    REMEDIATE: "bg-[#fb923c]/10 text-[#fb923c] border-[#fb923c]/20",
    FAIL: "bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/20",
    IN_PROGRESS: "bg-[#3b82f6]/10 text-[#3b82f6] border-[#3b82f6]/20",
  };

  return (
    <span
      className={`inline-flex items-center rounded-md px-2.5 py-1 border font-medium ${styles[status]} ${className}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}

