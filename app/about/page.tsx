import { redirect } from "next/navigation";

/*
 * About became The Goal. The old address keeps working — it is in the
 * README, in links already shared, and in the menu until this deploy.
 */

export default function AboutPage() {
  redirect("/goal");
}
