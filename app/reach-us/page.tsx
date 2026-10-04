import { ContactForm } from "@/components/contact/ContactForm";

/*
 * The subject line starts with "Reach Us :", so a message from a
 * person reads differently from a bug report in the same inbox.
 */

export const metadata = { title: "Reach us — coffee'n'laundry" };

export default function ReachUsPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-8 sm:px-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Reach us</h1>

        <p className="mt-1 text-sm text-slate-600">
          A place that should not be here, an idea worth having, or just
          something you want to say.
        </p>
      </div>

      <ContactForm
        kind="reach"
        intro="Write as much or as little as you like."
        placeholder="Hello — there is a laundromat on my street that is perfect and not on your map yet. Also, could you add a filter for places open on Sundays?"
        subjectPrefix="Reach Us"
      />
    </main>
  );
}
