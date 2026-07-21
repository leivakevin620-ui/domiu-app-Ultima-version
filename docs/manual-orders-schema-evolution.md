# Evolución de esquema

Las columnas nuevas tienen defaults seguros para pedidos existentes. La nulabilidad se amplía solo donde el dominio invitado/pickup/custom lo necesita y se compensa con constraints condicionales y snapshots.

Nuevas versiones deben añadir campos compatibles o migrar datos antes de endurecer constraints.
