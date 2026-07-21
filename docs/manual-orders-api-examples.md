# Formas de solicitud

La UI envía un payload validado que contiene identificadores autorizados, datos operativos, artículos, entrega, pago, canal y notas. No envía actor, rol, creador, subtotal, tarifa de servicio o total final.

La confirmación añade `Idempotency-Key`. Los valores de precio incluidos en artículos personalizados son los únicos precios capturados manualmente; productos de catálogo se recalculan.
