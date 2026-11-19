import { webMethod, Permissions } from 'wix-web-module';

export const normalizarImporte = webMethod(
  Permissions.SiteMember,
  (importe) => {
    const valor = Number(importe);

    if (!Number.isFinite(valor) || valor < 0) {
      throw new Error('Importe no válido');
    }

    return Math.round((valor + Number.EPSILON) * 100) / 100;
  }
);

export const crearIdempotencyKey = webMethod(
  Permissions.SiteMember,
  (clave) => String(clave || '').trim()
);
