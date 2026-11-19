import wixData from 'wix-data';
import { webMethod, Permissions } from 'wix-web-module';

const COLECCION = 'CajaActual';

export const obtenerCajaAbierta = webMethod(
  Permissions.SiteMember,
  async () => {
    const resultado = await wixData
      .query(COLECCION)
      .eq('estado', 'ABIERTA')
      .limit(1)
      .find();

    return resultado.items[0] || null;
  }
);

export const abrirCaja = webMethod(
  Permissions.SiteMember,
  async (datos) => {
    if (!datos || datos.efectivoInicial == null) {
      throw new Error('El efectivo inicial es obligatorio');
    }

    return wixData.insert(COLECCION, {
      estado: 'ABIERTA',
      efectivoInicial: Number(datos.efectivoInicial),
      efectivoEsperado: Number(datos.efectivoInicial),
      fechaApertura: new Date(),
      usuarioApertura: datos.usuarioId || null
    });
  }
);
