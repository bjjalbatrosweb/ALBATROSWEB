'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { browserSupportsWebAuthn, startRegistration } from '@simplewebauthn/browser';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import {
  CheckCircle2,
  Fingerprint,
  KeyRound,
  Loader2,
  LockKeyhole,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  Trash2,
  UserRound,
  XCircle,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useAuth, useFirestore, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { normalizarPerfilAcceso } from '@/lib/access-control';

type Sede = 'MMA' | 'CAUCEL' | 'JUAN_PABLO';
type Rol = 'admin' | 'profesor' | 'atleta';

type UsuarioBiometrico = {
  uid: string;
  nombre: string;
  email: string;
  rol: Rol;
  activo: boolean;
  sedes: Sede[];
};

type CredencialBiometrica = {
  id: string;
  uid: string;
  nombrePersona: string;
  funcion: Rol | 'sin_asignar';
  sedes: Sede[];
  dispositivo: string;
  email: string;
  activo: boolean;
  creadoEn: string | null;
  ultimoUso: string | null;
  respaldada: boolean;
};

const SEDES: Array<{ value: Sede; label: string }> = [
  { value: 'MMA', label: 'MMA' },
  { value: 'CAUCEL', label: 'Caucel' },
  { value: 'JUAN_PABLO', label: 'Juan Pablo' },
];

const LABEL_ROL: Record<string, string> = {
  admin: 'Administrador',
  profesor: 'Profesor',
  atleta: 'Atleta',
  sin_asignar: 'Sin asignar',
};

function formatDate(value: string | null) {
  if (!value) return 'Nunca';
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function deviceName() {
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) return 'iPhone o iPad';
  if (/Android/i.test(navigator.userAgent)) return 'Android';
  return 'Computadora';
}

export default function GestionBiometricaPage() {
  const auth = useAuth();
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [credentials, setCredentials] = useState<CredencialBiometrica[]>([]);
  const [users, setUsers] = useState<UsuarioBiometrico[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [supportsPasskeys, setSupportsPasskeys] = useState(false);
  const [query, setQuery] = useState('');
  const [siteFilter, setSiteFilter] = useState<'TODAS' | Sede>('TODAS');
  const [roleFilter, setRoleFilter] = useState<'TODOS' | Rol>('TODOS');
  const [dialogMode, setDialogMode] = useState<'register' | 'edit' | null>(null);
  const [selectedCredential, setSelectedCredential] = useState<CredencialBiometrica | null>(null);
  const [selectedUid, setSelectedUid] = useState('');
  const [personName, setPersonName] = useState('');
  const [selectedSites, setSelectedSites] = useState<Sede[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<CredencialBiometrica | null>(null);
  const [adminLocked, setAdminLocked] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [unlocking, setUnlocking] = useState(false);

  useEffect(() => {
    setSupportsPasskeys(browserSupportsWebAuthn());
  }, []);

  const apiRequest = useCallback(async (url: string, init?: RequestInit) => {
    if (!user) throw new Error('La sesión no está disponible.');
    const token = await user.getIdToken();
    const response = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.mensaje || 'No se pudo completar la operación.');
    return data;
  }, [user]);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await apiRequest('/api/admin/biometria');
      setAdminLocked(false);
      setCredentials(data.credenciales || []);
      setUsers(data.usuarios || []);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message.includes('Solo un administrador')) {
        setAdminLocked(true);
        return;
      }
      toast({
        variant: 'destructive',
        title: 'No se pudo abrir la gestión biométrica',
        description: message || 'Inténtalo nuevamente.',
      });
    } finally {
      setLoading(false);
    }
  }, [apiRequest, toast, user]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const unlockWithAdmin = async () => {
    if (unlocking || !adminEmail.trim() || !adminPassword) return;

    try {
      setUnlocking(true);
      const credential = await signInWithEmailAndPassword(
        auth,
        adminEmail.trim(),
        adminPassword,
      );
      const profileSnapshot = await getDoc(
        doc(firestore, 'usuarios', credential.user.uid),
      );
      const profile = profileSnapshot.exists()
        ? normalizarPerfilAcceso(profileSnapshot.data())
        : null;

      if (!profile || profile.rol !== 'admin' || !profile.activo) {
        await signOut(auth);
        throw new Error('La cuenta ingresada no es un administrador activo.');
      }

      localStorage.setItem('userRole', 'admin');
      setAdminPassword('');
      toast({
        title: 'Gestión biométrica desbloqueada',
        description: 'La sesión administrativa fue validada correctamente.',
      });
      window.location.reload();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'No se pudo desbloquear',
        description: error instanceof Error
          ? error.message
          : 'Comprueba el correo y la contraseña del administrador.',
      });
    } finally {
      setUnlocking(false);
    }
  };

  const selectedUser = users.find((item) => item.uid === selectedUid) || null;

  const filteredCredentials = useMemo(() => {
    const text = query.trim().toLocaleLowerCase('es');
    return credentials.filter((credential) => {
      const matchesText = !text || [
        credential.nombrePersona,
        credential.email,
        credential.dispositivo,
        LABEL_ROL[credential.funcion],
      ].some((value) => value.toLocaleLowerCase('es').includes(text));
      const matchesSite = siteFilter === 'TODAS' || credential.sedes.includes(siteFilter);
      const matchesRole = roleFilter === 'TODOS' || credential.funcion === roleFilter;
      return matchesText && matchesSite && matchesRole;
    });
  }, [credentials, query, roleFilter, siteFilter]);

  const groupedCredentials = useMemo(() => SEDES
    .filter((site) => siteFilter === 'TODAS' || site.value === siteFilter)
    .map((site) => ({
      ...site,
      credentials: filteredCredentials.filter((credential) => credential.sedes.includes(site.value)),
    }))
    .filter((group) => group.credentials.length > 0), [filteredCredentials, siteFilter]);

  const resetForm = () => {
    setSelectedCredential(null);
    setSelectedUid('');
    setPersonName('');
    setSelectedSites([]);
    setEnabled(true);
  };

  const openRegister = () => {
    resetForm();
    setDialogMode('register');
  };

  const openEdit = (credential: CredencialBiometrica) => {
    setSelectedCredential(credential);
    setSelectedUid(credential.uid);
    setPersonName(credential.nombrePersona);
    setSelectedSites(credential.sedes);
    setEnabled(credential.activo);
    setDialogMode('edit');
  };

  const selectUser = (uid: string) => {
    const selected = users.find((item) => item.uid === uid);
    setSelectedUid(uid);
    if (!selected) return;
    setPersonName(selected.nombre);
    setSelectedSites(selected.sedes.length === 1 ? selected.sedes : []);
  };

  const toggleSite = (site: Sede) => {
    if (!selectedUser?.sedes.includes(site)) return;
    setSelectedSites((current) => current.includes(site)
      ? current.filter((item) => item !== site)
      : [...current, site]);
  };

  const validateAssignment = () => {
    if (!selectedUser) throw new Error('Selecciona una cuenta real.');
    if (!personName.trim()) throw new Error('Escribe el nombre de la persona.');
    if (selectedSites.length === 0) throw new Error('Selecciona al menos una sede.');
  };

  const registerCredential = async () => {
    try {
      validateAssignment();
      if (!supportsPasskeys) throw new Error('Este navegador no es compatible con passkeys.');
      setWorking(true);
      const optionsData = await apiRequest('/api/admin/biometria/register/options', {
        method: 'POST',
        body: JSON.stringify({
          uid: selectedUid,
          nombrePersona: personName.trim(),
          sedes: selectedSites,
        }),
      });
      const registrationResponse = await startRegistration({ optionsJSON: optionsData.options });
      await apiRequest('/api/admin/biometria/register/verify', {
        method: 'POST',
        body: JSON.stringify({
          challengeId: optionsData.challengeId,
          response: registrationResponse,
          deviceName: deviceName(),
        }),
      });
      toast({ title: 'Biometría registrada', description: `El dispositivo quedó asignado a ${personName.trim()}.` });
      setDialogMode(null);
      resetForm();
      await loadData();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'No se pudo registrar la biometría',
        description: error instanceof Error ? error.message : 'La operación fue cancelada.',
      });
    } finally {
      setWorking(false);
    }
  };

  const saveCredential = async () => {
    if (!selectedCredential) return;
    try {
      validateAssignment();
      setWorking(true);
      await apiRequest('/api/admin/biometria', {
        method: 'PATCH',
        body: JSON.stringify({
          credentialId: selectedCredential.id,
          uid: selectedUid,
          nombrePersona: personName.trim(),
          sedes: selectedSites,
          activo: enabled,
        }),
      });
      toast({ title: 'Asignación actualizada', description: 'Los cambios ya aplican al siguiente inicio de sesión.' });
      setDialogMode(null);
      resetForm();
      await loadData();
    } catch (error) {
      toast({ variant: 'destructive', title: 'No se guardaron los cambios', description: error instanceof Error ? error.message : 'Inténtalo nuevamente.' });
    } finally {
      setWorking(false);
    }
  };

  const toggleCredential = async (credential: CredencialBiometrica) => {
    try {
      setWorking(true);
      await apiRequest('/api/admin/biometria', {
        method: 'PATCH',
        body: JSON.stringify({
          credentialId: credential.id,
          uid: credential.uid,
          nombrePersona: credential.nombrePersona,
          sedes: credential.sedes,
          activo: !credential.activo,
        }),
      });
      toast({
        title: credential.activo ? 'Acceso bloqueado' : 'Acceso activado',
        description: credential.activo
          ? 'Esta passkey ya no podrá iniciar sesión.'
          : 'La passkey vuelve a estar autorizada.',
      });
      await loadData();
    } catch (error) {
      toast({ variant: 'destructive', title: 'No se pudo cambiar el estado', description: error instanceof Error ? error.message : 'Inténtalo nuevamente.' });
    } finally {
      setWorking(false);
    }
  };

  const deleteCredential = async () => {
    if (!deleteTarget) return;
    try {
      setWorking(true);
      await apiRequest('/api/admin/biometria', {
        method: 'DELETE',
        body: JSON.stringify({ credentialId: deleteTarget.id }),
      });
      toast({ title: 'Acceso biométrico eliminado', description: 'El dispositivo tendrá que registrarse nuevamente para volver a entrar.' });
      setDeleteTarget(null);
      await loadData();
    } catch (error) {
      toast({ variant: 'destructive', title: 'No se pudo eliminar', description: error instanceof Error ? error.message : 'Inténtalo nuevamente.' });
    } finally {
      setWorking(false);
    }
  };

  const activeCount = credentials.filter((item) => item.activo).length;
  const assignedCount = credentials.filter((item) => item.uid && item.sedes.length > 0).length;

  if (adminLocked) {
    return (
      <div className="grid min-h-[70vh] place-items-center py-8">
        <Card className="w-full max-w-xl overflow-hidden border-amber-500/25 bg-card shadow-2xl">
          <div className="h-1.5 bg-gradient-to-r from-amber-600 via-primary to-amber-600" />
          <CardContent className="p-6 md:p-9">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-500/25 bg-amber-500/10 text-amber-500">
              <LockKeyhole className="h-8 w-8" />
            </div>
            <div className="mt-5 text-center">
              <Badge variant="outline" className="border-amber-500/30 text-amber-500">ÁREA PROTEGIDA</Badge>
              <h1 className="mt-3 text-2xl font-black uppercase italic md:text-3xl">
                Desbloquear gestión biométrica
              </h1>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                Introduce las credenciales de un administrador activo. Permanecerás en este apartado y podrás gestionar las passkeys inmediatamente.
              </p>
            </div>

            <div className="mt-7 space-y-5 rounded-2xl border border-border bg-background/60 p-5">
              <div className="space-y-2">
                <Label htmlFor="biometric-admin-email">Correo del administrador</Label>
                <Input
                  id="biometric-admin-email"
                  type="email"
                  autoComplete="username"
                  value={adminEmail}
                  onChange={(event) => setAdminEmail(event.target.value)}
                  placeholder="administrador@correo.com"
                  className="h-12 rounded-xl"
                  disabled={unlocking}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="biometric-admin-password">Contraseña del administrador</Label>
                <Input
                  id="biometric-admin-password"
                  type="password"
                  autoComplete="current-password"
                  value={adminPassword}
                  onChange={(event) => setAdminPassword(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void unlockWithAdmin();
                  }}
                  className="h-12 rounded-xl"
                  disabled={unlocking}
                />
              </div>
              <Button
                type="button"
                className="h-12 w-full rounded-xl font-black uppercase"
                disabled={unlocking || !adminEmail.trim() || !adminPassword}
                onClick={() => void unlockWithAdmin()}
              >
                {unlocking ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <ShieldCheck className="mr-2 h-5 w-5" />}
                {unlocking ? 'Validando administrador...' : 'Desbloquear con contraseña'}
              </Button>
            </div>

            <p className="mt-4 text-center text-xs leading-5 text-muted-foreground">
              La contraseña se valida directamente con Firebase y no se almacena en la web.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-7 pb-12">
      <section className="relative overflow-hidden rounded-[2rem] border border-primary/20 bg-card p-6 shadow-2xl md:p-8">
        <div className="absolute -right-16 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="max-w-3xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-primary">
              <Fingerprint className="h-4 w-4" /> Seguridad de acceso
            </div>
            <h1 className="text-3xl font-black uppercase italic tracking-tight text-foreground md:text-5xl">
              Gestión biométrica
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
              Registra y asigna cada passkey por persona, función y sede. La huella o el rostro permanecen protegidos dentro del dispositivo.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => void loadData()} disabled={loading || working} className="rounded-xl font-black uppercase">
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar
            </Button>
            <Button onClick={openRegister} disabled={!supportsPasskeys || loading} className="rounded-xl font-black uppercase shadow-lg shadow-primary/20">
              <Plus className="mr-2 h-4 w-4" /> Registrar biometría
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Card className="border-primary/20 bg-card/80"><CardContent className="flex items-center gap-4 p-5"><KeyRound className="h-9 w-9 text-primary" /><div><p className="text-3xl font-black">{credentials.length}</p><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Registradas</p></div></CardContent></Card>
        <Card className="border-green-500/20 bg-card/80"><CardContent className="flex items-center gap-4 p-5"><ShieldCheck className="h-9 w-9 text-green-500" /><div><p className="text-3xl font-black">{activeCount}</p><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Activas</p></div></CardContent></Card>
        <Card className="border-blue-500/20 bg-card/80"><CardContent className="flex items-center gap-4 p-5"><UserRound className="h-9 w-9 text-blue-500" /><div><p className="text-3xl font-black">{assignedCount}</p><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Asignadas</p></div></CardContent></Card>
      </section>

      <Card className="border-border/70 bg-card/80">
        <CardContent className="grid gap-3 p-4 md:grid-cols-[minmax(240px,1fr)_200px_200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre, dispositivo o correo..." className="h-11 rounded-xl pl-10" />
          </div>
          <select value={siteFilter} onChange={(event) => setSiteFilter(event.target.value as 'TODAS' | Sede)} className="h-11 rounded-xl border border-input bg-background px-3 text-sm font-bold">
            <option value="TODAS">Todas las sedes</option>
            {SEDES.map((site) => <option key={site.value} value={site.value}>{site.label}</option>)}
          </select>
          <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as 'TODOS' | Rol)} className="h-11 rounded-xl border border-input bg-background px-3 text-sm font-bold">
            <option value="TODOS">Todas las funciones</option>
            <option value="admin">Administrador</option>
            <option value="profesor">Profesor</option>
            <option value="atleta">Atleta</option>
          </select>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex min-h-64 items-center justify-center rounded-3xl border border-dashed border-border">
          <Loader2 className="mr-3 h-6 w-6 animate-spin text-primary" />
          <span className="font-bold uppercase tracking-wider text-muted-foreground">Cargando accesos...</span>
        </div>
      ) : filteredCredentials.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card/40 p-12 text-center">
          <Fingerprint className="mx-auto h-12 w-12 text-muted-foreground/40" />
          <h2 className="mt-4 text-xl font-black uppercase">Sin registros encontrados</h2>
          <p className="mt-2 text-sm text-muted-foreground">Registra una passkey o cambia los filtros.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedCredentials.map((group) => (
            <section key={group.value} className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <Badge variant="outline" className="border-primary/30 bg-primary/5 px-4 py-1.5 text-primary">SEDE · {group.label}</Badge>
                <div className="h-px flex-1 bg-border" />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {group.credentials.map((credential) => (
                  <Card key={`${group.value}-${credential.id}`} className={`overflow-hidden transition-colors ${credential.activo ? 'border-green-500/20' : 'border-red-500/25 opacity-80'}`}>
                    <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className={`rounded-2xl p-3 ${credential.activo ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                          <Fingerprint className="h-6 w-6" />
                        </div>
                        <div className="min-w-0">
                          <CardTitle className="truncate text-lg font-black uppercase">{credential.nombrePersona}</CardTitle>
                          <p className="truncate text-xs text-muted-foreground">{credential.email || 'Cuenta sin correo visible'}</p>
                        </div>
                      </div>
                      <Badge className={credential.activo ? 'bg-green-600' : 'bg-red-600'}>{credential.activo ? 'ACTIVA' : 'BLOQUEADA'}</Badge>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-3 rounded-2xl border border-border/70 bg-background/50 p-4 text-sm">
                        <div><p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Función</p><p className="mt-1 font-bold">{LABEL_ROL[credential.funcion]}</p></div>
                        <div><p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Dispositivo</p><p className="mt-1 truncate font-bold">{credential.dispositivo}</p></div>
                        <div><p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Último uso</p><p className="mt-1 text-xs font-semibold">{formatDate(credential.ultimoUso)}</p></div>
                        <div><p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Respaldo</p><p className="mt-1 text-xs font-semibold">{credential.respaldada ? 'Sincronizada' : 'Solo dispositivo'}</p></div>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap gap-1.5">{credential.sedes.map((site) => <Badge key={site} variant="outline">{SEDES.find((item) => item.value === site)?.label}</Badge>)}</div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" disabled={working} onClick={() => void toggleCredential(credential)} title={credential.activo ? 'Bloquear acceso' : 'Activar acceso'}>
                            {credential.activo ? <LockKeyhole className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4 text-green-500" />}
                          </Button>
                          <Button variant="ghost" size="sm" disabled={working} onClick={() => openEdit(credential)} title="Editar asignación"><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="sm" disabled={working} onClick={() => setDeleteTarget(credential)} title="Eliminar acceso" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <Dialog open={dialogMode !== null} onOpenChange={(open) => { if (!open && !working) { setDialogMode(null); resetForm(); } }}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border-primary/20">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl font-black uppercase italic">
              {dialogMode === 'register' ? <Fingerprint className="h-6 w-6 text-primary" /> : <Pencil className="h-6 w-6 text-primary" />}
              {dialogMode === 'register' ? 'Registrar biometría' : 'Editar asignación'}
            </DialogTitle>
            <DialogDescription>
              Vincula la passkey con una cuenta real. La función se obtiene automáticamente de su perfil para impedir asignaciones falsas.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label htmlFor="biometric-user">Cuenta vinculada</Label>
              <select id="biometric-user" value={selectedUid} onChange={(event) => selectUser(event.target.value)} className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm">
                <option value="">Selecciona una persona...</option>
                {users.map((item) => <option key={item.uid} value={item.uid} disabled={!item.activo}>{item.nombre} · {LABEL_ROL[item.rol]}{!item.activo ? ' · Inactiva' : ''}</option>)}
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="biometric-name">Nombre visible</Label><Input id="biometric-name" value={personName} onChange={(event) => setPersonName(event.target.value)} placeholder="Nombre de la persona" className="h-12 rounded-xl" /></div>
              <div className="space-y-2"><Label>Función autorizada</Label><div className="flex h-12 items-center rounded-xl border border-input bg-muted/40 px-4 font-bold">{selectedUser ? LABEL_ROL[selectedUser.rol] : 'Selecciona una cuenta'}</div></div>
            </div>

            <div className="space-y-2">
              <Label>Sedes autorizadas</Label>
              <div className="grid gap-3 sm:grid-cols-3">
                {SEDES.map((site) => {
                  const allowed = selectedUser?.sedes.includes(site.value) === true;
                  const checked = selectedSites.includes(site.value);
                  return (
                    <button key={site.value} type="button" disabled={!allowed} onClick={() => toggleSite(site.value)} className={`flex min-h-14 items-center justify-between rounded-xl border px-4 text-left text-sm font-black uppercase transition-colors ${checked ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground'} disabled:cursor-not-allowed disabled:opacity-35`}>
                      {site.label}{checked ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5 opacity-30" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {dialogMode === 'edit' && (
              <div className="flex items-center justify-between rounded-2xl border border-border bg-muted/20 p-4">
                <div><p className="font-black uppercase">Acceso activo</p><p className="text-sm text-muted-foreground">Al bloquearlo, esta passkey deja de iniciar sesión.</p></div>
                <Switch checked={enabled} onCheckedChange={setEnabled} />
              </div>
            )}

            {dialogMode === 'register' && (
              <div className="flex gap-3 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 text-sm text-muted-foreground">
                <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-blue-500" />
                <p>Al continuar, el dispositivo pedirá huella, rostro o PIN. Albatros nunca recibe ni almacena los datos biométricos.</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" disabled={working} onClick={() => { setDialogMode(null); resetForm(); }}>Cancelar</Button>
            <Button disabled={working || !selectedUid || !personName.trim() || selectedSites.length === 0} onClick={() => void (dialogMode === 'register' ? registerCredential() : saveCredential())} className="font-black uppercase">
              {working && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {dialogMode === 'register' ? 'Continuar con biometría' : 'Guardar cambios'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open && !working) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle className="font-black uppercase">¿Eliminar acceso biométrico?</AlertDialogTitle><AlertDialogDescription>Se eliminará la passkey de {deleteTarget?.nombrePersona}. Para volver a usar ese dispositivo deberá registrarse otra vez.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={working}>Conservar</AlertDialogCancel><AlertDialogAction disabled={working} onClick={(event) => { event.preventDefault(); void deleteCredential(); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{working && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Eliminar definitivamente</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
