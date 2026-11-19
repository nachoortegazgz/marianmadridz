import { webMethod, Permissions } from 'wix-web-module';

export const clasificarPago = webMethod(
  Permissions.SiteMember,
  (pago) => {
    const metodo = String(
      pago?.metodoPago || ''
    ).toLowerCase();

    const afectaEfectivo =
      metodo === 'efectivo' ||
      metodo === 'cash';

    return {
      metodoPago: metodo,
      afectaEfectivo,
      importeEfectivo: afectaEfectivo
        ? Number(pago.importe || 0)
        : 0
    };
  }
);
