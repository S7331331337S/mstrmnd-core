import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AuthForm } from "../auth-form";

export const dynamic = "force-dynamic";

export default async function SignUpPage({
  searchParams,
}: PageProps<"/sign-up">) {
  if (await getSession()) redirect("/");
  const { next } = await searchParams;
  const target = typeof next === "string" && next.startsWith("/") ? next : "/";
  return <AuthForm mode="sign-up" next={target} />;
}
