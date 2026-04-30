"use client";

import { useState, FormEvent, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";

type Mode = "login" | "register-repartidor" | "register-admin";

export default function LoginPage() {
  const { login, registerAdmin, registerRepartidor, user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nombre, setNombre] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [telefono, setTelefono] = useState("");
  const [documento, setDocumento] = useState("");
  const [vehiculo, setVehiculo] = useState("");
  const [placa, setPlaca] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user && profile) {
      if (profile.rol === "admin") router.push("/admin");
      else if (profile.rol === "repartidor") router.push("/repartidor");
    }
  }, [user, profile, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "login") {
        await login(email, password);
      } else if (mode === "register-admin") {
        if (!accessCode.trim()) throw new Error("Ingresa el codigo de acceso");
        await registerAdmin(email, password, nombre, accessCode);
        setError("Cuenta creada. Inicia sesion.");
      } else if (mode === "register-repartidor") {
        await registerRepartidor(email, password, nombre, telefono, documento, vehiculo, placa);
        setError("Cuenta creada. Inicia sesion.");
      }
    } catch (err: any) {
      setError(err.message || "Error al autenticar");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "14px 18px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "#09111d",
    color: "#f8fafc",
    fontSize: 16,
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    color: "#94a3b8",
    fontSize: 14,
    marginBottom: 6,
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#02060d",
      padding: 20,
    }}>
      <div style={{
        width: "100%",
        maxWidth: 460,
        background: "#0f172a",
        borderRadius: 24,
        padding: 40,
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
      }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h1 style={{ fontSize: 36, fontWeight: 900, color: "#f8fafc", margin: 0 }}>
            Domi<span style={{ color: "#facc15" }}>U</span>
          </h1>
          <p style={{ color: "#94a3b8", marginTop: 8 }}>Magdalena</p>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          {[
            { key: "login" as Mode, label: "Iniciar sesion" },
            { key: "register-repartidor" as Mode, label: "Repartidor" },
            { key: "register-admin" as Mode, label: "Admin" },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => { setMode(tab.key); setError(""); }}
              style={{
                flex: 1,
                padding: "10px 8px",
                borderRadius: 12,
                border: "none",
                background: mode === tab.key ? "#facc15" : "rgba(255,255,255,0.06)",
                color: mode === tab.key ? "#0f172a" : "#94a3b8",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <h2 style={{ color: "#f8fafc", marginBottom: 24, fontSize: 20 }}>
          {mode === "login" && "Iniciar sesion"}
          {mode === "register-admin" && "Crear cuenta Admin"}
          {mode === "register-repartidor" && "Registrarme como repartidor"}
        </h2>

        {error && (
          <div style={{
            padding: "12px 16px",
            borderRadius: 12,
            background: error.includes("creada") ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
            border: `1px solid ${error.includes("creada") ? "#22c55e" : "#ef4444"}`,
            color: error.includes("creada") ? "#86efac" : "#fca5a5",
            marginBottom: 20,
            fontSize: 14,
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
          {mode === "login" && (
            <>
              <div>
                <label style={labelStyle}>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="correo@ejemplo.com"
                  required
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Contrasena</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Tu contrasena"
                  required
                  style={inputStyle}
                />
              </div>
            </>
          )}

          {mode === "register-admin" && (
            <>
              <div>
                <label style={labelStyle}>Nombre</label>
                <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Tu nombre" required style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="correo@ejemplo.com" required style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Contrasena</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimo 6 caracteres" required minLength={6} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Codigo de acceso</label>
                <input type="password" value={accessCode} onChange={(e) => setAccessCode(e.target.value)} placeholder="Codigo autorizado" required style={inputStyle} />
              </div>
            </>
          )}

          {mode === "register-repartidor" && (
            <>
              <div>
                <label style={labelStyle}>Nombre completo</label>
                <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Tu nombre completo" required style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Correo</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="correo@ejemplo.com" required style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Telefono</label>
                <input type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="3001234567" required style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Documento</label>
                <input type="text" value={documento} onChange={(e) => setDocumento(e.target.value)} placeholder="Numero de documento" required style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Vehiculo</label>
                <input type="text" value={vehiculo} onChange={(e) => setVehiculo(e.target.value)} placeholder="Motocicleta / Bicicleta" required style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Placa</label>
                <input type="text" value={placa} onChange={(e) => setPlaca(e.target.value)} placeholder="ABC123" required style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Contrasena</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimo 6 caracteres" required minLength={6} style={inputStyle} />
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading || authLoading}
            style={{
              padding: "16px 24px",
              borderRadius: 14,
              border: "none",
              background: "linear-gradient(135deg, #facc15 0%, #f59e0b 100%)",
              color: "#0f172a",
              fontWeight: 700,
              fontSize: 16,
              cursor: loading ? "wait" : "pointer",
              marginTop: 8,
            }}
          >
            {loading ? "Procesando..." : (
              mode === "login" ? "Iniciar sesion" : "Crear cuenta"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
