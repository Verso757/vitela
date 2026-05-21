import { useState, useEffect } from "react";
import { Save, User, Building, Shield, Bell, CreditCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";

export default function Configuracion() {
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Profile
  const [profile, setProfile] = useState({
    name: "",
    lastName: "",
    specialty: "",
    cedulaProfesional: "",
    cedulaEspecialidad: "",
    email: ""
  });

  // Clinic
  const [clinic, setClinic] = useState({
    name: "",
    rfc: "",
    regimen: "",
    address: ""
  });

  useEffect(() => {
    async function loadData() {
      if (!user?.id) {
        setLoading(false);
        return;
      }
      try {
        const userDoc = await getDoc(doc(db, "users", user.id));
        if (userDoc.exists()) {
          const d = userDoc.data();
          setProfile({
            name: d.name || "",
            lastName: d.lastName || "",
            specialty: d.specialty || "",
            cedulaProfesional: d.cedulaProfesional || "",
            cedulaEspecialidad: d.cedulaEspecialidad || "",
            email: d.email || ""
          });
        }

        if (user.clinicId) {
          const clinicDoc = await getDoc(doc(db, "clinics", user.clinicId));
          if (clinicDoc.exists()) {
            const c = clinicDoc.data();
            setClinic({
              name: c.name || "",
              rfc: c.rfc || "",
              regimen: c.regimen || "",
              address: c.address || ""
            });
          }
        }
      } catch (err) {
        console.error(err);
        toast.error("Error al cargar la configuración");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [user]);

  const handleSave = async () => {
    if (!user?.id) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, "users", user.id), {
        name: profile.name,
        specialty: profile.specialty,
        cedulaProfesional: profile.cedulaProfesional,
        cedulaEspecialidad: profile.cedulaEspecialidad,
      });

      if (user.clinicId) {
        await updateDoc(doc(db, "clinics", user.clinicId), {
          name: clinic.name,
          rfc: clinic.rfc,
          regimen: clinic.regimen,
          address: clinic.address
        });
      }
      
      toast.success("Configuración guardada exitosamente");
    } catch(err) {
      console.error(err);
      toast.error("Error al guardar la configuración");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return <div className="flex p-10 justify-center"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>;
  }

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Configuración</h1>
          <p className="text-slate-500 mt-1">Administra la cuenta de tu clínica, facturación y preferencias.</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm">
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} {isSaving ? "Guardando..." : "Guardar Cambios"}
        </Button>
      </div>

      <Tabs defaultValue="perfil" className="w-full">
        <TabsList className="bg-slate-100 border-none p-1 rounded-xl">
          <TabsTrigger value="perfil" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
             <User className="w-4 h-4 mr-2" /> Mi Perfil
          </TabsTrigger>
          <TabsTrigger value="clinica" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
             <Building className="w-4 h-4 mr-2" /> Clínica / Consultorio
          </TabsTrigger>
          <TabsTrigger value="personal" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
             <User className="w-4 h-4 mr-2" /> Personal y Roles
          </TabsTrigger>
          <TabsTrigger value="suscripcion" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
             <CreditCard className="w-4 h-4 mr-2" /> Suscripción (SaaS)
          </TabsTrigger>
        </TabsList>
        
        <div className="mt-6">
          <TabsContent value="perfil" className="space-y-6 outline-none">
            <Card className="rounded-2xl border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Información Personal</CardTitle>
                <CardDescription>Estos datos se utilizarán para la firma de tus recetas.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className="space-y-2 lg:col-span-2">
                      <Label>Nombre Completo</Label>
                      <Input value={profile.name} onChange={e => setProfile({...profile, name: e.target.value})} className="bg-slate-50 rounded-xl border-slate-200" />
                   </div>
                   <div className="space-y-2">
                      <Label>Especialidad</Label>
                      <Input value={profile.specialty} onChange={e => setProfile({...profile, specialty: e.target.value})} placeholder="Ej. Cardiología" className="bg-slate-50 rounded-xl border-slate-200" />
                   </div>
                   <div className="space-y-2">
                      <Label>Correo de Contacto</Label>
                      <Input disabled value={profile.email} className="bg-slate-50 rounded-xl border-slate-200 text-slate-500" />
                   </div>
                   <div className="space-y-2">
                      <Label>Cédula Profesional</Label>
                      <Input value={profile.cedulaProfesional} onChange={e => setProfile({...profile, cedulaProfesional: e.target.value})} className="bg-slate-50 rounded-xl border-slate-200" />
                   </div>
                   <div className="space-y-2">
                      <Label>Cédula de Especialidad</Label>
                      <Input value={profile.cedulaEspecialidad} onChange={e => setProfile({...profile, cedulaEspecialidad: e.target.value})} className="bg-slate-50 rounded-xl border-slate-200" />
                   </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="clinica" className="outline-none">
             <Card className="rounded-2xl border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Datos de Facturación y Clínica</CardTitle>
                <CardDescription>Información del CFDI 4.0 y ubicación para recetario físico.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className="space-y-2 md:col-span-2">
                      <Label>Razón Social / Nombre Comercial</Label>
                      <Input value={clinic.name} onChange={e => setClinic({...clinic, name: e.target.value})} className="bg-slate-50 rounded-xl border-slate-200" />
                   </div>
                   <div className="space-y-2">
                      <Label>RFC</Label>
                      <Input value={clinic.rfc} onChange={e => setClinic({...clinic, rfc: e.target.value})} placeholder="XAXX010101000" className="bg-slate-50 rounded-xl border-slate-200" />
                   </div>
                   <div className="space-y-2">
                      <Label>Régimen Fiscal</Label>
                      <Input value={clinic.regimen} onChange={e => setClinic({...clinic, regimen: e.target.value})} placeholder="601 - General de Ley Personas Morales" className="bg-slate-50 rounded-xl border-slate-200" />
                   </div>
                   <div className="space-y-2 md:col-span-2">
                      <Label>Dirección del Consultorio</Label>
                      <Input value={clinic.address} onChange={e => setClinic({...clinic, address: e.target.value})} placeholder="Av. Principal #123..." className="bg-slate-50 rounded-xl border-slate-200" />
                   </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="personal" className="outline-none">
             <Card className="rounded-2xl border-slate-200 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="text-lg">Personal Autorizado</CardTitle>
                  <CardDescription>Invita y gestiona el acceso de asistentes y otros médicos a tu clínica.</CardDescription>
                </div>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm">
                  + Invitar
                </Button>
              </CardHeader>
              <CardContent className="space-y-4 max-h-[400px] overflow-y-auto mt-2">
                <div className="flex items-center justify-between p-4 border border-slate-100 bg-slate-50 rounded-xl">
                   <div className="flex items-center gap-4">
                     <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold uppercase">
                       {profile.name.substring(0,2)}
                     </div>
                     <div>
                       <p className="font-medium text-slate-900">{profile.name || 'Propietario'}</p>
                       <p className="text-sm text-slate-500">{profile.email}</p>
                     </div>
                   </div>
                   <div className="flex items-center gap-3">
                     <span className="px-2.5 py-1 text-xs font-medium bg-emerald-100 text-emerald-800 rounded-full">Propietario</span>
                     <Button variant="ghost" size="sm" className="hidden" disabled>Editar</Button>
                   </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="suscripcion" className="outline-none">
             <Card className="rounded-2xl border-slate-200 shadow-sm border-blue-100 overflow-hidden">
              <div className="bg-blue-50/50 p-6 border-b border-blue-100 flex flex-col md:flex-row justify-between items-center gap-4">
                 <div>
                    <h3 className="font-semibold text-blue-900 text-lg">Plan Profesional Timbres Ilimitados</h3>
                    <p className="text-blue-700/80 text-sm mt-1">Suscripción Activa</p>
                 </div>
                 <Button variant="outline" className="bg-white text-blue-700 border-blue-200 hover:bg-blue-50">Gestionar Plan</Button>
              </div>
              <CardContent className="p-6">
                 <div className="space-y-4">
                    <h4 className="font-medium text-slate-900">Uso de este mes</h4>
                    <div className="space-y-3">
                       <div>
                          <div className="flex justify-between text-sm mb-1">
                             <span className="text-slate-600">Pacientes Activos</span>
                             <span className="font-medium">102 / ilimitados</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2">
                             <div className="bg-emerald-500 h-2 rounded-full" style={{ width: '15%' }}></div>
                          </div>
                       </div>
                       <div>
                          <div className="flex justify-between text-sm mb-1">
                             <span className="text-slate-600">Almacenamiento (Estudios médicos)</span>
                             <span className="font-medium">1.5GB / 50GB</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2">
                             <div className="bg-blue-500 h-2 rounded-full" style={{ width: '3%' }}></div>
                          </div>
                       </div>
                    </div>
                 </div>
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
