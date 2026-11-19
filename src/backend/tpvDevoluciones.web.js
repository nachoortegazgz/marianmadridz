import wixData from 'wix-data';
import { webMethod, Permissions } from 'wix-web-module';

export const registrarDevolucion = webMethod(
  Permissions.SiteMember,
  async (devolucion) => {
    if (
      !devolucion?.ventaOriginalId ||
      !devolucion?.importe
    ) {
      throw new Error(
        'La venta original y el importe son obligatorios'
      );
    }

    return wixData.insert('MovimientosCaja', {
      ...devolucion,
      tipoMovimiento: 'DEVOLUCION',
      estado: 'REGISTRADA',
      fechaMovimiento: new Date()
    });
  }
);
