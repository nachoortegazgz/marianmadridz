import { webMethod, Permissions } from 'wix-web-module';

export const comprobarPermisoTPV = webMethod(
  Permissions.SiteMember,
  async (accion) => {
    // Sustituir por la política real de roles y permisos.

    return {
      accion,
      permitido: false,
      requiereConfiguracion: true
    };
  }
);
