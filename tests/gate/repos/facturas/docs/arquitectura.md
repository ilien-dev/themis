# Arquitectura

Cada factura pasa por tres etapas: validación, firma y envío.
La firma usa el certificado de la empresa guardado en el almacén de secretos.
Si el envío falla, la factura queda en la cola de reintentos.
