import { redirect } from "next/navigation";

/* Kept for the same reason as /about: old links, and the README. */

export default function BriefPage() {
  redirect("/goal");
}
