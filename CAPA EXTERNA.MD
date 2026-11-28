> **ESTADO DE VIGENCIA — 28-11-2026**  
> Este dossier es una propuesta de diseño y configuración, no evidencia de que SharePoint, Entra ID, Power Automate o el transporte estén desplegados. Para la arquitectura vigente y los contratos actuales prevalece [docs/architecture/CAPA-EXTERNA-MASTER-DOSSIER.md](docs/architecture/CAPA-EXTERNA-MASTER-DOSSIER.md).  
>  
> **Correcciones obligatorias antes de ejecutar los ejemplos de este documento:**  
> - No crear ni consultar `DatosFiscales` ni `PaquetesGestoria`: no forman parte del CMS físico vigente. La configuración fiscal canónica está asociada a `MapaStaff` con `recordType=CONFIG_SISTEMA`; el almacenamiento de paquetes en CMS fue retirado.  
> - No insertar paquetes en `HistoricoCierresZ`: es un registro de cierres Z, no un almacén documental. La Capa 3 debe usar el contrato de exportación y un registro de entrega separado.  
> - No usar `wix-secrets-backend.getSecret()`: está deprecado. La implementación nueva debe usar `wix-secrets-backend.v2` y `secrets.getSecretValue` en backend, elevado según la API oficial de Wix.  
> - No considerar implementados los cinco flujos de Power Automate ni la biblioteca SharePoint por aparecer aquí descritos. Su existencia, permisos y ejecución requieren verificación en el tenant.  
> - El límite general de pagos en efectivo es **1.000 € cuando alguna parte actúa como empresario o profesional**; la excepción es 10.000 € para persona física pagadora sin domicilio fiscal en España que no actúe como empresario/profesional. No existe un límite general B2C de 2.500 €. Véase Ley 7/2012, art. 7, modificada por Ley 11/2021.  
> - No aplicar un plazo único de seis años a toda la información: el Código de Comercio establece seis años para libros/documentación empresarial; el registro de jornada se conserva cuatro años; la prescripción tributaria general de cuatro años no sustituye al deber mercantil de conservación. Definir retención por categoría y finalidad.  
>  
> **Estado del código:** preparación de un informe trimestral en memoria; transporte a SharePoint, read-back, outbox y aceptación de gestoría aún no acreditados. El paquete actual se etiqueta como borrador interno y no como libro oficial de facturas ni presentación AEAT.
>
> ---
>
Perfecto. Eliminamos **`_Buzon_Entrada`**, **`_Inbox_Web`**, **`_Alertas_Error`** y cualquier carpeta técnica intermedia.

El principio de este rediseño es: **Marian solo ve carpetas humanas de negocio** y **el contable abre el mes y en 1 segundo tiene todo listo para importar fuera (A3, Sage, Contasol, Holded) o descargarlo en un único ZIP**.

---

## 1. Estructura Final Ultra-Simple (Solo 2 carpetas en la raíz)

En el sitio SharePoint **`Marian Madrid - Archivo Documental`** la biblioteca principal solo tiene **2 carpetas**:

```text
📁 Archivo Documental/
│
├── 📁 2026/
│   ├── 📁 2026-11/                                 ← Carpeta mensual (lo que usa Marian y el Contable)
│   │   │
│   │   ├── 📊 01_Facturas_Expedidas_202611.csv     ← Salón + Online (TS/FS/ON/R), Base, IVA, 700/705, Hash
│   │   ├── 📊 02_Facturas_Recibidas_202611.csv     ← Proveedores, IRPF (111/115), Intra-UE (349), Cuenta PGC
│   │   ├── 📊 03_Libro_Diario_PGC_202611.csv       ← Partida doble PGC (incluye 5729 pasarelas y 438 bonos)
│   │   ├── 📊 04_Arqueo_Caja_202611.csv            ← Resumen diario de caja, efectivo, tarjeta y Bizum
│   │   ├── 📊 05_Registro_Jornada_202611.csv       ← Fichajes RD-ley 8/2019 con validación HMAC
│   │   ├── 📄 LEEME_202611.txt                     ← Resumen en español claro + estado ✅
│   │   ├── 📄 HASH_202611.txt                      ← Huella SHA-256 de integridad del mes
│   │   │
│   │   ├── 📁 01_Cierres_Z_y_Tickets/              ← PDFs diarios Cierre Z + detalle tickets (auto desde Wix)
│   │   ├── 📁 02_Banco_y_Pasarelas/                ← Extracto .n43, CSV pasarela y Conciliacion_202611.xlsx
│   │   ├── 📁 03_Facturas_Proveedores_PDF/         ← PDFs/fotos originales (AAAA-MM-DD_Proveedor_NumFact.pdf)
│   │   └── 📁 04_Laboral/                          ← ⚠️ Acceso restringido (solo Marian + Asesor Laboral)
│   │                                                  Nóminas, RLC y RNT del mes
│   │
│   └── 📁 Impuestos_2026/                          ← Subcarpetas T1, T2, T3, T4 y Anual
│                                                      (Modelos 303, 111, 115, 130/202, 349, 390, 190, 180, 347)
│
└── 📁 Documentacion_Empresa/                       ← ⚠️ Acceso restringido (solo Marian + Contable)
    ├── Escrituras, Mod. 036, Alquiler, Seguros
    ├── Contratos personal, Altas/Bajas, PRL
    └── RGPD (RAT, contratos encargados Wix/M365/Stripe/Gestoría, evidencias citas)
```

### Por qué esta estructura resuelve la ecuación Marian + Contable
* **Para el Contable (flujo Pro)**:
  1. Entra en `2026/2026-11/` y ve **los 5 CSVs oficiales arriba del todo**, con separador `;` y codificación `UTF-8 con BOM` listos para importar directamente en **A3, Sage, Contasol o Holded**.
  2. Solo abre las 4 subcarpetas si necesita revisar un soporte concreto (un Cierre Z en PDF, el `.n43`, la factura original de luz/alquiler o las nóminas), **o hace clic arriba en `Descargar` sobre `2026-11`** para bajarse todo el mes en un único `.zip` ordenado para trabajar fuera.
  3. Cuando presenta los impuestos trimestrales o genera nóminas, los deposita directamente en `Impuestos_2026/T4/` o en `04_Laboral/`.
* **Para Marian (cero fricción)**:
  1. Solo existe `Año → Mes` y `Documentacion_Empresa`. No tiene que entender qué es un buzón de entrada ni mover archivos de un sitio a otro.
  2. La web (Wix) crea y rellena sola la carpeta del mes, los 5 CSVs y `01_Cierres_Z_y_Tickets/`.

---

## 2. Cómo entra todo sin tener `_Buzon_Entrada` ni `_Inbox_Web`

Usamos únicamente herramientas incluidas en **M365 Business Standard + Copilot** (sin conectores Premium):

1. **Datos de la Web (Wix → SharePoint sin carpeta técnica visible)**:
   * Wix Velo (`wix-fetch` → Microsoft Graph API) inserta el lote JSON diario/mensual en una **Lista oculta de SharePoint** llamada **`Sys_Cola_Web`** (oculta del menú lateral de Marian).
   * **Power Automate (Standard: `When an item is created`)** lee la fila, valida *fail-closed* y escribe **directamente** los CSVs en `2026/2026-11/` y los PDFs de Cierre Z (vía `OneDrive: Convert file`) en `2026/2026-11/01_Cierres_Z_y_Tickets/`.
   * Si algo descuadra en Wix, no crea carpetas de error: envía un **correo/Teams directo a Marian** con el número de ticket/factura a corregir.
2. **Facturas de Proveedores (directo al mes)**:
   * **Por email**: Marian reenvía el correo con la factura (o crea regla automática para luz, alquiler, Wix, Meta, proveedores fijos). Power Automate la guarda **directamente en `2026/2026-11/03_Facturas_Proveedores_PDF/`** (creando la carpeta si es día 1), le manda una tarjeta rápida en **Teams Approvals** para confirmar cuenta/IRPF si es proveedor nuevo y actualiza **`02_Facturas_Recibidas_202611.csv`**.
   * **Con el móvil o PC**: Si hace foto a un ticket de compra o descarga un PDF, lo suelta directamente en `03_Facturas_Proveedores_PDF/`. Power Automate vigila la biblioteca y lo incorpora al CSV automáticamente.
3. **Banco (Norma 43) y Pasarelas (directo a `02_Banco_y_Pasarelas`)**:
   * Marian o el contable sueltan el `.n43` del banco (y el CSV de Stripe/Redsys) **directamente dentro de `2026/2026-11/02_Banco_y_Pasarelas/`**.
   * Power Automate usa el trigger **`When a file is created (properties only)`** apuntando a la biblioteca raíz con una **Trigger Condition** que detecta archivos `.n43` dentro de `/02_Banco_y_Pasarelas/` (así funciona en subcarpetas dinámicas sin crear flujos por mes). Ejecuta un **Office Script en Excel Online** y deja allí mismo `Extracto_Banco_202611.csv` + `Conciliacion_202611.xlsx` cruzado con la cuenta puente `5729` y comisiones `626`.

---

## 3. Cómo trabaja el Contable con acceso externo profesional (0 €)

Desde octubre de 2026, Microsoft migró todo el uso compartido externo de SharePoint a **Microsoft Entra B2B**:
1. **Invitación sin coste de licencia**: Compartes la carpeta **`2026/`** (o el sitio si lleva también permanente/impuestos) con el email profesional de tu contable (`contable@tuasesoria.es`). Entra ID le crea una cuenta de **Invitado B2B gratuita** con autenticación segura (su propia cuenta Microsoft/Google o código OTP + MFA).
2. **Permisos separados por rol (RGPD y Laboral)**:
   * **Contable Fiscal**: Acceso de lectura/descarga en `2026/` y escritura únicamente en `Impuestos_2026/` (para subir modelos presentados). **No ve `04_Laboral/`** si lo lleva otra persona.
   * **Asesor Laboral** *(si es distinto)*: Acceso único a `04_Laboral/` y `05_Registro_Jornada_YYYYMM.csv`.
3. **Sellado de fin de mes (Inmutabilidad sin Purview Premium)**:
   * El día 5 (tras validar N43 y últimos gastos), Power Automate ejecuta **`Send an HTTP request to SharePoint`** sobre `2026/2026-11/` para romper herencia y pasar la carpeta completa del mes a **Solo Lectura (`Read`)** tanto para Marian como para el contable, generando `HASH_202611.txt`.
   * Así el contable sigue pudiendo descargar los datos en cualquier momento durante los **6 años legales**, pero nadie puede borrar ni alterar por error un fichero ya cerrado.

---

## 4. Qué hace Copilot para Marian en esta estructura limpia

Con **M365 Copilot** incluido en tu licencia, configuras un **Agente de SharePoint** sobre la carpeta `2026/` (ocultando la configuración en `Site Assets` para no ensuciar las carpetas):
* Marian puede preguntarle en lenguaje natural desde SharePoint o Teams:
  * *"¿Qué falta para cerrar noviembre de 2026?"* (Copilot revisa `LEEME`, `Conciliacion_202611.xlsx` y compara `02_Facturas_Recibidas.csv` contra los PDFs en `03_Facturas_Proveedores_PDF/`).
  * *"Dame el total de ingresos en efectivo, tarjeta y online de noviembre para comentarlo con la gestoría."*
* El contable **no consume ni ve** conversaciones de Marian, y los empleados nunca ven `04_Laboral/` ni `Documentacion_Empresa/` porque Copilot respeta automáticamente los permisos de SharePoint.

---

## 5. Resumen operativo: ¿Qué tiene que hacer cada persona al mes?

| Persona | Lo único que hace en el mes | Frecuencia |
|---|---|---|
| **Wix (Automático)** | Sube ventas salón + online, asientos PGC, Cierres Z PDF y fichajes HMAC directamente a `2026/2026-MM/` | Diario / Día 1 |
| **Marian** | 1. Reenvía emails de facturas (o sube foto a `03_Facturas_Proveedores_PDF/`)<br>2. Suelta el `.n43` del banco en `02_Banco_y_Pasarelas/`<br>3. Aprueba en Teams si un gasto nuevo pide cuenta/IRPF | 10 min / semana |
| **Power Automate** | Valida *fail-closed*, concilia el N43, genera `HASH` y bloquea `2026-MM/` en Solo Lectura avisando a ambos | Día 5 del mes |
| **Contable** | Entra en `2026/2026-MM/`, descarga los 5 CSVs o el ZIP completo, contabiliza/liquida en su software y sube los modelos a `Impuestos_2026/` | Mensual / Trimestral |

Si te encaja esta estructura definitiva de **2 carpetas raíz + 5 CSVs arriba + 4 subcarpetas por mes**, el siguiente paso es darte la **guía exacta de creación paso a paso en SharePoint + Power Automate + Wix Velo** (empezando por el esquema de la lista oculta `Sys_Cola_Web`, las *Trigger Conditions* exactas de Power Automate y la plantilla del script N43).

# Dossier Técnico de Desarrollo, Configuración y Enlace: Capa 3 Externa (`www.marianmadrid.es` → Microsoft 365 Business Standard + Copilot)

**Versión:** 2.0 (Definitiva — Sin conectores Premium · Compatible con licencia M365 Business Standard + Copilot)  
**Ámbito:** Peluquería, Estética, TPV Presencial, Tienda Online (`Wix Stores`), Agenda (`Wix Bookings V2`), Contabilidad PGC, Fiscalidad AEAT, Banco Norma 43, Laboral (`RD-ley 8/2019`) y RGPD.  
**Repositorio origen:** `nachoortegazgz/marianmadridz` (`Site ID: 188bed94-177c-4bc9-a9f0-35080d874f3e`, estado actual `Draft / NO-GO`).

---

## 0. Arquitectura del Enlace (`www.marianmadrid.es` ↔ M365)

Para lograr **coste 0 € adicional** con M365 Business Standard + Copilot (sin licencias Power Automate Premium ni Purview Premium) y mantener la **estructura limpia de 2 carpetas**, la comunicación funciona por **empuje seguro desde Wix (`wix-fetch` → Microsoft Graph API)** hacia una biblioteca técnica oculta en SharePoint (`Sys_Cola_Web`):

```text
[www.marianmadrid.es — Wix Velo Backend (Capas 0/1/2)]
  ├── fiscalExportCore.js         (Validación fail-closed + CSV UTF-8 BOM + SHA-256)
  ├── capa3GraphBridge.js         (Token Entra ID + subida PUT Graph API a Sys_Cola_Web)
  └── fiscalDocuments.web.js      (WebMethod Permissions.Admin para botón ZONA MARIAN)
            │
            │ HTTPS POST/PUT (OAuth2 client_credentials · Sites.Selected)
            ▼
[Microsoft 365 Business Standard + Copilot (Capa 3 — Bóveda Normativa)]
  ├── Biblioteca oculta: Sys_Cola_Web (recibe JSON sin límite de 64 KB)
  ├── 3 Listas ocultas:  Sys_Log_Web · Sys_Proveedores · Sys_Incidencias
  ├── 5 Flujos Power Automate (100 % Conectores Standard):
  │     F1: Ingesta JSON Wix → Genera CSVs oficiales en 2026/2026-MM/
  │     F2: Cierre Z diario  → HTML → OneDrive Convert PDF → 01_Cierres_Z_y_Tickets/
  │     F3: Facturas Email/Foto → 03_Facturas_Proveedores_PDF/ + Teams Approvals + CSV
  │     F4: Banco .n43 → Office Script Excel Online → Conciliación 572/5729/626
  │     F5: Sellado Mes → HASH + LEEME + Bloqueo Solo Lectura (REST API) + Email
  └── Biblioteca visible: Archivo Documental (solo 2026/ y Documentacion_Empresa/)
```

---

## FASE 1: Configuración de SharePoint Online (30 min)

### 1.1. Crear el Sitio Privado y la Biblioteca Visible
1. Entra en **SharePoint Admin Center** → **Sitios activos** → **Crear** → **Sitio de equipo** (sin grupo público o privado):
   * **Nombre**: `Marian Madrid Archivo`
   * **URL**: `/sites/MarianMadridArchivo`
   * **Zona horaria**: `(UTC+01:00) Madrid` · **Idioma**: Español.
   * **Configuración regional del sitio**: Español (España) para formato de fechas y separador `;`.
2. Crea o renombra la biblioteca principal a **`Archivo Documental`**:
   * En **Configuración de la biblioteca → Configuración de versiones**:
     * Activa **Crear versiones principales** y fija **Conservar 500 versiones** (protección ante sobrescrituras).
     * Exigir aprobación / desprotección: **No** (para no bloquear flujos automáticos).
3. Crea dentro de `Archivo Documental` únicamente estas **2 carpetas raíz**:
   * `2026/` (dentro se crearán automáticamente `2026-11/`, `2026-12/`, etc. y `Impuestos_2026/` con `T1`, `T2`, `T3`, `T4`, `Anual`).
   * `Documentacion_Empresa/` (con `01_Fiscal_Mercantil`, `02_Laboral_Contratos_PRL`, `03_RGPD_LOPDGDD`).
4. **Segregación de permisos (RGPD y Laboral)**:
   * En `Documentacion_Empresa/` → **Administrar acceso → Avanzado → Dejar de heredar permisos**: deja **solo a Marian** (Control total) y al **Contable** si lleva mercantil (en `02_Laboral_Contratos_PRL` y `03_RGPD_LOPDGDD`, deja solo a Marian / Asesor Laboral).
   * Cuando se cree `2026/2026-MM/04_Laboral/`, el Flujo 1 romperá automáticamente su herencia para excluir a cualquiera que no sea Marian o el Asesor Laboral.

### 1.2. Crear los Elementos Técnicos Ocultos (para no ensuciar la vista de Marian)
Desde **Contenidos del sitio → Nuevo** (y desmarcando *"Mostrar en el inicio rápido"*):

1. **Biblioteca de documentos oculta**: **`Sys_Cola_Web`**
   * Propósito: recibir los paquetes JSON enviados por Wix vía Graph API (sin el límite de 64 KB de las columnas de lista).
2. **Lista oculta 1**: **`Sys_Log_Web`**
   * Columnas: `Title` (TraceId), `Periodo` (Texto, ej. `2026-11`), `Dominio` (Elección: `MENSUAL`, `CIERRE_Z`, `RGPD`), `HashSHA256` (Texto), `TotalRegistros` (Número), `Estado` (Elección: `OK`, `ERROR_FAIL_CLOSED`, `DRY_RUN`), `DetalleError` (Varias líneas).
3. **Lista oculta 2**: **`Sys_Proveedores`**
   * Columnas: `Title` (NumFactura), `Periodo` (Texto), `FechaFactura` (Fecha), `NIFEmisor` (Texto), `Proveedor` (Texto), `BaseImponible` (Número 2 dec), `TipoIVA` (Número), `CuotaIVA` (Número 2 dec), `RetencionIRPF` (Número 2 dec), `TotalFactura` (Número 2 dec), `CuentaPGC` (Texto: `600`, `602`, `621`, `623`, `628`, `629`), `IntraUE` (Sí/No), `MedioPago` (Elección: `BANCO`, `CAJA`, `PENDIENTE`), `NombrePDF` (Texto).
4. **Lista oculta 3**: **`Sys_Incidencias`**
   * Columnas: `Title` (Código error), `Periodo` (Texto), `Origen` (Elección: `WEB`, `PROVEEDOR`, `BANCO_N43`), `Referencia` (Texto), `Mensaje` (Varias líneas), `Resuelta` (Sí/No).

### 1.3. Acceso Externo del Contable (Microsoft Entra B2B — 0 €)
1. En `Archivo Documental`, selecciona la carpeta **`2026/`** → **Compartir** → introduce el correo del contable (`contable@tuasesoria.es`) con permiso **Puede editar** solo en `Impuestos_2026/` y **Puede ver/descargar** en el resto de `2026/` (el acceso por meses cerrados quedará además en Solo Lectura por el Flujo 5).
2. El contable recibirá invitación B2B gratuita sin necesidad de comprar licencia M365 adicional.

---

## FASE 2: Registro en Microsoft Entra ID (`Sites.Selected`, Mínimo Privilegio)

En lugar de dar acceso a todo el tenant (`Sites.ReadWrite.All`), aplicamos permiso estricto solo al sitio `MarianMadridArchivo`:

1. Entra en **Microsoft Entra admin center** (`entra.microsoft.com`) → **Aplicaciones** → **Registros de aplicaciones** → **Nuevo registro**:
   * **Nombre**: `Wix-MarianMadrid-Capa3`
   * **Tipos de cuenta**: *Solo cuentas de este directorio organizativo*.
   * Copia el **`Id. de aplicación (cliente)` (`M365_CLIENT_ID`)** y el **`Id. de directorio (inquilino)` (`M365_TENANT_ID`)**.
2. En **Certificados y secretos** → **Nuevo secreto de cliente** (24 meses) → copia inmediatamente el **Valor** (`M365_CLIENT_SECRET`).
3. En **Permisos de API** → **Agregar un permiso** → **Microsoft Graph** → **Permisos de aplicación** → busca y marca **`Sites.Selected`** → pulsa **Conceder consentimiento de administrador**.
4. **Conceder acceso explícito de escritura solo a este sitio** (ejecútalo una única vez desde **Graph Explorer** `aka.ms/ge` logueado como Admin Global):
   * **Paso A** — Obtener `SITE_ID`:
     `GET https://graph.microsoft.com/v1.0/sites/TU_DOMINIO.sharepoint.com:/sites/MarianMadridArchivo`
     *(Copia el campo `id`, formato `dominio.sharepoint.com,guid1,guid2`)*.
   * **Paso B** — Obtener `DRIVE_ID` de `Sys_Cola_Web`:
     `GET https://graph.microsoft.com/v1.0/sites/{SITE_ID}/drives`
     *(Copia el `id` donde `name` sea `Sys_Cola_Web`)*.
   * **Paso C** — Obtener `LOG_LIST_ID` de `Sys_Log_Web`:
     `GET https://graph.microsoft.com/v1.0/sites/{SITE_ID}/lists`
     *(Copia el `id` donde `displayName` sea `Sys_Log_Web`)*.
   * **Paso D** — Autorizar la App sobre el sitio:
     `POST https://graph.microsoft.com/v1.0/sites/{SITE_ID}/permissions`
     ```json
     {
       "roles": ["write"],
       "grantedToIdentitiesV2": [
         {
           "application": {
             "id": "<M365_CLIENT_ID>",
             "displayName": "Wix-MarianMadrid-Capa3"
           }
         }
       ]
     }
     ```

---

## FASE 3: Desarrollo en el Backend de Wix (`www.marianmadrid.es`)

### 3.1. Secretos en Wix Secrets Manager
En el panel de Wix → **Developer Tools → Secrets Manager** (nunca en el código ni en Git), crea estos 6 secretos:
* `M365_TENANT_ID`
* `M365_CLIENT_ID`
* `M365_CLIENT_SECRET`
* `SP_SITE_ID`
* `SP_QUEUE_DRIVE_ID` *(Drive ID de `Sys_Cola_Web`)*
* `SP_LOG_LIST_ID` *(List ID de `Sys_Log_Web`)*

### 3.2. Nota obligatoria sobre el esquema del repositorio (`docs/ESQUEMA_CMS.md`)
Antes de fusionar el código en `main`, contrasta los nombres de campos dentro de `FIELD_MAP` contra **`docs/ESQUEMA_CMS.md`** (lectura física Wix *read-only* del 27-11-2026) porque `ESQUEMA_CMS.md` raíz está marcado como histórico/supersedido. Todo el mapeo está centralizado en un único bloque para ajustarlo en segundos sin tocar la lógica.

### 3.3. Archivo 1: `src/backend/fiscalExportCore.js` (Capa 0/3 pura, testable offline en CI)
Contiene la **validación *fail-closed***, el cálculo **SHA-256** y la generación de **CSVs oficiales (`UTF-8 BOM` + `;`)**. No importa módulos de red ni muta Capa 1/2.

```javascript
// src/backend/fiscalExportCore.js
import crypto from 'crypto';

/**
 * Mapa centralizado de keyfields CMS -> Contrato Capa 3.
 * Verificar contra docs/ESQUEMA_CMS.md (27-11-2026) antes de merge a main.
 */
export const FIELD_MAP = {
  movimientos: {
    fechaOperacion: 'fechaOperacion',
    fechaExpedicion: 'fechaExpedicionFactura',
    tipoMovimiento: 'movementType', // SALE, REFUND, PURCHASE, EXPENSE
    serieNumero: 'numSerieFactura',
    secuencia: 'sequenceNumber',
    tipoFactura: 'tipoFactura', // TS, FS, ON, R1..R5
    nifDestinatario: 'NIFDestinatario',
    nombreDestinatario: 'thirdPartyLegalName',
    descripcion: 'operationDescription',
    base: 'taxBase',
    tipoIva: 'tipoImpositivo',
    cuotaIva: 'taxAmount',
    total: 'totalAmount',
    claveRegimen: 'claveRegimen',
    medioPago: 'paymentMethod',
    canal: 'salesChannel', // PRESENCIAL | ONLINE
    naturalezaItem: 'itemNature', // SERVICE | PRODUCT | VOUCHER_438
    hashActual: 'recordHash',
    hashAnterior: 'previousRecordHash',
    estado: 'status'
  },
  asientos: {
    fecha: 'fechaOperacion',
    asientoId: 'entryGroupId',
    cuenta: 'cuentaContable',
    concepto: 'concepto',
    debe: 'debe',
    haber: 'haber',
    documentoId: 'documentId'
  },
  jornada: {
    fechaHora: 'recordedAt',
    staffId: 'staffId',
    staffNombre: 'staffName',
    evento: 'clockEventType',
    minutos: 'workedMinutes',
    motivoAjuste: 'adjustmentReason',
    firmaHmac: 'signature',
    dispositivo: 'workplaceId'
  }
};

const PGC_LABELS = {
  '300': 'Mercaderias',
  '400': 'Proveedores',
  '410': 'Acreedores por prestaciones de servicios',
  '430': 'Clientes',
  '438': 'Anticipos de clientes (Bonos)',
  '472': 'H.P. IVA soportado',
  '4751': 'H.P. acreedora por retenciones practicadas',
  '477': 'H.P. IVA repercutido',
  '570': 'Caja, euros',
  '572': 'Bancos c/c vista, euros',
  '5729': 'Pasarelas y TPV pendientes de liquidar',
  '600': 'Compras de mercaderias',
  '602': 'Compras de otros aprovisionamientos (Cabina)',
  '621': 'Arrendamientos y canones',
  '623': 'Servicios de profesionales independientes',
  '626': 'Servicios bancarios y similares',
  '628': 'Suministros',
  '629': 'Otros servicios',
  '640': 'Sueldos y salarios',
  '642': 'Seguridad Social a cargo de la empresa',
  '700': 'Ventas de mercaderias',
  '705': 'Prestaciones de servicios'
};

const round2 = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;

/**
 * Validacion Fail-Closed de datos exportables (Invariantes #2 y #7:
 * no convierte fallos en cero ni oculta descuadres).
 */
export function validateFiscalPackage({ movimientos = [], asientos = [], cierresZ = [], jornada = [] }) {
  const errores = [];
  const M = FIELD_MAP.movimientos;
  const A = FIELD_MAP.asientos;
  const J = FIELD_MAP.jornada;

  // 1. Validacion matematica y fiscal por movimiento de venta/devolucion
  for (const mov of movimientos) {
    const tipo = String(mov[M.tipoMovimiento] || '').toUpperCase();
    if (!['SALE', 'REFUND'].includes(tipo)) continue;

    const base = round2(mov[M.base]);
    const cuota = round2(mov[M.cuotaIva]);
    const total = round2(mov[M.total]);
    const ref = mov[M.serieNumero] || mov._id || 'SIN_REF';

    if (Math.abs(total - round2(base + cuota)) > 0.01) {
      errores.push({
        codigo: 'DESCUADRE_IVA_TOTAL',
        referencia: ref,
        mensaje: `Factura/Ticket ${ref}: Base (${base}) + IVA (${cuota}) != Total (${total})`
      });
    }

    if (!mov[M.descripcion]) {
      errores.push({
        codigo: 'DESCRIPCION_VACIA',
        referencia: ref,
        mensaje: `Operacion ${ref} sin descripcion obligatoria.`
      });
    }

    const tipoFactura = String(mov[M.tipoFactura] || '');
    const nif = String(mov[M.nifDestinatario] || '').trim();
    if ((tipoFactura === 'FS' || Math.abs(total) > 3000) && !nif) {
      errores.push({
        codigo: 'NIF_OBLIGATORIO_FALTA',
        referencia: ref,
        mensaje: `Factura ${ref} (${tipoFactura}, ${total} EUR) requiere NIF destinatario.`
      });
    }

    // Ley 11/2021 limite efectivo 1.000 EUR B2B / 2.500 EUR B2C
    const pago = String(mov[M.medioPago] || '').toUpperCase();
    if (pago === 'EFECTIVO' && ((nif && Math.abs(total) > 1000) || Math.abs(total) > 2500)) {
      errores.push({
        codigo: 'LIMITE_EFECTIVO_LEY_11_2021',
        referencia: ref,
        mensaje: `Cobro en efectivo ${ref} (${total} EUR) supera limite legal.`
      });
    }
  }

  // 2. Partida doble PGC en LibroAsientosContablesDetalle
  const grupos = new Map();
  for (const row of asientos) {
    const gid = row[A.asientoId] || row[A.documentoId] || row[A.fecha];
    const acc = grupos.get(gid) || { debe: 0, haber: 0 };
    acc.debe = round2(acc.debe + Number(row[A.debe] || 0));
    acc.haber = round2(acc.haber + Number(row[A.haber] || 0));
    grupos.set(gid, acc);
  }
  for (const [gid, sums] of grupos.entries()) {
    if (Math.abs(sums.debe - sums.haber) > 0.01) {
      errores.push({
        codigo: 'ASIENTO_DESCUADRADO',
        referencia: String(gid),
        mensaje: `Asiento ${gid}: Debe (${sums.debe}) != Haber (${sums.haber})`
      });
    }
  }

  // 3. Cierres Z: diferencia de efectivo != 0 exige motivo
  for (const z of cierresZ) {
    const diff = round2(z.difference ?? 0);
    if (Math.abs(diff) > 0.01 && !String(z.differenceReason || '').trim()) {
      errores.push({
        codigo: 'CIERRE_Z_SIN_MOTIVO_DESCUADRE',
        referencia: String(z.operationDate || z.closeDate || z._id),
        mensaje: `Cierre Z ${z.operationDate || z._id} con descuadre de ${diff} EUR sin justificacion.`
      });
    }
  }

  // 4. Registro horario RD-ley 8/2019: firma HMAC presente
  for (const reg of jornada) {
    if (!reg[J.firmaHmac]) {
      errores.push({
        codigo: 'FICHAJE_SIN_HMAC',
        referencia: String(reg._id || reg[J.fechaHora]),
        mensaje: `Fichaje sin firma HMAC valida (${reg[J.staffNombre] || reg[J.staffId]} - ${reg[J.fechaHora]}).`
      });
    }
  }

  return {
    ok: errores.length === 0,
    errores
  };
}

function escapeCsvCell(val) {
  if (val === null || val === undefined) return '';
  const str = String(val).replace(/\r?\n/g, ' ');
  if (str.includes(';') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatNumES(val) {
  return round2(val).toFixed(2).replace('.', ',');
}

export function toCsvUtf8Bom(headers, rows) {
  const lines = [
    headers.map(escapeCsvCell).join(';'),
    ...rows.map((r) => r.map(escapeCsvCell).join(';'))
  ];
  return '\uFEFF' + lines.join('\r\n');
}

export function buildGestoriaCSVs({ datosFiscales = {}, movimientos = [], asientos = [], cierresZ = [], jornada = [], mapaStaff = [] }) {
  const M = FIELD_MAP.movimientos;
  const A = FIELD_MAP.asientos;
  const J = FIELD_MAP.jornada;

  const staffById = new Map(mapaStaff.map((s) => [s.staffId || s._id, s]));

  // 1. 01_Facturas_Expedidas
  const expedidasRows = movimientos
    .filter((m) => ['SALE', 'REFUND'].includes(String(m[M.tipoMovimiento] || '').toUpperCase()))
    .map((m) => [
      datosFiscales.taxId || '',
      datosFiscales.legalName || 'Marian Madrid Peluqueria y Estetica',
      m[M.serieNumero] || '',
      m[M.secuencia] || '',
      String(m[M.fechaExpedicion] || m[M.fechaOperacion] || '').slice(0, 10),
      m[M.tipoFactura] || 'TS',
      m[M.nifDestinatario] || '',
      m[M.nifDestinatario] ? (m[M.nombreDestinatario] || '') : 'Consumidor Final', // RGPD minimizacion
      m[M.descripcion] || '',
      m[M.canal] || 'PRESENCIAL',
      m[M.naturalezaItem] || 'SERVICE',
      formatNumES(m[M.base]),
      formatNumES(m[M.tipoIva]),
      formatNumES(m[M.cuotaIva]),
      formatNumES(m[M.total]),
      m[M.medioPago] || '',
      m[M.hashActual] || '',
      m[M.hashAnterior] || ''
    ]);

  const csvExpedidas = toCsvUtf8Bom([
    'NIF Emisor', 'Nombre Emisor', 'Serie y Numero', 'Secuencia', 'Fecha Expedicion',
    'Tipo Factura', 'NIF Destinatario', 'Nombre Destinatario', 'Descripcion',
    'Canal', 'Naturaleza (Servicio/Producto/Bono)', 'Base Imponible', 'Tipo IVA %',
    'Cuota Repercutida', 'Importe Total', 'Medio de Cobro', 'Hash Registro', 'Hash Anterior'
  ], expedidasRows);

  // 2. 03_Libro_Diario_PGC
  const diarioRows = asientos.map((a) => {
    const cuenta = String(a[A.cuenta] || '');
    return [
      String(a[A.fecha] || '').slice(0, 10),
      a[A.asientoId] || '',
      cuenta,
      PGC_LABELS[cuenta] || 'Cuenta PGC',
      a[A.concepto] || '',
      Number(a[A.debe] || 0) > 0 ? formatNumES(a[A.debe]) : '',
      Number(a[A.haber] || 0) > 0 ? formatNumES(a[A.haber]) : '',
      a[A.documentoId] || ''
    ];
  });

  const csvDiario = toCsvUtf8Bom([
    'Fecha', 'Num Asiento', 'Cuenta PGC', 'Denominacion PGC', 'Concepto',
    'Importe Debe', 'Importe Haber', 'ID Documento'
  ], diarioRows);

  // 3. 04_Arqueo_Caja
  const arqueoRows = cierresZ.map((z) => [
    String(z.operationDate || z.closeDate || '').slice(0, 10),
    z.startTicketNumber || '',
    z.endTicketNumber || '',
    formatNumES(z.totalCash),
    formatNumES(z.totalCard),
    formatNumES(z.totalBizum),
    formatNumES(z.totalOnline),
    formatNumES(z.totalTaxBase),
    formatNumES(z.totalTaxAmount),
    formatNumES(z.consolidatedTotalAmount),
    formatNumES(z.difference ?? 0),
    z.differenceReason || '',
    z.closingHash || ''
  ]);

  const csvArqueo = toCsvUtf8Bom([
    'Fecha Cierre', 'Ticket Inicio', 'Ticket Fin', 'Total Efectivo', 'Total Tarjeta',
    'Total Bizum', 'Total Online', 'Base Imponible', 'Cuota IVA', 'Total Consolidado',
    'Diferencia Arqueo', 'Motivo Diferencia', 'Hash Cierre Z'
  ], arqueoRows);

  // 4. 05_Registro_Jornada
  const jornadaRows = jornada.map((r) => {
    const st = staffById.get(r[J.staffId]) || {};
    const dt = String(r[J.fechaHora] || '');
    return [
      dt.slice(0, 10),
      r[J.staffNombre] || st.fullName || '',
      st.taxId || '',
      r[J.evento] || '',
      dt.slice(11, 16),
      r[J.minutos] ?? '',
      r[J.motivoAjuste] || '',
      r[J.firmaHmac] ? 'SI' : 'NO',
      r[J.dispositivo] || ''
    ];
  });

  const csvJornada = toCsvUtf8Bom([
    'Fecha', 'Nombre Trabajador', 'DNI/NIF', 'Tipo Registro', 'Hora',
    'Minutos Trabajados', 'Incidencia', 'Validado HMAC', 'Dispositivo'
  ], jornadaRows);

  return {
    csvExpedidas,
    csvDiario,
    csvArqueo,
    csvJornada
  };
}

export function sha256(content) {
  return crypto.createHash('sha256').update(String(content), 'utf8').digest('hex');
}
```

### 3.4. Archivo 2: `src/backend/capa3GraphBridge.js` (Puente seguro Wix → SharePoint Graph API)
Implementa paginación segura (`.hasNext()`), lectura *read-only* de Wix CMS, envío por `PUT` a `Sys_Cola_Web` y bitácora en `Sys_Log_Web`. Incluye modo `dryRun` para cumplir el **Invariante #8** mientras el sitio esté en `NO-GO`.

```javascript
// src/backend/capa3GraphBridge.js
import { fetch } from 'wix-fetch';
import wixData from 'wix-data';
import { getSecret } from 'wix-secrets-backend'; //
import { validateFiscalPackage, buildGestoriaCSVs, sha256 } from 'backend/fiscalExportCore';

async function queryAllByDateRange(collectionName, dateField, startIso, endIso) {
  let query = wixData.query(collectionName).limit(1000);
  if (dateField && startIso && endIso) {
    query = query.ge(dateField, new Date(startIso)).lt(dateField, new Date(endIso));
  }
  let res = await query.find({ suppressAuth: true });
  const items = [...res.items];
  while (res.hasNext()) {
    res = await res.next();
    items.push(...res.items);
  }
  return items;
}

async function getGraphAccessToken() {
  const [tenantId, clientId, clientSecret] = await Promise.all([
    getSecret('M365_TENANT_ID'),
    getSecret('M365_CLIENT_ID'),
    getSecret('M365_CLIENT_SECRET')
  ]);

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials'
  }).toString();

  const resp = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!resp.ok) {
    throw new Error(`Entra ID OAuth error ${resp.status}: ${await resp.text()}`);
  }
  const data = await resp.json();
  return data.access_token;
}

export async function exportPeriodToSharePoint({
  year,
  month,
  domain = 'MENSUAL', // 'MENSUAL' | 'CIERRE_Z'
  traceId,
  dryRun = false
}) {
  const mm = String(month).padStart(2, '0');
  const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const endDate = new Date(Date.UTC(year, month, 1, 0, 0, 0));
  const startIso = startDate.toISOString();
  const endIso = endDate.toISOString();

  // Lectura estricta (Capa 3 solo lee Capas 1 y 2)
  const [movimientos, asientos, cierresZ, jornada, mapaStaff, datosFiscalesArr] = await Promise.all([
    queryAllByDateRange('MovimientosCaja', 'fechaOperacion', startIso, endIso),
    queryAllByDateRange('LibroAsientosContablesDetalle', 'fechaOperacion', startIso, endIso),
    queryAllByDateRange('HistoricoCierresZ', 'operationDate', startIso, endIso),
    queryAllByDateRange('RegistrosHorariosStaff', 'recordedAt', startIso, endIso),
    queryAllByDateRange('MapaStaff', null, null, null),
    queryAllByDateRange('DatosFiscales', null, null, null)
  ]);

  const datosFiscales = datosFiscalesArr[0] || {};
  const validacion = validateFiscalPackage({ movimientos, asientos, cierresZ, jornada });

  const csvs = validacion.ok
    ? buildGestoriaCSVs({ datosFiscales, movimientos, asientos, cierresZ, jornada, mapaStaff })
    : null;

  const payloadObj = {
    schemaVersion: '2.0',
    period: `${year}-${mm}`,
    domain,
    traceId,
    generatedAt: new Date().toISOString(),
    validation: validacion,
    counts: {
      movimientos: movimientos.length,
      asientos: asientos.length,
      cierresZ: cierresZ.length,
      jornada: jornada.length
    },
    cierresZ,
    csvs
  };

  const payloadJson = JSON.stringify(payloadObj);
  const payloadHash = sha256(payloadJson);

  // Registro append-only observacional en HistoricoCierresZ + ControlOperativo (sin nueva coleccion)
  if (!dryRun) {
    await wixData.insert('ControlOperativo', {
      controlType: 'CAPA3_EXPORT',
      dedupeKey: `${domain}_${year}${mm}_${traceId}`,
      traceId,
      status: validacion.ok ? 'SENT_TO_SHAREPOINT' : 'BLOCKED_FAIL_CLOSED',
      processedAt: new Date(),
      payload: JSON.stringify({ counts: payloadObj.counts, errores: validacion.errores, payloadHash })
    }, { suppressAuth: true });

    if (validacion.ok) {
      await wixData.insert('HistoricoCierresZ', {
        recordDomain: 'PAQUETE_GESTORIA',
        closingType: domain,
        fiscalYear: Number(year),
        fiscalPeriod: `${year}-${mm}`,
        operationDate: new Date(),
        closeDate: new Date(),
        closedBy: 'CAPA3_AUTO',
        packageStatus: 'GENERADO',
        packageVersion: '2.0',
        closingHash: payloadHash,
        traceId,
        summaryData: JSON.stringify(payloadObj.counts)
      }, { suppressAuth: true });
    }

    // Subida por Graph API a biblioteca oculta Sys_Cola_Web + lista Sys_Log_Web
    const [siteId, driveId, logListId, token] = await Promise.all([
      getSecret('SP_SITE_ID'),
      getSecret('SP_QUEUE_DRIVE_ID'),
      getSecret('SP_LOG_LIST_ID'),
      getGraphAccessToken()
    ]);

    const fileName = `${domain}_${year}${mm}_${traceId}.json`;
    const putResp = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/root:/${fileName}:/content`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: payloadJson
      }
    );
    if (!putResp.ok) {
      throw new Error(`Graph Drive PUT error ${putResp.status}: ${await putResp.text()}`);
    }

    await fetch(`https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${logListId}/items`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fields: {
          Title: traceId,
          Periodo: `${year}-${mm}`,
          Dominio: domain,
          HashSHA256: payloadHash,
          TotalRegistros: movimientos.length + asientos.length + jornada.length,
          Estado: validacion.ok ? 'OK' : 'ERROR_FAIL_CLOSED',
          DetalleError: validacion.ok ? '' : JSON.stringify(validacion.errores)
        }
      })
    });
  }

  return {
    ok: validacion.ok,
    dryRun,
    period: `${year}-${mm}`,
    traceId,
    payloadHash,
    errores: validacion.errores,
    csvs
  };
}
```

### 3.5. Archivo 3: `src/backend/fiscalDocuments.web.js` (Botón en ZONA MARIAN `#htmlAdmin.txt`)
Protegido con `Permissions.Admin`, permite a Marian tanto **descargar al instante los CSVs en su navegador** como **archivar el paquete en SharePoint**.

```javascript
// src/backend/fiscalDocuments.web.js
import { Permissions, webMethod } from 'wix-web-module'; //
import crypto from 'crypto';
import { exportPeriodToSharePoint } from 'backend/capa3GraphBridge';

export const generateAccountantPackage = webMethod(
  Permissions.Admin,
  async ({ year, month, sendToSharePoint = true, dryRun = false }) => {
    const y = Number(year);
    const m = Number(month);
    if (!Number.isInteger(y) || y < 2024 || y > 2100 || !Number.isInteger(m) || m < 1 || m > 12) {
      throw new Error('Parametros year/month invalidos.');
    }
    const traceId = crypto.randomUUID();
    return await exportPeriodToSharePoint({
      year: y,
      month: m,
      domain: 'MENSUAL',
      traceId,
      dryRun: !sendToSharePoint || dryRun
    });
  }
);
```

### 3.6. Automatización desde el propio cierre de caja y Cron
* **En tu flujo de Cierre Z diario (Capa 2)**: Al finalizar exitosamente la inserción en `HistoricoCierresZ`, llama de forma asíncrona (no bloqueante para el TPV) a `exportPeriodToSharePoint({ year, month, domain: 'CIERRE_Z', traceId })` para que Power Automate genere al instante `Cierre_Z_YYYY-MM-DD.pdf`.
* **En `src/backend/jobs.config` (Cron mensual de Wix)**: Programa el día 1 de cada mes a las `07:30 UTC` la ejecución automática de `exportPeriodToSharePoint` para el mes recién cerrado.

---

## FASE 4: Los 5 Flujos de Power Automate (100 % Conectores Standard)

> **Regla de oro para Triggers en subcarpetas**: En SharePoint Online, si especificas una carpeta padre en el parámetro `Folder` del trigger, no detecta bien subcarpetas dinámicas nuevas. Apunta **siempre** el trigger a la **Biblioteca raíz** (`Archivo Documental`) y filtra con **Trigger Conditions** en `Configuración` del trigger.

### Flujo 1: `Capa3_Ingesta_Web_Wix`
* **Trigger**: `SharePoint → When a file is created (properties only)` sobre la biblioteca oculta **`Sys_Cola_Web`**.
* **Pasos**:
  1. `Get file content` → `Parse JSON` (del payload de Wix).
  2. **Condición**: `validation.ok` es `true`?
     * **Si NO (`false`)**: `Office 365 Outlook → Send an email (V2)` a Marian (y tarjeta Teams) listando `validation.errores` con los números de ticket/asiento a corregir. Termina aquí (Fail-Closed).
     * **Si SÍ (`true`)**:
       * Si `domain == "MENSUAL"`: Crea/actualiza en `Archivo Documental/2026/2026-MM/` los archivos `01_Facturas_Expedidas_YYYYMM.csv`, `03_Libro_Diario_PGC_YYYYMM.csv`, `04_Arqueo_Caja_YYYYMM.csv` y `05_Registro_Jornada_YYYYMM.csv` (contenido directo `csvs.csvExpedidas`, etc.).
       * Asegura las 4 subcarpetas (`01_Cierres_Z_y_Tickets`, `02_Banco_y_Pasarelas`, `03_Facturas_Proveedores_PDF`, `04_Laboral`).
       * Ejecuta `Send an HTTP request to SharePoint` sobre `04_Laboral` para romper herencia y dejar acceso exclusivo a Marian y al Asesor Laboral.

### Flujo 2: `Capa3_CierreZ_Diario_PDF` (Gratis vía OneDrive)
* **Trigger**: `SharePoint → When a file is created (properties only)` sobre **`Sys_Cola_Web`**.
* **Trigger Condition**: `@contains(triggerOutputs()?['body/{FilenameWithExtension}'], 'CIERRE_Z_')`
* **Pasos**:
  1. `Get file content` + `Parse JSON` → extrae el último registro de `cierresZ`.
  2. `Compose`: construye la ficha HTML del Cierre Z (Fecha, Ticket inicio/fin, Efectivo, Tarjeta, Bizum, Online, Base, IVA, Diferencia + motivo, `startRecordHash`, `endRecordHash`, `closingHash`).
  3. `OneDrive for Business → Create file` (`/TempCierreZ/Cierre_Z_YYYY-MM-DD.html`).
  4. `OneDrive for Business → Convert file` (**Target type: `PDF`** — conector Standard).
  5. `SharePoint → Create file` en `Archivo Documental/2026/2026-MM/01_Cierres_Z_y_Tickets/Cierre_Z_YYYY-MM-DD.pdf`.
  6. `OneDrive for Business → Delete file` (borra el `.html` temporal).

### Flujo 3: `Capa3_Proveedores_Email_y_PDF`
* **Trigger A (Correo)**: `Office 365 Outlook → When a new email arrives (V3)` *(filtra asunto `[FACTURA]` o reenvío a carpeta/regla de proveedores)* → guarda cada adjunto PDF/JPG directamente en `Archivo Documental/2026/2026-MM/03_Facturas_Proveedores_PDF/`.
* **Trigger B (Carpeta)**: `SharePoint → When a file is created (properties only)` en biblioteca `Archivo Documental` con **Trigger Condition**:
  `@and(equals(triggerOutputs()?['body/{IsFolder}'], false), contains(triggerOutputs()?['body/{Path}'], '/03_Facturas_Proveedores_PDF/'))`
* **Pasos del Trigger B**:
  1. Envía tarjeta de aprobación / solicitud de datos en **Teams (`Post adaptive card and wait for a response`)** a Marian con enlace al PDF para confirmar en 10 seg: `NIF`, `Proveedor`, `Nº Factura`, `Base`, `% IVA`, `% IRPF (0/15/19)`, `Cuenta PGC (600/602/621/623/628/629)` y `Intra-UE (Sí/No)`.
  2. Inserta el registro en la lista oculta **`Sys_Proveedores`**.
  3. Con `Get items` (filtrado por `Periodo`) → `Select` → `Create CSV table` (prefijo `\uFEFF` y `;`), regenera automáticamente **`02_Facturas_Recibidas_YYYYMM.csv`** en la raíz de `2026/2026-MM/`.

### Flujo 4: `Capa3_Conciliador_Banco_Norma43` (Office Script Excel Online)
* **Trigger**: `SharePoint → When a file is created (properties only)` en biblioteca `Archivo Documental` con **Trigger Condition**:
  `@and(equals(triggerOutputs()?['body/{IsFolder}'], false), contains(triggerOutputs()?['body/{Path}'], '/02_Banco_y_Pasarelas/'), endsWith(toLower(triggerOutputs()?['body/{FilenameWithExtension}']), '.n43'))`
* **Pasos**:
  1. `Get file content` del `.n43`.
  2. Copia una plantilla vacía `Conciliacion_Plantilla.xlsx` a `2026/2026-MM/02_Banco_y_Pasarelas/Conciliacion_YYYYMM.xlsx`.
  3. Invoca **`Excel Online (Business) → Run script`** pasando como parámetro el texto crudo del `.n43`.
     * **Código TypeScript del Office Script (`ParsearNorma43.osts`)** para copiar directamente en Excel Online → *Automatizar → Nuevo script*:

```typescript
function main(workbook: ExcelScript.Workbook, n43RawText: string) {
  const lines = n43RawText.split(/\r?\n/).filter(l => l.trim().length >= 80);
  const sheetMov = workbook.getWorksheet("Movimientos_N43") || workbook.addWorksheet("Movimientos_N43");
  sheetMov.getUsedRange()?.clear();

  const headers = ["Fecha Operacion", "Fecha Valor", "Codigo AEB", "Importe EUR", "Signo", "Documento", "Concepto", "Cuenta Sugerida PGC"];
  const rows: (string | number)[][] = [headers];

  let saldoInicial = 0;
  let saldoFinalDeclarado = 0;
  let sumaMovs = 0;
  let lastConcepto = "";

  for (const line of lines) {
    const reg = line.slice(0, 2);
    if (reg === "11") {
      const signoIni = line.slice(32, 33) === "1" ? -1 : 1;
      saldoInicial = (parseInt(line.slice(33, 47), 10) / 100) * signoIni;
    } else if (reg === "22") {
      const fOp = `20${line.slice(10, 12)}-${line.slice(12, 14)}-${line.slice(14, 16)}`;
      const fVal = `20${line.slice(16, 18)}-${line.slice(18, 20)}-${line.slice(20, 22)}`;
      const codAEB = line.slice(22, 24);
      const debeHaber = line.slice(27, 28); // 1=Debe(Cargo), 2=Haber(Abono)
      const imp = parseInt(line.slice(28, 42), 10) / 100;
      const signedImp = debeHaber === "1" ? -imp : imp;
      sumaMovs += signedImp;
      const doc = line.slice(42, 52).trim();
      const ref1 = line.slice(52, 64).trim();
      const ref2 = line.slice(64, 80).trim();
      rows.push([fOp, fVal, codAEB, signedImp, debeHaber === "1" ? "CARGO" : "ABONO", doc, `${ref1} ${ref2}`.trim(), ""]);
    } else if (reg === "23" && rows.length > 1) {
      lastConcepto = `${line.slice(4, 42).trim()} ${line.slice(42, 80).trim()}`.trim();
      const idx = rows.length - 1;
      rows[idx][6] = `${rows[idx][6]} | ${lastConcepto}`.trim();
      const txt = String(rows[idx][6]).toUpperCase();
      if (txt.includes("STRIPE") || txt.includes("REDSYS") || txt.includes("TPV") || txt.includes("COMERCIO")) {
        rows[idx][7] = Number(rows[idx][3]) > 0 ? "5729 (Liquidacion Pasarela)" : "626 (Comision TPV)";
      } else if (txt.includes("AEAT") || txt.includes("HACIENDA")) {
        rows[idx][7] = "4750/4751 (Impuestos AEAT)";
      } else if (txt.includes("TGSS") || txt.includes("SEG.SOCIAL")) {
        rows[idx][7] = "476 (Seguridad Social)";
      } else if (txt.includes("COMISION") || txt.includes("MANTENIMIENTO")) {
        rows[idx][7] = "626 (Comision Bancaria)";
      } else if (txt.includes("NOMINA")) {
        rows[idx][7] = "465/640 (Nominas)";
      }
    } else if (reg === "33") {
      const signoFin = line.slice(58, 59) === "1" ? -1 : 1;
      saldoFinalDeclarado = (parseInt(line.slice(59, 73), 10) / 100) * signoFin;
    }
  }

  sheetMov.getRangeByIndexes(0, 0, rows.length, headers.length).setValues(rows);

  const sheetResumen = workbook.getWorksheet("Resumen_Cuadre") || workbook.addWorksheet("Resumen_Cuadre");
  sheetResumen.getUsedRange()?.clear();
  const cuadreOk = Math.abs((saldoInicial + sumaMovs) - saldoFinalDeclarado) < 0.02;
  sheetResumen.getRange("A1:B5").setValues([
    ["Saldo Inicial N43", saldoInicial],
    ["Variacion Neta Movimientos", sumaMovs],
    ["Saldo Calculado", saldoInicial + sumaMovs],
    ["Saldo Final Declarado Reg.33", saldoFinalDeclarado],
    ["Estado Cuadre N43", cuadreOk ? "OK CUADRADO" : "ERROR DESCUADRE"]
  ]);
  return { cuadreOk, movimientos: rows.length - 1, saldoFinal: saldoFinalDeclarado };
}
```
  4. Si `cuadreOk == false`, crea incidencia en `Sys_Incidencias` y envía email a Marian. Si `true`, genera `Extracto_Banco_YYYYMM.csv` y avisa a Marian y al Contable.

### Flujo 5: `Capa3_Sellado_Mensual_Solo_Lectura`
* **Trigger**: Día 5 de cada mes a las `09:00` (o manual desde Teams tras confirmar N43 y últimos gastos).
* **Pasos**:
  1. Comprueba en `Sys_Incidencias` que hay **0 incidencias sin resolver** para el periodo `YYYY-MM`.
  2. Crea `LEEME_YYYYMM.txt` y `HASH_YYYYMM.txt` en `Archivo Documental/2026/2026-MM/`.
  3. **Bloqueo Solo Lectura (sin Purview Premium)** mediante **`SharePoint → Send an HTTP request to SharePoint`**:
     * **Paso A** — Romper herencia eliminando permisos de edición previos:
       * Método: `POST`
       * URI: `/_api/web/GetFolderByServerRelativeUrl('/sites/MarianMadridArchivo/Archivo%20Documental/2026/2026-MM')/ListItemAllFields/breakroleinheritance(copyRoleAssignments=false,clearSubscopes=true)`
     * **Paso B** — Reasignar **Solo Lectura (`roledefid=1073741826`)** al grupo de Marian (Visitantes/Miembros) y al del Contable (excepto `04_Laboral` si es asesor distinto):
       * Método: `POST`
       * URI: `/_api/web/GetFolderByServerRelativeUrl('/sites/MarianMadridArchivo/Archivo%20Documental/2026/2026-MM')/ListItemAllFields/roleassignments/addroleassignment(principalid=<ID_GRUPO>,roledefid=1073741826)`
  4. Envía email final por **Outlook** a Marian y al Contable con el enlace directo a `2026/2026-MM/`.

---

## FASE 5: Configuración de Microsoft 365 Copilot

1. En SharePoint (`Archivo Documental/2026/`), haz clic en **Crear un agente** (Copilot en SharePoint, incluido en tu plan Copilot):
   * **Nombre**: `Asistente Fiscal Marian Madrid`
   * **Ámbito**: únicamente la carpeta `2026/` (nunca carpetas del sistema).
   * **Instrucciones del agente**:
     > *"Eres el asistente administrativo de Marian Madrid Peluquería y Estética (España). Respondes siempre en español claro, sin jerga informática. Para ingresos revisa `01_Facturas_Expedidas` y `04_Arqueo_Caja`; para gastos revisa `02_Facturas_Recibidas` y la subcarpeta `03_Facturas_Proveedores_PDF`; para banco revisa `02_Banco_y_Pasarelas/Conciliacion`. Nunca inventes cifras; si falta un archivo o hay un descuadre, indícalo con exactitud."*
2. Como Copilot hereda los permisos nativos de SharePoint, el contable o cualquier usuario **solo puede consultar aquello sobre lo que ya tiene permiso de lectura**.

---

## FASE 6: Pruebas sin riesgo (`NO-GO`) y Paso a Producción

Para respetar los **Invariantes #8 y #9** del repositorio `nachoortegazgz/marianmadridz` mientras la web permanezca en `Draft / NO-GO`:

1. **Test Unitario Offline (`tests/fiscalDocuments.test.mjs`)**: Añade tests a la suite CI de Capa 0 comprobando:
   * Rechazo *fail-closed* de factura con `Base + IVA ≠ Total`, asiento con `Debe ≠ Haber`, Cierre Z con descuadre sin motivo y fichaje sin `signature` HMAC.
   * Generación exacta de CSV UTF-8 BOM con `;` y minimización RGPD (`"Consumidor Final"` en ventas B2C sin NIF).
   * Ejecución de `exportPeriodToSharePoint(..., { dryRun: true })` sin invocar Graph API ni mutar `CajaActual`.
2. **Test de Integración Controlado (Carpeta `2026-00-PRUEBAS/`)**:
   * Ejecuta `generateAccountantPackage({ year: 2026, month: 11, sendToSharePoint: true })` con datos sintéticos (nunca usar la caja singleton abierta real como *fixture*), comprueba que aparecen los 4 CSVs en SharePoint, suelta un `.n43` de prueba en `02_Banco_y_Pasarelas/` y verifica que el Contable entra como invitado B2B y descarga el ZIP completo.
3. **Checklist de Go-Live (`www.marianmadrid.es`)**:
   * [ ] Cotejados todos los *keyfields* de `FIELD_MAP` contra `docs/ESQUEMA_CMS.md` (27-11-2026).
   * [ ] Los 6 secretos cargados en **Wix Secrets Manager**.
   * [ ] App `Wix-MarianMadrid-Capa3` limitada con `Sites.Selected` únicamente a `MarianMadridArchivo`.
   * [ ] Contable validó la importación de los 5 CSVs y el `.n43` en su software (A3/Sage/Holded).
   * [ ] Autorización expresa de publicación del sitio (fin de estado `NO-GO`).


Este anexo completa el dossier técnico con plantillas listas para copiar y
pegar, tablas de referencia rápida (fiscalidad, PGC y AEAT), trucos
profesionales de Power Automate y SharePoint, flujos de apoyo extra y una guía
de uso seguro de Copilot e IA pensada para el día a día de la peluquería.

1. Plantillas Listas para Copiar y Pegar

1.1. Plantilla LEEME_YYYYMM.txt (Doble lectura: Marian + Contable)

========================================================================
PAQUETE DOCUMENTAL MENSUAL - MARIAN MADRID PELUQUERÍA Y ESTÉTICA
Periodo: [YYYY-MM] | Generado el: [DD/MM/YYYY HH:MM]
Estado de validación automática: ✅ CORRECTO (0 descuadres bloqueantes)
========================================================================

[PARA MARIAN]
• Todos los datos de tu web (TPV salón, tienda online, cierres Z y fichajes)
  se han validado matemáticamente y guardado en modo Solo Lectura.
• No necesitas editar ni mover ningún archivo.

[PARA EL CONTABLE / ASESORÍA]
Formato de los CSV: UTF-8 con BOM, delimitador punto y coma (;), decimal coma (,).
Compatibles directamente con A3, Sage, Contasol y Holded.

ARCHIVOS PRINCIPALES EN ESTA CARPETA:
1. 01_Facturas_Expedidas_YYYYMM.csv  -> Series TS (Ticket), FS (Completa), ON (Online), R (Rectif.)
2. 02_Facturas_Recibidas_YYYYMM.csv  -> Gastos, IRPF (4751) e Intra-UE ISP (Mod. 349/303)
3. 03_Libro_Diario_PGC_YYYYMM.csv    -> Asientos partida doble (incluye 5729 pasarelas y 438 bonos)
4. 04_Arqueo_Caja_YYYYMM.csv         -> Resumen diario Cierres Z, efectivo, tarjeta, bizum, online
5. 05_Registro_Jornada_YYYYMM.csv    -> Fichajes RD-ley 8/2019 verificados con firma HMAC

CARPETAS DE SOPORTE:
• 01_Cierres_Z_y_Tickets/     -> PDF diario de cada Cierre Z + detalle tickets
• 02_Banco_y_Pasarelas/       -> Extracto N43 original, CSV parseado y Conciliacion_YYYYMM.xlsx
• 03_Facturas_Proveedores_PDF/-> Facturas originales vinculadas por fecha y proveedor
• 04_Laboral/                 -> Nóminas, RLC y RNT (acceso restringido laboral)

Integridad criptográfica verificable en: HASH_YYYYMM.txt

1.2. Plantilla HASH_YYYYMM.txt (Cadena de integridad mes a mes)

MANIFIESTO DE INTEGRIDAD SHA-256 — MARIAN MADRID (CAPA 3)
Periodo: 2026-11
TraceId Exportacion Wix: [traceId]
Fecha de sellado: [YYYY-MM-DDTHH:MM:SSZ]
Hash paquete mes anterior (2026-10): [HASH_MES_ANTERIOR_O_GENESIS]

ARCHIVOS SELLADOS:
- 01_Facturas_Expedidas_202611.csv : [sha256]
- 02_Facturas_Recibidas_202611.csv : [sha256]
- 03_Libro_Diario_PGC_202611.csv   : [sha256]
- 04_Arqueo_Caja_202611.csv        : [sha256]
- 05_Registro_Jornada_202611.csv   : [sha256]
- Extracto_N43_202611.n43          : [sha256]

HASH CONSOLIDADO DEL PAQUETE: [sha256_de_todo_el_manifiesto]

1.3. Plantilla HTML para el Flujo 2 (Cierre_Z_YYYY-MM-DD.pdf vía OneDrive)

Pega esto en la acción Compose del Flujo 2 antes de enviarlo a OneDrive for
Business → Create file y Convert file (PDF):

<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<style>
  body { font-family: Arial, sans-serif; color: #222; margin: 28px; font-size: 12px; }
  h1 { font-size: 18px; border-bottom: 2px solid #111; padding-bottom: 6px; margin-bottom: 4px; }
  .meta { color: #555; margin-bottom: 18px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th, td { border: 1px solid #ccc; padding: 7px 10px; text-align: left; }
  th { background: #f3f3f3; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .box { background: #fafafa; border: 1px solid #ddd; padding: 10px; font-family: monospace; font-size: 10px; word-break: break-all; }
</style>
</head>
<body>
  <h1>CIERRE Z DIARIO DE CAJA — MARIAN MADRID</h1>
  <div class="meta">
    Fecha operación: <strong>@{outputs('CierreZ')?['operationDate']}</strong> |
    Cerrado por: <strong>@{outputs('CierreZ')?['closedBy']}</strong> |
    TraceId: @{outputs('CierreZ')?['traceId']}
  </div>

  <table>
    <tr><th>Rango de Tickets</th><td class="num">@{outputs('CierreZ')?['startTicketNumber']} → @{outputs('CierreZ')?['endTicketNumber']}</td></tr>
    <tr><th>Total Ventas Efectivo</th><td class="num">@{outputs('CierreZ')?['totalCash']} €</td></tr>
    <tr><th>Total Cobros Tarjeta (Datáfono)</th><td class="num">@{outputs('CierreZ')?['totalCard']} €</td></tr>
    <tr><th>Total Cobros Bizum</th><td class="num">@{outputs('CierreZ')?['totalBizum']} €</td></tr>
    <tr><th>Total Venta Online</th><td class="num">@{outputs('CierreZ')?['totalOnline']} €</td></tr>
    <tr><th>Base Imponible Consolidada</th><td class="num">@{outputs('CierreZ')?['totalTaxBase']} €</td></tr>
    <tr><th>Cuota IVA Repercutido</th><td class="num">@{outputs('CierreZ')?['totalTaxAmount']} €</td></tr>
    <tr><th><strong>TOTAL CONSOLIDADO DÍA</strong></th><td class="num"><strong>@{outputs('CierreZ')?['consolidatedTotalAmount']} €</strong></td></tr>
    <tr><th>Diferencia Arqueo / Motivo</th><td class="num">@{outputs('CierreZ')?['difference']} € — @{outputs('CierreZ')?['differenceReason']}</td></tr>
  </table>

  <div class="box">
    <strong>Integridad Criptográfica (Cadena de Registros):</strong><br/>
    Hash Inicial: @{outputs('CierreZ')?['startRecordHash']}<br/>
    Hash Final: @{outputs('CierreZ')?['endRecordHash']}<br/>
    Hash Cierre Z: @{outputs('CierreZ')?['closingHash']}
  </div>
</body>
</html>

1.4. Tarjeta Adaptativa JSON para Teams (Flujo 3: Clasificar factura de proveedor en 10 seg)

Úsala en Microsoft Teams → Post adaptive card and wait for a response cuando
entre un PDF nuevo en 03_Facturas_Proveedores_PDF/:

{
  "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
  "type": "AdaptiveCard",
  "version": "1.4",
  "body": [
    { "type": "TextBlock", "text": "🧾 Nueva factura de proveedor detectada", "weight": "Bolder", "size": "Medium" },
    { "type": "TextBlock", "text": "Archivo: ${NombreArchivoPDF}", "wrap": true, "isSubtle": true },
    { "type": "Input.Text", "id": "proveedor", "label": "Nombre Proveedor", "isRequired": true },
    { "type": "Input.Text", "id": "nif", "label": "NIF / VAT Proveedor", "isRequired": true },
    { "type": "Input.Text", "id": "numFactura", "label": "Nº Factura", "isRequired": true },
    { "type": "Input.Date", "id": "fecha", "label": "Fecha Factura", "isRequired": true },
    { "type": "Input.Number", "id": "base", "label": "Base Imponible (€)", "isRequired": true },
    {
      "type": "Input.ChoiceSet", "id": "iva", "label": "% IVA", "value": "21",
      "choices": [
        { "title": "21% General", "value": "21" },
        { "title": "10% Reducido", "value": "10" },
        { "title": "0% Exento / Intra-UE ISP", "value": "0" }
      ]
    },
    {
      "type": "Input.ChoiceSet", "id": "irpf", "label": "% Retención IRPF", "value": "0",
      "choices": [
        { "title": "0% (Sin retención)", "value": "0" },
        { "title": "15% (Profesional - Mod. 111)", "value": "15" },
        { "title": "19% (Alquiler local - Mod. 115)", "value": "19" }
      ]
    },
    {
      "type": "Input.ChoiceSet", "id": "cuenta", "label": "Tipo de Gasto (PGC)", "value": "602",
      "choices": [
        { "title": "600 - Cosmética para reventa", "value": "600" },
        { "title": "602 - Tintes/Material consumo salón", "value": "602" },
        { "title": "621 - Alquiler local", "value": "621" },
        { "title": "623 - Gestoría / Abogados / Profesionales", "value": "623" },
        { "title": "628 - Luz / Agua / Internet", "value": "628" },
        { "title": "629 - Software / Publicidad / Varios", "value": "629" }
      ]
    },
    { "type": "Input.Toggle", "id": "intraUE", "title": "Es factura extranjera Intra-UE (Wix, Meta, Google, Stripe → Mod. 349)", "value": "false" }
  ],
  "actions": [
    { "type": "Action.Submit", "title": "Guardar en Libro de Facturas Recibidas" }
  ]
}

1.5. Plantillas CSV adicionales para 05_Contabilidad_PGC/ y Documentacion_Empresa/

  - Inventario Mensual (Inventario_Valorado_YYYYMM.csv):
    SKU;Producto;Categoria;Uso (REVENTA_300/CABINA_602);Stock Inicial;Entradas;Salidas Venta;Consumo Cabina;Mermas;Stock Final;Coste Unitario;Valoracion Stock
  - Registro de Actividades de Tratamiento RGPD (RAT_MarianMadrid.csv en
    03_RGPD_LOPDGDD/):
    Actividad;Finalidad;Base Juridica;Categorias Datos;Encargados (Wix/M365/Stripe/Gestor);Plazo Conservacion
    Agenda Citas y Alergias;Prestacion servicio y seguridad cliente;Ejecucion contrato + Consentimiento;Nombre, Telefono, Notas alergia tinte;Wix + Microsoft;Duracion relacion + 3 anos bloqueo
    Facturacion TPV y Online;Cumplimiento fiscal y mercantil;Obligacion legal (LGT/C.Comercio);NIF/Nombre (solo B2B o >limites);Wix + Microsoft + Gestoria;6 anos
    Registro Horario y Nominas;Gestion laboral y control jornada;Obligacion legal (ET Art. 34.9);DNI, Nombre, Fichajes HMAC, Nominas;Wix + Microsoft + Asesor Laboral;4 anos fichajes / 5 anos nominas

2. Datos de Referencia Rápida (Normativa España 2026)

2.1. Calendario Fiscal del Negocio (¡Cuidado con la domiciliación!)

El plazo para domiciliar el pago en el banco vence normalmente 5 días antes que
el plazo general (por ejemplo, día 15 en lugar de día 20, o día 25/27 en enero):

| Periodo                 | Domiciliación límite (aprox.)           | Plazo límite general AEAT                               | Modelos habituales Peluquería + Ecommerce                                                                                                             |
| ----------------------- | --------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1T (Ene–Mar)**        | 15 de abril                             | 20 de abril                                             | **303** (IVA), **111** (Nóminas/Profesionales), **115** (Alquiler), **130** (IRPF Autónomo) o **202** (IS si SL), **349** (Intra-UE: Wix/Meta/Google) |
| **2T (Abr–Jun)**        | 15 de julio                             | 20 de julio                                             | **303, 111, 115, 130, 349** (+ **Mod. 200** Impuesto Sociedades hasta 25 julio si es SL)                                                              |
| **3T (Jul–Sep)**        | 15 de octubre                           | 20 de octubre                                           | **303, 111, 115, 130/202, 349**                                                                                                                       |
| **4T (Oct–Dic)**        | 15 ene (`111/115`) / 27 ene (`303/130`) | 20 ene (`111/115/349`) / 30 ene (`303/130/390/190/180`) | Trimestrales 4T + **Resúmenes anuales: 390 (IVA), 190 (IRPF), 180 (Alquileres)**                                                                      |
| **Informativa Febrero** | —                                       | 28/29 de febrero                                        | **347** (Operaciones con terceros \> 3.005,06 € al año)                                                                                               |
| **Renta / Anual**       | 25 de junio                             | 30 de junio                                             | **Mod. 100** (Renta si es autónoma)                                                                                                                   |

2.2. Guía Express de Clasificación de Gastos para Marian

  - Alquiler del salón: Cuenta 621 · IVA 21% · Retención IRPF 19% (Mod. 115).
  - Wix / Meta Ads / Google Ads / Microsoft 365 / Stripe: Si facturan desde
    Irlanda/UE sin IVA español → marca Intra-UE (ISP) · Cuenta 629 (o 626
    Stripe/bancos) → va al Mod. 349 y se autorrepercute en Mod. 303.
  - L'Oréal / Wella / Schwarzkopf:
      - Si es para usar en lavacabezas/coloración → 602 (Material de cabina).
      - Si es champú/sérum para vender al cliente → 600 (Mercaderías). (Si
        vienen en la misma factura, pedir al proveedor o anotar el desglose).
  - Gestoría / Abogado / Diseñador web autónomo: Cuenta 623 · IVA 21% ·
    Retención IRPF 15% (Mod. 111).

3. Trucos y Consejos Profesionales (Power Automate + SharePoint)

1.  Patrón Try / Catch / Finally obligatorio en los 5 Flujos (cero fallos
    silenciosos):
      - En Power Automate, mete todas las acciones principales dentro de un
        Scope llamado Try, y justo debajo crea un Scope llamado Catch.
      - Pulsa ... en Catch → Configure run after → marca has failed, is skipped
        y has timed out.
      - Dentro de Catch, registra el fallo con @result('Try') en la lista oculta
        Sys_Incidencias y envía a Marian un email con el enlace directo a la
        ejecución fallida usando la expresión workflow(). Así nunca falla un
        flujo en silencio.
2.  Control de Concurrencia (Concurrency Control) solo donde toca:
      - En el Flujo 3 (Proveedores) al regenerar
        02_Facturas_Recibidas_YYYYMM.csv, activa en el trigger Settings →
        Concurrency Control = On con Degree of Parallelism = 1 para evitar que
        si llegan 3 facturas por correo a la vez se pisen al sobrescribir el
        CSV.
      - En los flujos de ingesta masiva que no deben perder ni un solo evento en
        ráfagas rápidas, déjalo desactivado para no provocar ejecuciones
        canceladas.
3.  Renombrado automático de PDFs de proveedores:
      - Configura el Flujo 3 para que, al responder la tarjeta de Teams,
        renombre el archivo en 03_Facturas_Proveedores_PDF/ al formato
        YYYY-MM-DD_PROVEEDOR_NUMFACTURA.pdf. Tanto Marian como el contable
        encontrarán cualquier factura en 2 segundos sin abrir ni un PDF.
4.  Reglas de Outlook "Cero Clics" para facturas fijas:
      - Crea en Outlook una regla automática: De iberdrola@ / wix.com / meta.com
        / stripe.com / distribuidor@ Y con datos adjuntos → Mover a carpeta
        Facturas_Auto (o marcar categoría Proveedor). El Flujo 3 vigila esa
        carpeta y las archiva sin que Marian reenvíe nada manualmente.
5.  Acceso directo en el PC de la recepción (sin descargar duplicados):
      - En SharePoint, dentro de Archivo Documental/2026/, pulsa "Agregar acceso
        directo a OneDrive" (mejor que "Sincronizar" clásico). Marian podrá
        arrastrar el .n43 del banco o fotos de tickets desde el Explorador de
        Windows directo a la carpeta del mes como si fuera un disco duro local.
6.  Entrega limpia ante una Inspección AEAT:
      - Si algún día llega un requerimiento de un trimestre concreto, no
        compartas todo SharePoint: entra en la carpeta de los 3 meses pedidos,
        descarga el ZIP o comparte una copia de 01_Facturas_Expedidas,
        02_Facturas_Recibidas, 03_Libro_Diario_PGC, 01_Cierres_Z_y_Tickets y
        02_Banco_y_Pasarelas. Dejas fuera 04_Laboral/ y datos de alergias de
        clientes (RGPD).

4. Flujos de Trabajo Adicionales Útiles (100 % Conectores Standard)

Una vez en marcha los 5 flujos nucleares, estos 3 mini-flujos multiplican el
control del negocio en menos de 1 hora de montaje:

1.  Flujo 6 — Preparador Automático de Trimestre AEAT (Recurrence):
      - Se dispara los días 1 de abril, 1 de julio, 1 de octubre y 2 de enero a
        las 09:00.
      - Crea la subcarpeta Impuestos_2026/T1 (o T2/T3/T4), verifica en
        Sys_Incidencias que los 3 meses del trimestre están cerrados a 0
        errores, y manda un email conjunto a Marian y al Contable con el enlace
        directo a los 3 meses + recordatorio de la fecha límite de domiciliación
        (día 15).
2.  Flujo 7 — Monitor de Bonos (438) y Descuadres de Caja (Daily Digest):
      - Cada domingo a las 20:00 lee Sys_Log_Web y Sys_Incidencias de la semana
        y manda un único resumen semanal en Teams a Marian: total vendido
        semana, cierres Z cuadrados o con diferencia, y facturas pendientes de
        clasificar en Teams Approvals.
3.  Flujo 8 — Guardián RGPD y Caducidad de Retención (Semestral):
      - Cada 6 meses revisa carpetas con más de 6 años (fiscal/contable) o 4
        años (fichajes 05_Registro_Jornada si están aislados) y envía una
        aprobación a Marian para autorizar la supresión/anonimización
        reglamentaria conforme al RGPD.

5. Herramientas de IA y Biblioteca de Prompts para Copilot

Regla de Oro de Seguridad RGPD con la IA

  - SÍ usar: Microsoft 365 Copilot (dentro de SharePoint, Excel, Outlook y
    Teams), porque opera bajo el contrato empresarial de Microsoft 365 sin salir
    del tenant ni entrenar modelos públicos.
  - NUNCA hacer: Subir PDFs de nóminas, fichajes con DNI, extractos bancarios o
    listados con nombres/alergias de clientes a versiones gratuitas externas
    (ChatGPT gratuito, convertidores online de PDF, etc.).

Prompts Listos para que Marian use en su Agente de SharePoint (Asistente Fiscal Marian Madrid)

  - Cierre semanal / mensual:
    "Revisa los archivos de 2026/2026-11/ y dime: 1) si hay días del mes sin su
    Cierre_Z en 01_Cierres_Z_y_Tickets/, 2) cuánto suman las facturas expedidas
    separando servicios (705) de productos (700), y 3) si en
    Conciliacion_202611.xlsx queda algún movimiento bancario pendiente de
    justificante."
  - Control de gastos antes del trimestre:
    "Compara las líneas de 02_Facturas_Recibidas_202611.csv contra los archivos
    PDF en 03_Facturas_Proveedores_PDF/ e indícame si falta algún PDF o si hay
    facturas marcadas como Intra-UE para avisar al gestor del Modelo 349."
  - Redacción profesional para la gestoría (Copilot en Outlook):
    "Redacta un correo breve y profesional para mi contable indicando que ya
    tiene disponible en SharePoint la carpeta cerrada de noviembre 2026 con
    los 5 CSVs, el extracto Norma 43 conciliado y los PDFs de proveedores.
    Menciona que el alquiler lleva retención del 19% (Mod. 115) y que hay 2
    facturas de Meta/Wix intracomunitarias (Mod. 349)."
  - Detección de anomalías (Copilot en Excel sobre Conciliacion_202611.xlsx):
    "Analiza la hoja Movimientos_N43, agrupa las comisiones bancarias y de
    pasarela (626), y calcula qué porcentaje representan sobre el total
    ingresado por datáfono y Stripe este mes."


	