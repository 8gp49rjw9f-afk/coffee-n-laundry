  /*
   * The 24-hour window on comments.
   *
   * A `warning` and not a `muted` notice, for the reason
   * REPORT_TOO_SOON is one: nothing was recorded AND the thing is
   * still worth saying — just not yet. A grey whisper would lose
   * the second half.
   *
   * THE SENTENCE SAYS “TODAY”, NOT “ON THIS PLACE”. The ceiling is
   * per person, not per place: one comment in 24 hours wherever it
   * is posted. Telling someone they had already commented “on this
   * place” when they had written on a different one would be a lie
   * about the rule they just hit — and the rule is the part they
   * have to understand to act on it.
   */
  COMMENT_TOO_SOON: {
    title: "Already today",
    body: "You've already commented today. Come back tomorrow.",
    severity: "warning",
  },