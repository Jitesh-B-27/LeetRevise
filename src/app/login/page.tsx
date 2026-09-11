import { redirect } from "next/navigation";
import { AuthPage } from "@/components/auth-page";
import { getAuthenticatedUserId } from "@/lib/auth/session";

interface LoginPageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  if (await getAuthenticatedUserId()) {
    redirect("/dashboard");
  }

  const { status } = await searchParams;
  return <AuthPage mode="login" status={status} />;
}
