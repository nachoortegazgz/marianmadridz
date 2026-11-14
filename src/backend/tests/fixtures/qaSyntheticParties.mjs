// Synthetic-only identities for offline QA. No real phone numbers or fiscal identifiers.
export const QA_TEST_RUN_ID = "TEST-RUN-OFFLINE-001";
export const QA_TEST_SITE_ID = "50b39f33-e753-4331-ab35-b2ed43dc97f7";

export const QA_CUSTOMERS = Object.freeze([
  Object.freeze({
    customerId: "TEST-CUSTOMER-001",
    firstName: "Cliente",
    lastName: "Prueba Uno",
    email: "cliente.prueba.001@example.test",
    isSynthetic: true,
    sourceEnvironment: "TEST",
    testRunId: QA_TEST_RUN_ID,
  }),
  Object.freeze({
    customerId: "TEST-CUSTOMER-002",
    firstName: "Cliente",
    lastName: "Prueba Dos",
    email: "cliente.prueba.002@example.test",
    isSynthetic: true,
    sourceEnvironment: "TEST",
    testRunId: QA_TEST_RUN_ID,
  }),
  Object.freeze({
    customerId: "TEST-CUSTOMER-003",
    firstName: "Cliente",
    lastName: "Prueba Tres",
    email: "cliente.prueba.003@example.test",
    isSynthetic: true,
    sourceEnvironment: "TEST",
    testRunId: QA_TEST_RUN_ID,
  }),
]);

export const QA_GESTORIA = Object.freeze({
  name: "Gestoría de Pruebas",
  taxId: "TEST-NIF-NO-VALIDO",
  email: "gestoria.pruebas@example.test",
  phone: null,
  status: "SIMULACION",
  destinationEnabled: false,
  isSynthetic: true,
  sourceEnvironment: "TEST",
  testRunId: QA_TEST_RUN_ID,
});
