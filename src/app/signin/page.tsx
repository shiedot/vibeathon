import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SignInForm } from "@/components/signin-form";

type SignInPageProps = {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const session = await auth();
  const params = await searchParams;
  const callbackUrl = params.callbackUrl ?? "/";

  if (session) redirect(callbackUrl);

  return <SignInForm callbackUrl={callbackUrl} error={params.error} />;
}
