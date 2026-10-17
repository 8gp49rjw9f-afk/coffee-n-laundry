  REPORT_ALREADY_SENT: {
    title: "You already reported this",
    body: "One report per person. An admin will look at it.",
    severity: "muted",
  },
  /*
   * The 24-hour window, for everyone who is not an admin.
   *
   * A `warning` rather than a `muted` notice, and the difference
   * matters: a muted line fades on its own and says nothing was
   * recorded. Here nothing was recorded AND the place still needs
   * reporting — the report is worth making, just not yet. A grey
   * whisper would lose that.
   *
   * The sentence names the wait rather than the rule, because the
   * wait is the only part the person can act on.
   */
  REPORT_TOO_SOON: {
    title: "You reported this recently",
    body: "One report per place every 24 hours. If something changed again, come back tomorrow.",
    severity: "warning",
  },
  /*
   * Reporting needs an account, and the action answers with this code
   * rather than navigating to /login. It blocked the same way before —
   * the action used to redirect, and a redirect is an exception, which
   * the form treated as a fault.
   */
  REPORT_SIGNED_OUT: {
    title: "Sign in first",
    body: "An account is needed to report a place — that is what keeps one person from reporting it eight times.",
    severity: "blocking",
  },

  /* ---------- REPORT_SIGNED_OUT_ANCHOR ---------- */