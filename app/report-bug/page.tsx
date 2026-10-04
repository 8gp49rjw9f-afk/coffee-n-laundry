import { ContactForm } from "@/components/contact/ContactForm";

/*
 * The subject line an admin sees starts with "Bug :", so a report is
 * recognisable in an inbox without opening it.
 */

export const metadata = { title: "Report a bug — coffee'n'laundry" };

export default function ReportBugPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-8 sm:px-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
          Something broken?
        </h1>

        <p className="mt-1 text-sm text-slate-600">
          Tell us what you saw and what you expected. The more precisely you
          describe it, the faster it gets fixed.
        </p>
      </div>

      <ContactForm
        kind="bug"
        intro="Which page, what you did, and what happened instead."
        placeholder="On the map, when I tap a pin the card opens but the photo never loads. The rest of the card is fine."
        subjectPrefix="Bug"
      />
    </main>
  );
}
