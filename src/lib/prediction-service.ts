import type { PredictionRequest } from "@/lib/types";

export interface PredictionReceipt {
  requestId: string;
  status: "accepted";
  message: string;
}

// Replace this adapter with the central prediction API when it is available.
export async function submitPredictionRequest(
  request: PredictionRequest,
): Promise<PredictionReceipt> {
  await new Promise((resolve) => window.setTimeout(resolve, 650));
  return {
    requestId: `demo-${request.mode}-${Date.now()}`,
    status: "accepted",
    message: "Your request is ready to connect to the MatchMetric analysis engine.",
  };
}
