import { FigmaLayout } from "@/components/figma/Layout";

export default function AuthenticatedAppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <FigmaLayout>{children}</FigmaLayout>;
}
