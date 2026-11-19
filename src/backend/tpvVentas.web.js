import wixData from 'wix-data';
import { webMethod, Permissions } from 'wix-web-module';

const COLECCION_OPERACIONES = 'OperacionesTPV';

export const registrarVenta = webMethod(
  Permissions.SiteMember,
  async (venta) => {
    if (
      !venta?.cajaId ||
      !Array.isArray(venta.lineas) ||
      venta.lineas.length === 0
    ) {
      throw new Error(
        'La venta debe incluir una caja y al menos una línea'
      );
    }

    // Punto de integración con Wix eCommerce
    // cuando la operación requiera un pedido o pago nativo.

    return wixData.insert(COLECCION_OPERACIONES, {
      ...venta,
      estado: 'REGISTRADA',
      fechaOperacion: new Date()
    });
  }
);
