/**
 * GET /api/clock-status
 *
 * Kiosk clocking switch. Uses the same server-side gate as /api/clock-in and
 * /api/clock-out so the kiosk UI can never disagree with enforcement.
 * Response: { locked: boolean, enabled: boolean }
 * When disabled, the /clock kiosk shows the "Clocking Locked - Contact HR"
 * screen and does not render the keypad.
 */
import { getClockEnabled } from "../../../lib/googleSheets";
import { fail, ok } from "../../../lib/utils";

export async function GET() {
  try {
    const enabled = await getClockEnabled();
    return ok({ locked: !enabled, enabled });
  } catch (error) {
    console.error("[GET /api/clock-status]", error);
    return fail("Internal server error");
  }
}