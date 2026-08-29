import { useLocalSearchParams } from "expo-router";

import { Room } from "@/screens/room";

export default function RoomRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Room sessionId={id} />;
}
