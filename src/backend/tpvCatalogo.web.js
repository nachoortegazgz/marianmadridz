import { webMethod, Permissions } from 'wix-web-module';

export const buscarConceptos = webMethod(
  Permissions.SiteMember,
  async (texto) => {
    const busqueda = String(texto || '').trim();

    // Punto de integración con Wix Bookings
    // y Wix Stores Catalog V3.

    return {
      texto: busqueda,
      servicios: [],
      productos: []
    };
  }
);
