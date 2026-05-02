"use client";

import { useState, FormEvent } from "react";
import { useAuth } from "@/hooks/useAuth";

export default function LoginPage() {
  const { login, registerAdmin, registerRepartidor, loading } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [rol, setRol] = useState<"admin" | "repartidor">("admin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [vehiculo, setVehiculo] = useState("");
  const [placa, setPlaca] = useState("");
  const [documento, setDocumento] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [error, setError] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitLoading(true);

    try {
      if (isRegister) {
        if (rol === "repartidor") {
          await registerRepartidor(email, password, nombre, telefono, documento, vehiculo, placa);
          setError("Repartidor creado. Ahora inicia sesion.");
        } else {
          if (!accessCode.trim()) { setError("Se requiere codigo de acceso."); setSubmitLoading(false); return; }
          await registerAdmin(email, password, nombre, accessCode);
          setError("Cuenta creada. Ahora inicia sesion.");
        }
        setSubmitLoading(false);
      } else {
        const result = await login(email, password);
        if (result.profile?.rol === "admin") {
          window.location.href = "/admin";
        } else if (result.profile?.rol === "repartidor") {
          window.location.href = "/repartidor";
        } else {
          setError("No se encontro perfil para este usuario.");
          setSubmitLoading(false);
        }
      }
    } catch (err: any) {
      setError(err.message || "Error al autenticar");
      setSubmitLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#02060d", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 460, background: "#0f172a", borderRadius: 24, padding: 40, border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h1 style={{ fontSize: 36, fontWeight: 900, color: "#f8fafc", margin: 0 }}>Domi<span style={{ color: "#facc15" }}>U</span></h1>
          <p style={{ color: "#94a3b8", marginTop: 8 }}>Magdalena</p>
        </div>
        <h2 style={{ color: "#f8fafc", marginBottom: 24, fontSize: 20 }}>{isRegister ? "Crear cuenta" : "Iniciar sesión"}</h2>
        {error && (
          <div style={{ padding: "12px 16px", borderRadius: 12, background: error.includes("creado") ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${error.includes("creado") ? "#22c55e" : "#ef4444"}`, color: error.includes("creado") ? "#86efac" : "#fca5a5", marginBottom: 20, fontSize: 14 }}>
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
          {isRegister && (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                <button type="button" onClick={() => setRol("admin")} style={{ flex: 1, padding: "10px", borderRadius: 12, border: "none", background: rol === "admin" ? "#facc15" : "rgba(255,255,255,0.06)", color: rol === "admin" ? "#0f172a" : "#94a3b8", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Admin</button>
                <button type="button" onClick={() => setRol("repartidor")} style={{ flex: 1, padding: "10px", borderRadius: 12, border: "none", background: rol === "repartidor" ? "#facc15" : "rgba(255,255,255,0.06)", color: rol === "repartidor" ? "#0f172a" : "#94a3b8", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Repartidor</button>
              </div>
              <div><label style={{ display: "block", color: "#94a3b8", fontSize: 14, marginBottom: 6 }}>Nombre completo</label><input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Tu nombre" required style={{ width: "100%", padding: "14px 18px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.12)", background: "#09111d", color: "#f8fafc", fontSize: 16, boxSizing: "border-box" }} /></div>
              <div><label style={{ display: "block", color: "#94a3b8", fontSize: 14, marginBottom: 6 }}>Telefono</label><input type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="3001234567" required style={{ width: "100%", padding: "14px 18px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.12)", background: "#09111d", color: "#f8fafc", fontSize: 16, boxSizing: "border-box" }} /></div>
              {rol === "repartidor" && (
                <>
                  <div><label style={{ display: "block", color: "#94a3b8", fontSize: 14, marginBottom: 6 }}>Vehiculo</label><input type="text" value={vehiculo} onChange={(e) => setVehiculo(e.target.value)} placeholder="Moto, bicicleta, carro..." style={{ width: "100%", padding: "14px 18px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.12)", background: "#09111d", color: "#f8fafc", fontSize: 16, boxSizing: "border-box" }} /></div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div><label style={{ display: "block", color: "#94a3b8", fontSize: 14, marginBottom: 6 }}>Placa</label><input type="text" value={placa} onChange={(e) => setPlaca(e.target.value)} placeholder="ABC123" style={{ width: "100%", padding: "14px 18px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.12)", background: "#09111d", color: "#f8fafc", fontSize: 16, boxSizing: "border-box" }} /></div>
                    <div><label style={{ display: "block", color: "#94a3b8", fontSize: 14, marginBottom: 6 }}>Documento</label><input type="text" value={documento} onChange={(e) => setDocumento(e.target.value)} placeholder="Cedula" style={{ width: "100%", padding: "14px 18px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.12)", background: "#09111d", color: "#f8fafc", fontSize: 16, boxSizing: "border-box" }} /></div>
                  </div>
                </>
              )}
              {rol === "admin" && (
                <div><label style={{ display: "block", color: "#94a3b8", fontSize: 14, marginBottom: 6 }}>Codigo de acceso *</label><input type="text" value={accessCode} onChange={(e) => setAccessCode(e.target.value)} placeholder="Codigo requerido para admin" required style={{ width: "100%", padding: "14px 18px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.12)", background: "#09111d", color: "#f8fafc", fontSize: 16, boxSizing: "border-box" }} /></div>
              )}
            </>
          )}
          <div><label style={{ display: "block", color: "#94a3b8", fontSize: 14, marginBottom: 6 }}>Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="correo@ejemplo.com" required style={{ width: "100%", padding: "14px 18px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.12)", background: "#09111d", color: "#f8fafc", fontSize: 16, boxSizing: "border-box" }} /></div>
          <div><label style={{ display: "block", color: "#94a3b8", fontSize: 14, marginBottom: 6 }}>Contrasena</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimo 6 caracteres" required minLength={6} style={{ width: "100%", padding: "14px 18px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.12)", background: "#09111d", color: "#f8fafc", fontSize: 16, boxSizing: "border-box" }} /></div>
          <button type="submit" disabled={submitLoading || loading} style={{ padding: "16px 24px", borderRadius: 14, border: "none", background: "linear-gradient(135deg, #facc15 0%, #f59e0b 100%)", color: "#0f172a", fontWeight: 700, fontSize: 16, cursor: (submitLoading || loading) ? "wait" : "pointer", marginTop: 8 }}>{(submitLoading || loading) ? "Procesando..." : isRegister ? "Crear cuenta" : "Iniciar sesion"}</button>
        </form>
        <p style={{ textAlign: "center", marginTop: 24, color: "#94a3b8", fontSize: 14 }}>
          {isRegister ? "Ya tienes cuenta? " : "No tienes cuenta? "}
          <button type="button" onClick={() => { setIsRegister(!isRegister); setError(""); setTelefono(""); setVehiculo(""); setPlaca(""); setDocumento(""); setAccessCode(""); }} style={{ background: "none", border: "none", color: "#facc15", cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
            {isRegister ? "Inicia sesion" : "Registrate"}
          </button>
        </p>
      </div>
    </div>
  );
}
