import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AuthForm } from "../auth-form";

export const dynamic = "force-dynamic";

export default async function SignInPage({
  searchParams,
}: PageProps<"/sign-in">) {
  if (await getSession()) redirect("/");
  const { next } = await searchParams;
  const target = typeof next === "string" && next.startsWith("/") ? next : "/";
  return <AuthForm mode="sign-in" next={target} />;
}
