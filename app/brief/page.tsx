import { redirect } from "next/navigation";

/*
 * The brief and About were saying the same thing twice. The content
 * lives on /about now, and this keeps the old address working — it is
 * linked from the menu, from the README, and from links already
 * shared.
 */

export default function BriefPage() {
  redirect("/about");
}
