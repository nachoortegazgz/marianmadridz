import wixData from 'wix-data';
import { webMethod, Permissions } from 'wix-web-module';

const COLECCION = 'MovimientosCaja';

export const registrarMovimiento = webMethod(
  Permissions.SiteMember,
  async (movimiento) => {
    if (!movimiento?.cajaId || !movimiento?.tipoMovimiento) {
      throw new Error(
        'La caja y el tipo de movimiento son obligatorios'
      );
    }

    return wixData.insert(COLECCION, {
      ...movimiento,
      fechaMovimiento: new Date()
    });
  }
);
