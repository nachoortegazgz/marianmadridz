import assert from "node:assert/strict";
import { extendedBookings } from "@wix/bookings";

assert.equal(
    typeof extendedBookings?.queryExtendedBookings,
    "function",
    "@wix/bookings extendedBookings.queryExtendedBookings must be exported by the installed SDK"
);

process.stdout.write(
    "Wix Bookings Reader V2 SDK contract OK: extendedBookings.queryExtendedBookings\n"
);
