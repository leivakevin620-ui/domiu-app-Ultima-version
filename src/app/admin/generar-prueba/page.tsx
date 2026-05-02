"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getSupabaseClient } from "@/lib/supabase";

const clientes = [
  "Carlos Mendoza", "Ana Rodriguez", "Luis Garcia", "Maria Torres", "Pedro Sanchez",
  "Laura Martinez", "Diego Ramirez", "Camila Herrera", "Andres Lopez", "Sofia Castro",
  "Juan Morales", "Valentina Diaz", "Ricardo Vargas", "Isabella Rojas", "Felipe Cruz",
  "Daniela Ortiz", "Mateo Silva", "Gabriela Reyes", "Nicolas Flores", "Mariana Gutierrez",
  "Alejandro Pena", "Paula Jimenez", "Sebastian Medina", "Natalia Aguilar", "Emilio Vargas",
  "Carolina Salazar", "David Castillo", "Andrea Morales", "Javier Gomez", "Patricia Luna",
  "Oscar Navarro",
];

const direcciones = [
  "Calle 22 #5-34 Centro", "Cra 5 #12-89", "Av Universidad #20-15", "Calle 30 #10-45",
  "Cra 3 #8-67", "Calle 18 #4-23", "Av 19 #15-90", "Cra 7 #25-12", "Calle 15 #6-78",
  "Cra 4 #14-56", "Calle 25 #9-34", "Av Central #18-45", "Cra 8 #22-67", "Calle 20 #3-89",
  "Cra 6 #11-23", "Calle 28 #7-56", "Av Principal #12-34", "Cra 2 #16-78", "Calle 12 #5-90",
  "Cra 9 #20-45", "Calle 35 #8-12", "Av Norte #22-67", "Cra 1 #18-34", "Calle 10 #4-56",
  "Cra 10 #15-23", "Calle 40 #6-89", "Av Sur #14-45", "Cra 11 #19-67", "Calle 45 #3-12",
  "Cra 12 #7-34", "Calle 8 #2-56",
];

const nombresLocales = [
  "El Buen Sabor", "Pizzeria Roma", "Comida Rapida Express", "Restaurante Don Pepe",
  "El Rincon Criollo", "Burger House", "Sushi Master", "La Casa del Pollo",
  "Arepa Gourmet", "Marisqueria Del Mar", "Heladeria Fria", "Cafe Paris",
];

const telefonos = [
  "3101234567", "3112345678", "3123456789", "3134567890", "3145678901",
  "3156789012", "3167890123", "3178901234", "3189012345", "3190123456",
  "3201234567", "3212345678", "3223456789", "3234567890", "3245678901",
];

const estadosPedido = ["Pendiente", "Aceptado", "Recogido", "En camino", "Entregado", "Problema", "Cancelado"];
const metodosPago = ["Efectivo", "Transferencia"];

export default function GenerateOrdersPage() {
  const { user, profile, initialized } = useAuth();
  const sb = getSupabaseClient();
  const [status, setStatus] = useState("Sin ejecutar");
  const [logs, setLogs] = useState<string[]>([]);
  const [reps, setReps] = useState<any[]>([]);
  const [locs, setLocs] = useState<any[]>([]);

  useEffect(() => {
    async function loadData() {
      const { data: repsData } = await sb.from("repartidores").select("*").eq("activo", true).order("created_at");
      const { data: locsData } = await sb.from("locales").select("*").eq("activo", true).order("created_at");
      setReps(repsData || []);
      setLocs(locsData || []);
    }
    if (initialized) loadData();
  }, [initialized]);

  async function addLog(msg: string) {
    setLogs(prev => [...prev, msg]);
  }

  async function generarPedidos() {
    setStatus("Generando...");
    setLogs([]);
    const total = 31;
    let created = 0;

    for (let i = 0; i < total; i++) {
      const cliente = clientes[i % clientes.length];
      const direccion = direcciones[i % direcciones.length];
      const telefono = telefonos[i % telefonos.length];
      const local = locs.length > 0 ? locs[i % locs.length] : null;

      // Distribuir entre repartidores en ciclo
      const rep = reps.length > 0 ? reps[i % reps.length] : null;

      // Precio aleatorio entre 6000, 7000 y 8000
      const precios = [6000, 7000, 8000];
      const precio = precios[i % 3];

      // Calcular pago_repartidor y empresa_recibe
      const pagoRepartidor = precio > 8000 ? Math.round(precio * 0.6) : Math.round(precio * 0.75);
      const empresaRecibe = precio - pagoRepartidor;

      // Estado aleatorio
      const estadoIdx = Math.floor(Math.random() * estadosPedido.length);
      const estado = estadosPedido[estadoIdx];

      // Metodo pago aleatorio
      const metodoPago = metodosPago[Math.floor(Math.random() * metodosPago.length)];

      const km = Math.floor(Math.random() * 8) + 2;
      const codigo = "DOM-" + String(i + 1).padStart(3, "0");

      const pedido: any = {
        codigo,
        cliente,
        telefono,
        direccion,
        barrio: "Centro",
        local_id: local?.id || null,
        repartidor_id: rep?.id || null,
        km,
        precio,
        pago_repartidor: pagoRepartidor,
        empresa_recibe: empresaRecibe,
        metodo_pago: metodoPago,
        estado,
        liquidado: estado === "Entregado",
        user_id: user?.id,
      };

      const { error } = await sb.from("pedidos").insert(pedido);
      if (error) {
        await addLog(`ERROR pedido ${codigo}: ${error.message}`);
      } else {
        created++;
        await addLog(`OK ${codigo} - ${cliente} - $${precio} - ${estado} - Rep: ${rep?.nombre || "Sin asignar"}`);
      }
    }

    setStatus(`Completado: ${created} de ${total} pedidos creados`);
  }

  async function borrarPedidos() {
    setStatus("Borrando...");
    const { error } = await sb.from("pedidos").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) setStatus("Error borrando: " + error.message);
    else { setLogs([]); setStatus("Todos los pedidos borrados"); }
  }

  if (!initialized) return <div style={{ padding: 40, color: "#fff" }}>Cargando...</div>;
  if (profile?.rol !== "admin") return <div style={{ padding: 40, color: "#fca5a5" }}>No autorizado</div>;

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "#f8fafc", padding: 40 }}>
      <h1 style={{ fontSize: 24, fontWeight: 900, marginBottom: 20 }}>Generar 31 Pedidos de Prueba</h1>
      <p style={{ color: "#94a3b8", marginBottom: 20 }}>
        Repartidores activos: {reps.length} | Locales activos: {locs.length}
      </p>
      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <button
          onClick={generarPedidos}
          style={{ padding: "12px 24px", borderRadius: 12, border: "none", background: "#facc15", color: "#0f172a", fontWeight: 700, fontSize: 16, cursor: "pointer" }}
        >
          Generar 31 Pedidos
        </button>
        <button
          onClick={borrarPedidos}
          style={{ padding: "12px 24px", borderRadius: 12, border: "1px solid #ef4444", background: "transparent", color: "#ef4444", fontWeight: 700, fontSize: 16, cursor: "pointer" }}
        >
          Borrar Todos
        </button>
        <a href="/admin" style={{ padding: "12px 24px", borderRadius: 12, border: "1px solid #94a3b8", background: "transparent", color: "#94a3b8", fontWeight: 700, fontSize: 16, textDecoration: "none" }}>
          Volver al Admin
        </a>
      </div>
      <p style={{ color: "#facc15", fontWeight: 700, marginBottom: 16 }}>{status}</p>
      <div style={{ background: "#1e293b", borderRadius: 12, padding: 16, maxHeight: 400, overflow: "auto" }}>
        {logs.map((log, i) => (
          <p key={i} style={{ fontSize: 13, color: log.startsWith("ERROR") ? "#fca5a5" : "#86efac", margin: "4px 0", fontFamily: "monospace" }}>
            {log}
          </p>
        ))}
      </div>
    </div>
  );
}
