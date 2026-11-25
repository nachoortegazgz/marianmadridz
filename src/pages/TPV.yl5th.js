/**
 * Velo page code for the admin-only TPV QA harness (#htmlTPV).
 *
 * The HTML iframe uses the MM_READY/MM_CONTEXT/CASHIER_STATE protocol.
 * Keep protocol handling and QA backend access in the public controller.
 * This page only attaches the controller to the Wix HTML Component.
 */
import { initializeTpvPage } from "public/tpvPageController";

$w.onReady(() => {
    const widget = $w("#htmlTPV");
    if (!widget) {
        console.error("[TPV] Missing HTML Component #htmlTPV");
        return;
    }

    try {
        initializeTpvPage(widget);
    } catch (error) {
        console.error("[TPV] HTML bridge initialization failed", {
            code: String(error?.code || error?.message || "TPV_BRIDGE_INIT_FAILED"),
        });
    }
});
