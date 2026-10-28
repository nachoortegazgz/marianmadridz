/*
=============================================================================
MODULE: backend/marianAssistant.web.js
VERSION: v5009-FISCAL-V20.1
BASE: marianmadrid4002 (v21.1.0-LTS-remediated) + Directriz V20
RESPONSIBILITY: Marian-only AI assistant with token bounding, context length
                limits, strict prompt validation, and timeout protection.
STANDARDS: G10 ASCII Strict.

FIXES APLICADOS v5009-FISCAL-V20.1:
  - V20-01: sin renombrados funcionales. El modulo no toca campos CMS.
=============================================================================
*/

import { webMethod, Permissions } from "wix-web-module";
import { secrets } from "@wix/secrets";
import { SECRETS } from "backend/mmSecrets";
import { makeTraceId, _safeTrim, withTimeout } from "public/mmUtils";
import { requireMarianManager } from "backend/security";
import { _toPublicError } from "backend/responseUtils";
import { logger } from "backend/logger";

const log = logger;
const SYSTEM_PROMPT = "Eres el asistente personal de Marian, propietaria de Marian Madrid Peluqueria y Estetica en Zaragoza. Ayudas con: caja, inventario, agenda, fiscalidad de apoyo, y gestion operativa. NUNCA ejecutas operaciones economicas directamente. Solo orientas y preparas informacion. Respondes en espanol, de forma clara y concisa. No das consejo fiscal, laboral ni legal definitivo; recomiendas consultar con la gestoria.";
const MAX_MESSAGE_CHARS = 1000;
const MAX_HISTORY_ITEMS = 6;
const MAX_HISTORY_ITEM_CHARS = 500;
const OPENAI_TIMEOUT_MS = 15000;

export const askMarianAssistant = webMethod(Permissions.SiteMember, async (payload = {}) => {
    const traceId = payload.traceId || makeTraceId("assistant");
    try {
        await requireMarianManager(traceId);
        const cleanMessage = _safeTrim(payload.message).slice(0, MAX_MESSAGE_CHARS);
        if (!cleanMessage) throw new Error("Message required");

        const apiKey = await secrets.getSecretValue(SECRETS.MARIAN_ASSISTANT_OPENAI_KEY).catch(() => null);
        if (!apiKey) {
            return {
                status: "SUCCESS",
                data: {
                    message: "El asistente IA no esta configurado todavia. Contacta con el administrador para activarlo.",
                    actions: [],
                },
                error: null,
            };
        }

        const rawHistory = Array.isArray(payload.history) ? payload.history.slice(-MAX_HISTORY_ITEMS) : [];
        const cleanHistory = [];
        for (const item of rawHistory) {
            const role = String(item?.role || "user").trim().toLowerCase();
            const validRole = (role === "assistant" || role === "user") ? role : "user";
            const content = _safeTrim(item?.content).slice(0, MAX_HISTORY_ITEM_CHARS);
            if (content) {
                cleanHistory.push({ role: validRole, content });
            }
        }

        const messages = [
            { role: "system", content: SYSTEM_PROMPT },
            ...cleanHistory,
            { role: "user", content: cleanMessage },
        ];

        const response = await withTimeout(
            fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: "gpt-4o-mini",
                    messages,
                    max_tokens: 500,
                    temperature: 0.4,
                }),
            }),
            OPENAI_TIMEOUT_MS,
            "openai_chat_completions"
        );

        if (!response.ok) {
            log.error("OpenAI API error", { status: response.status, traceId });
            return {
                status: "SUCCESS",
                data: { message: "No se pudo conectar con el asistente IA. Intentalo mas tarde.", actions: [] },
                error: null,
            };
        }

        const data = await response.json().catch(() => null);
        const assistantMessage = data?.choices?.[0]?.message?.content || "No se pudo generar una respuesta.";

        const actions = [];
        const lowerMsg = cleanMessage.toLowerCase();
        if (lowerMsg.includes("caja")) actions.push("REFRESH_CASHIER");
        if (lowerMsg.includes("inventario")) actions.push("REFRESH_INVENTORY");
        if (lowerMsg.includes("fiscal") || lowerMsg.includes("iva")) actions.push("OPEN_FISCAL");

        return {
            status: "SUCCESS",
            data: { message: assistantMessage, actions },
            error: null,
        };
    } catch (err) {
        return { status: "ERROR", data: null, error: _toPublicError(err, "ASSISTANT_FAIL") };
    }
});