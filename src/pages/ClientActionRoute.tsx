import { useParams } from "react-router-dom";
import { ClientActionPage } from "@/pages/ClientActionPage";

export function ClientActionRoute() {
  const { token } = useParams<{ token: string }>();
  if (!token) return null;
  return <ClientActionPage token={token} />;
}
