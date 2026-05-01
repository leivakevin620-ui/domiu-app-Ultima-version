"use client";

import { useState, FormEvent, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { Shield, Bike, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

type Mode = "login" | "repartidor" | "admin";

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
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    if (user && profile) {
      if (profile.rol === "admin") router.push("/admin");
      else if (profile.rol === "repartidor") router.push("/repartidor");
    }
  }, [user, profile, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      if (mode === "login") {
        await login(email, password);
      } else if (mode === "admin") {
        if (!accessCode.trim()) throw new Error("Ingresa el codigo de acceso");
        await registerAdmin(email, password, nombre, accessCode);
        setSuccess("Cuenta creada. Inicia sesion.");
      } else {
        await registerRepartidor(email, password, nombre, telefono, documento, vehiculo, placa);
        setSuccess("Registro exitoso. Inicia sesion.");
      }
    } catch (err: any) {
      setError(err.message || "Error al autenticar");
    } finally {
      setLoading(false);
    }
  };

  const inp = "w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-800/50 text-white placeholder-slate-500 focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-all text-sm";
  const lbl = "block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-yellow-400/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-12 h-12 bg-yellow-400 rounded-2xl flex items-center justify-center shadow-lg shadow-yellow-400/20">
              <span className="text-2xl font-black text-slate-900">D</span>
            </div>
          </div>
          <h1 className="text-3xl font-black text-white">
            Domi<span className="text-yellow-400">U</span>
          </h1>
          <p className="text-slate-500 text-sm mt-1">Magdalena</p>
        </div>

        <div className="bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-slate-800 p-6 shadow-2xl">
          <div className="flex gap-1 p-1 bg-slate-800/50 rounded-xl mb-6">
            {[
              { key: "login" as Mode, icon: Shield, label: "Ingresar" },
              { key: "repartidor" as Mode, icon: Bike, label: "Repartidor" },
              { key: "admin" as Mode, icon: Shield, label: "Admin" },
            ].map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => { setMode(t.key); setError(""); setSuccess(""); }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold transition-all ${
                  mode === t.key
                    ? "bg-yellow-400 text-slate-900 shadow-md"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                <t.icon size={14} />
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            ))}
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
              <CheckCircle2 size={16} />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "login" && (
              <>
                <div>
                  <label className={lbl}>Email</label>
                  <input type="email" className={inp} placeholder="correo@ejemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div>
                  <label className={lbl}>Contrasena</label>
                  <div className="relative">
                    <input type={showPass ? "text" : "password"} className={inp} placeholder="Tu contrasena" value={password} onChange={(e) => setPassword(e.target.value)} required />
                    <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                      {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              </>
            )}

            {mode === "repartidor" && (
              <>
                <div>
                  <label className={lbl}>Nombre completo</label>
                  <input type="text" className={inp} placeholder="Juan Perez" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
                </div>
                <div>
                  <label className={lbl}>Correo</label>
                  <input type="email" className={inp} placeholder="correo@ejemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div>
                  <label className={lbl}>Telefono</label>
                  <input type="tel" className={inp} placeholder="3001234567" value={telefono} onChange={(e) => setTelefono(e.target.value)} required />
                </div>
                <div>
                  <label className={lbl}>Documento</label>
                  <input type="text" className={inp} placeholder="1234567890" value={documento} onChange={(e) => setDocumento(e.target.value)} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>Vehiculo</label>
                    <input type="text" className={inp} placeholder="Moto" value={vehiculo} onChange={(e) => setVehiculo(e.target.value)} required />
                  </div>
                  <div>
                    <label className={lbl}>Placa</label>
                    <input type="text" className={inp} placeholder="ABC123" value={placa} onChange={(e) => setPlaca(e.target.value)} required />
                  </div>
                </div>
                <div>
                  <label className={lbl}>Contrasena</label>
                  <input type="password" className={inp} placeholder="Minimo 6 caracteres" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
                </div>
              </>
            )}

            {mode === "admin" && (
              <>
                <div>
                  <label className={lbl}>Nombre</label>
                  <input type="text" className={inp} placeholder="Tu nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
                </div>
                <div>
                  <label className={lbl}>Email</label>
                  <input type="email" className={inp} placeholder="correo@ejemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div>
                  <label className={lbl}>Contrasena</label>
                  <input type="password" className={inp} placeholder="Minimo 6 caracteres" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
                </div>
                <div>
                  <label className={lbl}>Codigo de acceso</label>
                  <input type="password" className={inp} placeholder="Codigo autorizado" value={accessCode} onChange={(e) => setAccessCode(e.target.value)} required />
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loading || authLoading}
              className="w-full py-3.5 bg-yellow-400 hover:bg-yellow-300 text-slate-900 font-bold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-yellow-400/20"
            >
              {loading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                mode === "login" ? "Iniciar Sesion" : "Crear Cuenta"
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">DomiU Magdalena v2.0</p>
      </div>
    </div>
  );
}
