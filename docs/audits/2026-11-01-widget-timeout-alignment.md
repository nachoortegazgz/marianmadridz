# Alineación de watchdogs E2E entre HTML widgets y módulos Velo

Fecha: 2026-11-01  
Repositorio: `nachoortegazgz/marianmadridz`  
Rama: `fix/booking-timeouts-align-widgets-2026-11-01`

## Cambios aplicados en módulos

- `#html1`: watchdog de contexto ampliado de 30 s a 120 s. El watchdog de reserva `MM_BOOK` permanece en 90 s.
- Calendario Velo: ventana de contexto de 110 s y timeout por intento de 30 s. Tres intentos más backoff de 500/1.000 ms caben dentro de la ventana del módulo y dejan 10 s de margen frente al watchdog de 120 s del widget.
- Página de servicio Velo: handshake de 45 s para dar margen a los nueve intentos del widget (el último envío puede ocurrir aproximadamente a los 39,5 s); contexto de 120 s con tres intentos de 30 s y backoff, dentro de los 155 s del widget.
- Disponibilidad: conserva tres intentos de hasta 45 s, con backoff 500/1.000 ms y ventana externa de 210 s. No se repite automáticamente la creación de reservas.
- Pruebas de contrato: ahora leen los dos archivos HTML del repositorio y comprueban las ventanas relevantes frente a los módulos Velo.

## Límites que se conservan intencionadamente

- Se modificó únicamente el watchdog de contexto de `#html1.txt`; `#htmlWidgetCustomService.txt` permanece intacto.
- El watchdog de 90 s de `#html1` para `MM_BOOK` sigue siendo propiedad del widget. El frontend no debe reintentar una reserva cuyo resultado sea desconocido, porque podría duplicar una operación ya aceptada.
- El aviso de 60 s del widget de servicio es informativo (“no pulses de nuevo”), no una cancelación del backend.
- La ventana de 210 s aplica a consultas de disponibilidad, no a la creación de una reserva.
- Estos cambios alinean los límites de espera en el código; no prueban el runtime de Wix. La validación final requiere CI y una prueba en Wix Preview/QA para reservas simples y duales.

## Criterio de aceptación

1. CI verde, incluyendo test de contrato y lint.
2. Confirmar que el test encuentra los archivos HTML en la raíz en el entorno CI (el carácter `#` de sus nombres debe codificarse como `%23` en las URL).
3. Probar carga de contexto, consulta de días, consulta de slots y reserva simple/dual en Preview/QA.
4. No publicar a producción basándose únicamente en pruebas offline.
