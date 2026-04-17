// Grow-ops ambient brief for a single batch. Thin adapter over
// cody-shared/AmbientBriefPanel; mounts in the sidebar of BatchDetailPage.

import { AmbientBriefPanel, type AmbientBriefResponse } from "cody-shared";
import { callEdgeFunction } from "@/lib/edge-function";
import codyIcon from "@/assets/cody-icon.svg";

interface BatchBriefPanelProps {
  batchId: string;
}

interface RawBriefResponse {
  brief?: string;
  generated_at?: string;
  cached?: boolean;
}

export default function BatchBriefPanel({ batchId }: BatchBriefPanelProps) {
  const fetchBrief = async (forceRefresh: boolean): Promise<AmbientBriefResponse | null> => {
    const data = await callEdgeFunction<RawBriefResponse>(
      "generate-batch-brief",
      { batch_id: batchId, force_refresh: forceRefresh },
      45_000,
    );
    const brief = (data?.brief ?? "").trim();
    if (!brief) return null;
    return { brief, cached: data.cached, generated_at: data.generated_at };
  };

  return (
    <AmbientBriefPanel
      entityKey={batchId}
      fetchBrief={fetchBrief}
      iconSrc={codyIcon}
      variant="standard"
      subtitle="Cody · Batch Ops"
    />
  );
}
