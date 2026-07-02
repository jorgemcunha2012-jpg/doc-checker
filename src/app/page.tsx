import { ConferiaWorkspace } from "@/components/conferia-workspace";
import { getCurrentUser, isPublicAccessEnabled } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");
  return <ConferiaWorkspace currentUser={user} publicAccess={isPublicAccessEnabled()} />;
}
