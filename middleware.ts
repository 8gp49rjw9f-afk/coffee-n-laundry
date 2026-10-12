/*
 * ======================================================
 * THE MIDDLEWARE ENTRY POINT
 * ======================================================
 *
 * All the work lives in proxy.ts beside this file. This exists for
 * one reason: to guarantee that something the runtime will actually
 * execute calls it.
 *
 * Next 16 renamed the "middleware" convention to "proxy", and
 * proxy.ts was written on the strength of that rename. Whether this
 * particular 16.2.10 build honours the new name is not something the
 * repository can answer — and while that question stays open, the
 * maintenance switch does nothing: the admin panel writes
 * `maintenance_mode` to the database, no request ever reads it, and
 * the site carries on as if the switch were not there.
 *
 * Re-exporting under the old name settles it either way. If the
 * runtime recognises `proxy`, this file is never consulted and the
 * behaviour is unchanged. If it does not, this is the function that
 * runs, and the maintenance redirect starts working. Neither case
 * needs a guess.
 *
 * Keep this file to the re-export. Two copies of the logic would
 * drift, and the one that runs is the one nobody remembers to edit.
 */

export { proxy as middleware, config } from "./proxy";
