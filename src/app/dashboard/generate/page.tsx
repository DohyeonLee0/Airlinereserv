import { redirect } from "next/navigation";

export default function GenerateFlightsRedirectPage() {
  redirect("/dashboard/master/schedules");
}
