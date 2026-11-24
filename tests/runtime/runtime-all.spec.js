/*
WIX PREVIEW RUNTIME HARNESS — F1..F6
Purpose: orchestrate six injected Preview checks and return one JSON report.
This file contains no business logic and imports no production module.

Preview use:
1. Copy this module into a temporary QA page/module in the Wix Preview site.
2. Bind deps.flows.F1..F6 to the approved real Preview checks. Each adapter
   must return { status: "PASS" | "FAIL", result? }; resolved promises alone
   are never interpreted as PASS.
3. Bind deps.cleanup to a cleanup function that returns the same explicit
   status contract and deletes ONLY disposable,
   non-ledger artifacts whose identifiers start with the supplied prefix.
   Append-only fiscal, accounting, cash and audit ledgers MUST be preserved.
4. Run:
   const flows = { F1: runF1, F2: runF2, F3: runF3, F4: runF4, F5: runF5, F6: runF6 };
   const report = await runAllRuntimeChecks({ deps: { flows, cleanup } });
   console.log(JSON.stringify(report));

Every flow receives { runId, prefix }. Every created synthetic identifier
must start with prefix. Cleanup receives { runId, prefix, preserveAppendOnly: true }.
The harness never invokes Wix APIs or performs cleanup itself.
*/

const FLOW_IDS = Object.freeze(["F1", "F2", "F3", "F4", "F5", "F6"]);

function _errorSummary(error) {
    return {
        code: typeof error?.code === "string" ? error.code : null,
        message: typeof error?.message === "string" ? error.message : String(error),
    };
}

function _createRunId() {
    return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 12);
}

export async function runAllRuntimeChecks({ deps = {} } = {}) {
    const runIdValue = typeof deps.createRunId === "function"
        ? await deps.createRunId()
        : _createRunId();
    const runId = String(runIdValue || "");
    if (!/^[A-Za-z0-9_-]{8,80}$/.test(runId)) {
        throw new Error("RUNTIME_INVALID_RUN_ID");
    }

    const timestamp = new Date().toISOString();
    const prefix = "SYN-" + runId + "-";
    const flows = {};
    let cleanup = { status: "NOT_CONFIGURED" };

    if (typeof deps.cleanup !== "function") {
        for (const flowId of FLOW_IDS) {
            flows[flowId] = {
                status: "SKIPPED",
                reason: "CLEANUP_NOT_CONFIGURED",
            };
        }
    } else {
        for (const flowId of FLOW_IDS) {
            const flow = deps.flows?.[flowId];
            if (typeof flow !== "function") {
                flows[flowId] = {
                    status: "SKIPPED",
                    reason: "FLOW_NOT_CONFIGURED",
                };
                continue;
            }

            try {
                const result = await flow({ runId, prefix });
                const flowStatus = result?.status;
                flows[flowId] = {
                    status: flowStatus === "PASS" ? "PASS" : flowStatus === "FAIL" ? "FAIL" : "INCOMPLETE",
                    result: result ?? null,
                };
            } catch (error) {
                flows[flowId] = { status: "FAIL", error: _errorSummary(error) };
            }
        }

        try {
            const result = await deps.cleanup({
                runId,
                prefix,
                preserveAppendOnly: true,
            });
            const cleanupStatus = result?.status;
            cleanup = {
                status: cleanupStatus === "PASS" ? "PASS" : cleanupStatus === "FAIL" ? "FAIL" : "INCOMPLETE",
                result: result ?? null,
            };
        } catch (error) {
            cleanup = { status: "FAIL", error: _errorSummary(error) };
        }
    }

    const flowResults = Object.values(flows);
    const passed = flowResults.filter((flow) => flow.status === "PASS").length;
    const failed = flowResults.filter((flow) => flow.status === "FAIL").length;
    const skipped = flowResults.filter((flow) => flow.status === "SKIPPED").length;
    const incomplete = flowResults.filter((flow) => flow.status === "INCOMPLETE").length;
    const status = failed > 0 || cleanup.status === "FAIL"
        ? "FAIL"
        : skipped > 0 || incomplete > 0 || cleanup.status !== "PASS"
            ? "INCOMPLETE"
            : "PASS";

    return {
        runId,
        timestamp,
        flows,
        summary: {
            status,
            total: FLOW_IDS.length,
            passed,
            failed,
            skipped,
            incomplete,
            cleanupStatus: cleanup.status,
            cleanup,
        },
    };
}
