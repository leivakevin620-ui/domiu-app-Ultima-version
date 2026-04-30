"use client";

import { useState, FormEvent, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const { login, register, user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user && profile) {
      if (profile.rol === 'admin') router.push("/admin");
      else if (profile.rol === 'repartidor') router.push("/repartidor");
    }
  }, [user, profile, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isRegister) {
        await register(email, password, nombre);
        setError("Cuenta creada. Inicia sesión.");
      } else {
        await login(email, password);
      }
    } catch (err: any) {
      setError(err.message || "Error al autenticar");
    } finally {
      setLoading(false);
    }
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
        maxWidth: 420,
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

        <h2 style={{ color: "#f8fafc", marginBottom: 24, fontSize: 20 }}>
          {isRegister ? "Crear cuenta" : "Iniciar sesión"}
        </h2>

        {error && (
          <div style={{
            padding: "12px 16px",
            borderRadius: 12,
            background: error.includes("Verifica") || error.includes("creada") ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
            border: `1px solid ${error.includes("Verifica") || error.includes("creada") ? "#22c55e" : "#ef4444"}`,
            color: error.includes("Verifica") || error.includes("creada") ? "#86efac" : "#fca5a5",
            marginBottom: 20,
            fontSize: 14,
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
          {isRegister && (
            <div>
              <label style={{ display: "block", color: "#94a3b8", fontSize: 14, marginBottom: 6 }}>Nombre</label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Tu nombre"
                required
                style={{
                  width: "100%",
                  padding: "14px 18px",
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "#09111d",
                  color: "#f8fafc",
                  fontSize: 16,
                  boxSizing: "border-box",
                }}
              />
            </div>
          )}
          <div>
            <label style={{ display: "block", color: "#94a3b8", fontSize: 14, marginBottom: 6 }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="correo@ejemplo.com"
              required
              style={{
                width: "100%",
                padding: "14px 18px",
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "#09111d",
                color: "#f8fafc",
                fontSize: 16,
                boxSizing: "border-box",
              }}
            />
          </div>
          <div>
            <label style={{ display: "block", color: "#94a3b8", fontSize: 14, marginBottom: 6 }}>Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              required
              minLength={6}
              style={{
                width: "100%",
                padding: "14px 18px",
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "#09111d",
                color: "#f8fafc",
                fontSize: 16,
                boxSizing: "border-box",
              }}
            />
          </div>

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
            {loading ? "Procesando..." : isRegister ? "Crear cuenta" : "Iniciar sesión"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 24, color: "#94a3b8", fontSize: 14 }}>
          {isRegister ? "¿Ya tienes cuenta? " : "¿No tienes cuenta? "}
          <button
            type="button"
            onClick={() => { setIsRegister(!isRegister); setError(""); }}
            style={{
              background: "none",
              border: "none",
              color: "#facc15",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            {isRegister ? "Inicia sesión" : "Regístrate"}
          </button>
        </p>
      </div>
    </div>
  );
}
