import wixData from 'wix-data';
import { webMethod, Permissions } from 'wix-web-module';

export const obtenerResumenCierre = webMethod(
  Permissions.SiteMember,
  async (cajaId) => {
    if (!cajaId) {
      throw new Error('cajaId es obligatorio');
    }

    const resultado = await wixData
      .query('MovimientosCaja')
      .eq('cajaId', cajaId)
      .limit(1000)
      .find();

    return {
      cajaId,
      numeroMovimientos: resultado.items.length,
      movimientos: resultado.items
    };
  }
);
