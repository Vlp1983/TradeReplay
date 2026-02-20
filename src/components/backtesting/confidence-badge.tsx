import { Badge } from "@/components/ui/badge";
import type { Confidence } from "@/lib/engine/types";

const variantMap: Record<Confidence, "success" | "outline" | "danger"> = {
  High: "success",
  Med: "outline",
  Low: "danger",
};

export function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  return (
    <Badge variant={variantMap[confidence]} className="text-[10px]">
      {confidence}
    </Badge>
  );
}
