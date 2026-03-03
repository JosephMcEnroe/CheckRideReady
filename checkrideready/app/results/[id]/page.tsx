import { redirect } from "next/navigation";

export default async function LegacyResultsDebriefPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const resolved = await Promise.resolve(params);
  redirect(`/sessions/${resolved.id}/debrief`);
}
