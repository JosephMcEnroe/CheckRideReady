import { auth } from "@/auth";

export async function requireUserId(): Promise<string | null> {
  const authSession = await auth();
  return (authSession?.user as { id?: string } | undefined)?.id ?? null;
}
