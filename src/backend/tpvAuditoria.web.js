import wixData from 'wix-data';
import { webMethod, Permissions } from 'wix-web-module';

export const registrarAuditoria = webMethod(
  Permissions.SiteMember,
  async (evento) => {
    return wixData.insert('AuditoriaTPV', {
      ...evento,
      fecha: new Date()
    });
  }
);
