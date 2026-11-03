import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Reschedules outbox events whose delivery job was lost (see notifications.sweepStuck).
crons.interval("sweep stuck notifications", { minutes: 5 }, internal.notifications.sweepStuck, {});

export default crons;
