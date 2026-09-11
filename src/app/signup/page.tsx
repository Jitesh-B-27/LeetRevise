import { redirect } from "next/navigation";
import { AuthPage } from "@/components/auth-page";
import { getAuthenticatedUserId } from "@/lib/auth/session";

interface SignupPageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  if (await getAuthenticatedUserId()) {
    redirect("/dashboard");
  }

  const { status } = await searchParams;
  return <AuthPage mode="signup" status={status} />;
}
