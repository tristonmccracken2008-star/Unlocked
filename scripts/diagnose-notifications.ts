process.env.AUTH_SECRET ||= "notification-diagnostics-requires-a-production-secret";

export {};

const userId = process.env.NOTIFICATION_DIAGNOSTIC_USER_ID?.trim();
if (!userId) {
  console.error("Set NOTIFICATION_DIAGNOSTIC_USER_ID to an internal user ID.");
  process.exit(1);
}

const { notificationDiagnostics } = await import("../lib/notification-store");
const result = await notificationDiagnostics(userId);
console.log("UnlockED notification diagnostics", result);
