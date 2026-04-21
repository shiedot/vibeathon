import { redirect } from "next/navigation";
import { getCurrentParticipant } from "@/server/current-participant";
import { Landing } from "./landing";

export const dynamic = "force-dynamic";

type SignInPageProps = {
  searchParams: Promise<{ callbackUrl?: string }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const me = await getCurrentParticipant();
  const params = await searchParams;
  const callbackUrl = params.callbackUrl ?? "/";

  if (me) redirect(callbackUrl);

  return <Landing callbackUrl={callbackUrl} />;
}
