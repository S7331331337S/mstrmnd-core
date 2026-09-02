import { useLocalSearchParams } from "expo-router";

import { AgentDetail } from "@/screens/agent-detail";

export default function AgentRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <AgentDetail agentId={id} />;
}
