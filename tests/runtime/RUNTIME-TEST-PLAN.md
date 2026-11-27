# Runtime test plan — Wix Preview TPV gates

**Estado de ejecución (2026-11-27):**
- TinyFish run `946abe74-37c6-41fc-bf5f-d449a6f5f8c0`: Wix Dashboard redirigió a `https://users.wix.com/signin`; no había sesión autenticada. Preview y página TPV inaccesibles.
- Wix MCP `ExecuteWixAPI`: tres probes GET de solo lectura a `https://www.marianmadrid.es/_functions-dev/{cerrarSesionCaja,generarTicketX,exportarMovimientos}` devolvieron HTTP 403: `Forbidden: requests to www.marianmadrid.es not allowed`. El wrapper permite llamadas a Wix APIs, pero no al dominio del sitio; no invoca Velo WebMethods.
- No se ejecutó ningún gate ni se mutaron registros. Runtime pendiente de sesión Wix autenticada.

## Precondiciones

1. Abrir Wix Editor → Preview del sitio Marian Madrid, sin publicar.
2. Iniciar sesión con un miembro Wix que tenga rol ADMIN efectivo.
3. Disponer de una sesión TPV de prueba abierta y confirmada como sintética. No ejecutar contra una sesión real ni contra una sesión cuya naturaleza no esté acreditada.
4. Tener a mano `sessionId`, efectivo contado y rango UTC que cubra los movimientos de prueba.
5. Ejecutar en el código de página TPV temporalmente (no publicar) el snippet siguiente. La llamada a Ticket X debe preceder al cierre: `generarTicketX` rechaza una sesión ya cerrada.

## Invocación de WebMethods en Preview

Velo WebMethods se consumen desde código frontend importando el módulo `.web.js`; no son endpoints REST `/_functions-dev/<nombre>` invocables por Wix MCP. En el código de página TPV, añadir temporalmente este bloque, sustituir los cuatro valores `REEMPLAZAR_...` y abrir Preview:

```js
import wixData from "wix-data";
import { generarTicketX } from "backend/tpv/tpvCierres.web";
import { cerrarSesionCaja } from "backend/tpv/tpvCaja.web";
import { exportarMovimientos } from "backend/tpv/tpvExport.web";

$w.onReady(async () => {
  const sessionId = "REEMPLAZAR_SESSION_ID_SINTETICA";
  const countedCash = REEMPLAZAR_EFECTIVO_CONTADO_NUMERICO;
  const desde = "REEMPLAZAR_INICIO_UTC_ISO";
  const hasta = "REEMPLAZAR_FIN_UTC_ISO";

  // 1) Ticket X: debe ejecutarse mientras la sesión siga ABIERTA.
  const ticketX = await generarTicketX({ sessionId });
  console.info("RUNTIME_GATE_TICKET_X", JSON.stringify(ticketX));

  // 2) Export JSON: cursor inicial; si hasMore=true, pedir la siguiente página.
  const page1 = await exportarMovimientos({
    desde, hasta, formato: "json", sessionId, cursor: 0
  });
  console.info("RUNTIME_GATE_EXPORT_PAGE_1", JSON.stringify(page1));
  let page2 = null;
  if (page1?.status === "SUCCESS" && page1.hasMore === true) {
    page2 = await exportarMovimientos({
      desde, hasta, formato: "json", sessionId, cursor: page1.nextCursor
    });
    console.info("RUNTIME_GATE_EXPORT_PAGE_2", JSON.stringify(page2));
  }

  // 3) Cierre: último, porque cambia la sesión a CERRADA.
  const close = await cerrarSesionCaja({
    sessionId,
    arqueo: { contadoEfectivo: countedCash },
    observaciones: "QA runtime Preview — sesión sintética"
  });
  console.info("RUNTIME_GATE_CLOSE", JSON.stringify(close));

  // Read-back de persistencia en CMS. Puede requerir permisos de lectura
  // de colección para el miembro ADMIN; un error de permisos es FAIL de verificación.
  const movementRead = await wixData.query("MovimientosCaja")
    .eq("sessionId", sessionId)
    .eq("movementType", "CIERRE")
    .limit(100).find();

  const auditRead = await wixData.query("ControlOperativo")
    .eq("controlType", "TPV_AUDIT_EVENT")
    .descending("_createdDate")
    .limit(1000).find();

  const audits = auditRead.items.filter(item =>
    item.payload?.entityId === sessionId ||
    item.payload?.entityId === "TPV-X-" + sessionId
  );
  const evidence = {
    sessionId,
    cierreMovimientos: movementRead.items,
    auditoriasTPV: audits
  };
  console.info("RUNTIME_PERSISTENCE_READBACK", JSON.stringify(evidence));
});
```

## Resultado PASS / FAIL

| Gate | PASS | FAIL |
|---|---|---|
| `generarTicketX` | `status === "SUCCESS"`, `ticketX.sessionId` coincide y read-back en `ControlOperativo` contiene `payload.action === "TICKET_X_GENERATED"`, `payload.entityId === "TPV-X-" + sessionId`. | `status !== "SUCCESS"`, sesión no abierta, o no aparece auditoría persistida. |
| `exportarMovimientos` | `status === "SUCCESS"`, `formato === "json"`, `contenido` es array y `nextCursor/hasMore` son coherentes. Si `hasMore` es true, la segunda página debe responder SUCCESS y avanzar el cursor. | ERROR, contenido inválido, cursor repetido/no progresivo o fallo en segunda página cuando `hasMore === true`. Si no hay más de una página, registrar paginación multi-page como NO EJERCITADA, no como PASS. |
| `cerrarSesionCaja` | `status === "SUCCESS"`, `sessionId` coincide y read-back devuelve exactamente un movimiento `CIERRE`; auditoría `CAJA_SESSION_CLOSED` presente en `ControlOperativo`. | ERROR, cero o más de un movimiento CIERRE, o ausencia de auditoría. |

### Respuestas esperadas (forma contractual)

- Ticket X: `{ status: "SUCCESS", ticketX: { sessionId, totales, desglose, nOperaciones, timestamp }, data: { ticketX, replayed }, error: null, traceId }`.
- Export: `{ status: "SUCCESS", formato: "json", nRegistros, contenido: [...], nextCursor: string|null, hasMore: boolean, data, error: null, traceId }`.
- Cierre: `{ status: "SUCCESS", sessionId, saldoFinal, diferencia, replayed, data, error: null, traceId }`.

## Evidencia y cierre

Guardar el JSON completo de cada llamada y `RUNTIME_PERSISTENCE_READBACK`, ocultando datos personales no necesarios. Pegar JSON de cada gate en el issue #435 o en el PR de runtime evidence. Tras capturar evidencia, retirar el bloque temporal de código de página sin publicar; no borrar ni modificar registros de auditoría/movimientos generados.
