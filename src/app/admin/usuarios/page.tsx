'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { PageContainer } from '@/components/ui/page-container';
import { PageTitle } from '@/components/ui/page-title';
import { DataTable } from '@/components/dashboard/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { Alert } from '@/components/ui/alert';
import { adminService } from '@/services/admin';
import { useAuth } from '@/contexts/AuthContext';
import type { AdminUser } from '@/services/admin';
import { Search, Shield, ShieldOff, RefreshCw } from 'lucide-react';

const roleBadge: Record<string, 'info' | 'success' | 'warning' | 'destructive'> = {
  admin: 'destructive',
  merchant: 'warning',
  courier: 'info',
  customer: 'success',
};

const statusBadge: Record<string, 'success' | 'warning' | 'destructive' | 'outline'> = {
  active: 'success',
  inactive: 'warning',
  suspended: 'destructive',
  banned: 'destructive',
};

export default function AdminUsers() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminService.getUsers(search || undefined, roleFilter);
      setUsers(data);
    } catch { /* da error */ }
    setLoading(false);
  }, [search, roleFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleStatusToggle = async (u: AdminUser) => {
    const newStatus = u.status === 'active' ? 'suspended' : 'active';
    try {
      await adminService.updateUserStatus(u.id, newStatus);
      if (profile) await adminService.logAudit(profile.id, `${profile.first_name} ${profile.last_name}`, newStatus === 'active' ? 'reactivar_usuario' : 'suspender_usuario', 'profile', u.id, `${u.email} -> ${newStatus}`);
      setAlert({ type: 'success', msg: `Usuario ${newStatus === 'active' ? 'reactivado' : 'suspendido'}` });
      fetchUsers();
    } catch { setAlert({ type: 'error', msg: 'Error al actualizar usuario' }); }
  };

  const handleRoleChange = async (u: AdminUser, newRole: string) => {
    try {
      await adminService.updateUserRole(u.id, newRole as any);
      if (profile) await adminService.logAudit(profile.id, `${profile.first_name} ${profile.last_name}`, 'cambiar_rol', 'profile', u.id, `${u.email}: ${u.role} -> ${newRole}`);
      setAlert({ type: 'success', msg: 'Rol actualizado' });
      fetchUsers();
    } catch { setAlert({ type: 'error', msg: 'Error al cambiar rol' }); }
  };

  return (
    <PageContainer>
      <PageTitle title="Gestión de Usuarios" description="Administra todos los usuarios de la plataforma" />

      {alert && <Alert variant={alert.type} title={alert.msg} dismissible onDismiss={() => setAlert(null)} />}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar usuarios..."
            className="h-10 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
          />
        </div>
        <Select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          options={[
            { value: 'all', label: 'Todos los roles' },
            { value: 'admin', label: 'Admin' },
            { value: 'merchant', label: 'Negocio' },
            { value: 'courier', label: 'Repartidor' },
            { value: 'customer', label: 'Cliente' },
          ]}
          className="w-44"
        />
        <Button variant="outline" size="sm" onClick={fetchUsers}>
          <RefreshCw className="mr-1.5 h-4 w-4" /> Actualizar
        </Button>
      </div>

      <DataTable
        columns={[
          {
            key: 'name',
            header: 'Nombre',
            render: (u: AdminUser) => [u.first_name, u.last_name].filter(Boolean).join(' ') || '—',
            sortable: true,
          },
          { key: 'email', header: 'Email', sortable: true },
          {
            key: 'role',
            header: 'Rol',
            render: (u: AdminUser) => <Badge variant={roleBadge[u.role]}>{u.role}</Badge>,
          },
          {
            key: 'status',
            header: 'Estado',
            render: (u: AdminUser) => (
              <Badge variant={statusBadge[u.status] || 'outline'}>{u.status}</Badge>
            ),
          },
          { key: 'phone', header: 'Teléfono', render: (u: AdminUser) => u.phone || '—' },
          {
            key: 'created_at',
            header: 'Registro',
            render: (u: AdminUser) => new Date(u.created_at).toLocaleDateString('es-CO'),
            sortable: true,
          },
          {
            key: 'actions',
            header: 'Acciones',
            render: (u: AdminUser) => (
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => setSelectedUser(u)}>
                  Editar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleStatusToggle(u)}
                  className={u.status === 'active' ? 'text-destructive' : 'text-success'}
                >
                  {u.status === 'active' ? (
                    <><ShieldOff className="mr-1 h-3.5 w-3.5" />Suspender</>
                  ) : (
                    <><Shield className="mr-1 h-3.5 w-3.5" />Activar</>
                  )}
                </Button>
              </div>
            ),
          },
        ]}
        data={users}
        keyExtractor={(u) => u.id}
        searchable={false}
        emptyMessage={loading ? 'Cargando...' : 'No se encontraron usuarios'}
      />

      <Modal open={!!selectedUser} onClose={() => setSelectedUser(null)} title="Editar Usuario">
        {selectedUser && (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Nombre</p>
              <p className="font-medium">{[selectedUser.first_name, selectedUser.last_name].filter(Boolean).join(' ') || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{selectedUser.email}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Estado</p>
              <Badge variant={statusBadge[selectedUser.status] || 'outline'}>{selectedUser.status}</Badge>
            </div>
            <div>
              <p className="mb-1 text-sm text-muted-foreground">Cambiar Rol</p>
              <Select
                value={selectedUser.role}
                onChange={e => handleRoleChange(selectedUser, e.target.value)}
                options={[
                  { value: 'admin', label: 'Admin' },
                  { value: 'merchant', label: 'Negocio' },
                  { value: 'courier', label: 'Repartidor' },
                  { value: 'customer', label: 'Cliente' },
                ]}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => handleStatusToggle(selectedUser)} className={selectedUser.status === 'active' ? 'text-destructive' : 'text-success'}>
                {selectedUser.status === 'active' ? 'Suspender Usuario' : 'Reactivar Usuario'}
              </Button>
              <Button variant="ghost" onClick={() => setSelectedUser(null)}>Cerrar</Button>
            </div>
          </div>
        )}
      </Modal>
    </PageContainer>
  );
}
