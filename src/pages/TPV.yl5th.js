/**
 * Velo page-code template for the HTML Component #htmlTPV.
 * Add this handler to the Wix page containing the HTML Component.
 * Read-only by design: getCashierState is the sole data entry point.
 */
import { getCashierState } from 'backend/cajas.web';

$w.onReady(() => {
    const widget = $w('#htmlTPV');
    if (!widget) {
        console.error('[TPV] Missing HTML Component #htmlTPV');
        return;
    }

    let requestInFlight = false;

    widget.onMessage(async (event) => {
        const message = event?.data;
        if (!message || typeof message !== 'object' ||
            message.type !== 'TPV_REQUEST_STATE' || message.version !== 1) {
            return;
        }
        if (requestInFlight) return;

        requestInFlight = true;
        try {
            // The backend resolves identity and role. Never accept actor,
            // staffResourceId, amounts, collection names or permissions here.
            const result = await getCashierState({});
            widget.postMessage({ type: 'TPV_STATE', payload: result });
        } catch (error) {
            console.error('[TPV] getCashierState failed', error);
            widget.postMessage({
                type: 'TPV_ERROR',
                message: 'No se pudo consultar el estado de caja.'
            });
        } finally {
            requestInFlight = false;
        }
    });

    widget.postMessage({ type: 'TPV_READY', version: 1 });
});
