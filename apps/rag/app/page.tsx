import Chat from "@/components/Chat";
import { missingApiKeys } from "@/lib/providerErrors";
export const dynamic = "force-dynamic";
export default function Page() {
  return <Chat missingKeys={missingApiKeys()} />;
}
