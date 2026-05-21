import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Plus, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, User as UserIcon, MessageCircle, Copy, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../lib/firebase";
import { collection, onSnapshot, query, where, addDoc, getDoc, doc, updateDoc, deleteDoc } from "firebase/firestore";

interface Appointment {
  id: string;
  patientId: string;
  patientName?: string;
  date: string;
  time: string;
  type?: string;
  status: string;
}

interface Patient {
  id: string;
  nombre: string;
  tel?: string;
}

interface PublicRequest {
  id: string;
  name: string;
  phone: string;
  reason: string;
  date: string;
  time: string;
  status: string;
}

export default function Agenda() {
  const { user } = useAuth();
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [publicRequests, setPublicRequests] = useState<PublicRequest[]>([]);

  // Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newAppt, setNewAppt] = useState({
    patientId: "",
    time: "09:00",
    type: "Primera vez"
  });

  useEffect(() => {
    if (!user?.clinicId) return;

    // Fetch Patients for the select dropdown
    const patientsUnsub = onSnapshot(collection(db, "clinics", user.clinicId, "patients"), (snapshot) => {
      const pts: Patient[] = [];
      snapshot.forEach(doc => pts.push({ id: doc.id, nombre: doc.data().name || doc.data().nombre, tel: doc.data().tel }));
      setPatients(pts);
    });

    // Fetch pending requests
    const reqsQuery = query(collection(db, "clinics", user.clinicId, "public_requests"), where("status", "==", "pending"));
    const reqsUnsub = onSnapshot(reqsQuery, (snapshot) => {
      const reqs: PublicRequest[] = [];
      snapshot.forEach(doc => reqs.push({id: doc.id, ...doc.data()} as PublicRequest));
      setPublicRequests(reqs);
    });

    return () => {
      patientsUnsub();
      reqsUnsub();
    };
  }, [user]);

  useEffect(() => {
    if (!user?.clinicId || !date) return;
    setLoading(true);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;

    const apptQuery = query(
      collection(db, "clinics", user.clinicId, "appointments"),
      where("date", "==", dateString)
    );

    const apptUnsub = onSnapshot(apptQuery, async (snapshot) => {
      const appts: Appointment[] = [];
      
      // Fetch names concurrently (in real app, might want to denormalize patientName into appointment, or use join query)
      const fetchNamesPromises = snapshot.docs.map(async (d) => {
        const data = d.data();
        let patientName = "Paciente Desconocido";
        try {
          const ptDoc = await getDoc(doc(db, "clinics", user.clinicId, "patients", data.patientId));
          if (ptDoc.exists()) patientName = ptDoc.data().nombre;
        } catch(e) {}
        
        return {
          id: d.id,
          ...data,
          patientName
        } as Appointment;
      });

      const resolvedAppts = await Promise.all(fetchNamesPromises);
      setAppointments(resolvedAppts);
      setLoading(false);
    });

    return () => apptUnsub();
  }, [user, date]);

  const handleDayChange = (offset: number) => {
    if (date) {
      const newDate = new Date(date);
      newDate.setDate(date.getDate() + offset);
      setDate(newDate);
    }
  };

  const handleAddAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.clinicId || !date || !newAppt.patientId) return;
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;

    try {
      setIsSubmitting(true);
      await addDoc(collection(db, "clinics", user.clinicId, "appointments"), {
        patientId: newAppt.patientId,
        date: dateString,
        time: newAppt.time,
        type: newAppt.type,
        status: "confirmado"
      });
      setIsDialogOpen(false);
      setNewAppt({ ...newAppt, patientId: "" });
      toast.success("Cita agendada correctamente");
    } catch(err) {
      console.error(err);
      toast.error("Error al agendar la cita");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyLink = () => {
    if (!user?.clinicId) return;
    const url = window.location.origin + "/reserva/" + user.clinicId;
    navigator.clipboard.writeText(url);
    toast("Link copiado al portapapeles", {
      description: "Compártelo con tus pacientes para que agenden solos.",
    });
  };

  const handleApproveRequest = async (req: PublicRequest) => {
    if (!user?.clinicId) return;
    try {
      // Find if patient exists by phone or name, simple approach: just add as new patient if not found by name
      let patientId;
      const existing = patients.find(p => p.tel === req.phone || p.nombre.toLowerCase() === req.name.toLowerCase());
      
      if (existing) {
        patientId = existing.id;
      } else {
        const docRef = await addDoc(collection(db, "clinics", user.clinicId, "patients"), {
          name: req.name,
          tel: req.phone,
          edad: 0,
          sexo: 'O'
        });
        patientId = docRef.id;
      }

      await addDoc(collection(db, "clinics", user.clinicId, "appointments"), {
        patientId,
        date: req.date,
        time: req.time,
        type: "Consulta",
        status: "confirmado"
      });

      await updateDoc(doc(db, "clinics", user.clinicId, "public_requests", req.id), {
        status: "approved"
      });

      toast.success("Cita aceptada y agendada.");
    } catch(e) {
      console.error(e);
      toast.error("Error al aprobar la cita.");
    }
  };

  const handleRejectRequest = async (reqId: string) => {
    if (!user?.clinicId) return;
    try {
      await updateDoc(doc(db, "clinics", user.clinicId, "public_requests", reqId), {
        status: "rejected"
      });
      toast.success("Solicitud rechazada");
    } catch(e) {
      console.error(e);
      toast.error("Error al rechazar");
    }
  };

  // Helper to map type to colors
  const getTypeColor = (type: string) => {
    if (type === "Primera vez") return "bg-emerald-100 text-emerald-700 border-emerald-200";
    if (type === "Segunda vez" || type === "Seguimiento") return "bg-blue-100 text-blue-700 border-blue-200";
    if (type === "Resultados") return "bg-violet-100 text-violet-700 border-violet-200";
    if (type === "Urgencia") return "bg-red-100 text-red-700 border-red-200";
    return "bg-slate-100 text-slate-700 border-slate-200";
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Agenda Médica</h1>
          <p className="text-slate-500 mt-1">Gestiona tus citas y horarios de atención.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="text-blue-600 border-blue-200 bg-blue-50 shadow-sm" onClick={handleCopyLink}>
             <Copy className="mr-2 h-4 w-4" /> Link Portal
          </Button>
          <Button onClick={() => setIsDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm">
            <Plus className="mr-2 h-4 w-4" /> Agendar Cita
          </Button>
        </div>
      </div>

      {publicRequests.length > 0 && (
        <Card className="border-blue-200 shadow-sm bg-blue-50/50">
          <CardHeader className="pb-3 border-b border-blue-100">
            <CardTitle className="text-base text-blue-900 flex items-center">
              <Clock className="w-5 h-5 mr-2" /> Solicitudes Pendientes ({publicRequests.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            {publicRequests.map(req => (
              <div key={req.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-white rounded-xl border border-blue-100 shadow-sm">
                <div>
                  <p className="font-semibold text-slate-900 leading-tight">{req.name}</p>
                  <p className="text-sm text-slate-500">{req.date} a las {req.time} • Tel: {req.phone}</p>
                  {(req.reason && req.reason !== "Sin especificar") && <p className="text-xs text-slate-600 mt-1 italic">"{req.reason}"</p>}
                </div>
                <div className="flex gap-2 mt-3 sm:mt-0">
                  <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleRejectRequest(req.id)}>
                    <XCircle className="w-4 h-4 mr-1" /> Rechazar
                  </Button>
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleApproveRequest(req)}>
                    <CheckCircle2 className="w-4 h-4 mr-1" /> Aprobar
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleAddAppointment}>
            <DialogHeader>
              <DialogTitle>Agendar Nueva Cita</DialogTitle>
              <DialogDescription>
                Selecciona un paciente y la hora para el día {date?.toLocaleDateString()}.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="patientId">Paciente</Label>
                <select 
                  id="patientId"
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={newAppt.patientId}
                  onChange={(e) => setNewAppt({...newAppt, patientId: e.target.value})}
                >
                  <option value="" disabled>Selecciona un paciente</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="time">Hora</Label>
                  <Input 
                    id="time" 
                    type="time"
                    required
                    value={newAppt.time}
                    onChange={(e) => setNewAppt({...newAppt, time: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Tipo de Cita</Label>
                  <select 
                    id="type"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={newAppt.type}
                    onChange={(e) => setNewAppt({...newAppt, type: e.target.value})}
                  >
                    <option value="Primera vez">Primera vez</option>
                    <option value="Seguimiento">Seguimiento</option>
                    <option value="Resultados">Resultados</option>
                    <option value="Urgencia">Urgencia</option>
                  </select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={isSubmitting || patients.length === 0} className="bg-blue-600 hover:bg-blue-700">
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin"/>} Guardar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Col: Calendar */}
        <div className="lg:col-span-4 xl:col-span-3 space-y-6">
          <Card className="rounded-2xl border-slate-200 shadow-sm overflow-hidden text-center bg-white">
             <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                className="p-3 mx-auto"
              />
          </Card>
          
          <Card className="rounded-2xl border-slate-200 shadow-sm">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-sm font-semibold">Leyenda</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-400"></div><span className="text-sm text-slate-600">Primera vez</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-400"></div><span className="text-sm text-slate-600">Seguimiento</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-violet-400"></div><span className="text-sm text-slate-600">Resultados</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-400"></div><span className="text-sm text-slate-600">Urgencias</span></div>
            </CardContent>
          </Card>
        </div>

        {/* Right Col: Daily Schedule view */}
        <Card className="lg:col-span-8 xl:col-span-9 rounded-2xl border-slate-200 shadow-sm bg-white">
          <div className="flex items-center justify-between p-4 border-b border-slate-200">
             <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => handleDayChange(-1)} className="h-8 w-8 rounded-lg"><ChevronLeft className="h-4 w-4" /></Button>
                <div className="w-48 text-center font-medium flex items-center justify-center gap-2">
                   <CalendarIcon className="h-4 w-4 text-slate-400" />
                   {date ? date.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }) : 'Selecciona un día'}
                </div>
                <Button variant="outline" size="icon" onClick={() => handleDayChange(1)} className="h-8 w-8 rounded-lg"><ChevronRight className="h-4 w-4" /></Button>
             </div>
             <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setDate(new Date())} className="hidden sm:flex rounded-lg">Hoy</Button>
             </div>
          </div>
          <CardContent className="p-0">
             <div className="divide-y divide-slate-100 relative min-h-[400px]">
                {loading && (
                  <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                  </div>
                )}
                {/* Generates a simple timeline */}
                {['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00'].map((hour) => {
                  return (
                    <div key={hour} className="flex min-h-[80px] group relative">
                       <div className="w-20 p-4 border-r border-slate-100 text-xs font-mono text-slate-400 shrink-0 select-none text-right">
                          {hour}
                       </div>
                       <div className="flex-1 p-2 relative bg-slate-50/20 group-hover:bg-slate-50 transition-colors">
                          <div className="flex flex-col gap-2">
                             {appointments.filter(c => c.time.startsWith(hour.split(':')[0])).map(cita => (
                               <div key={cita.id} className={`p-3 rounded-xl border ${getTypeColor(cita.type || '')} shadow-sm backdrop-blur-sm cursor-pointer hover:shadow-md transition-shadow relative overflow-hidden`}>
                                 <div className="absolute left-0 top-0 bottom-0 w-1 bg-current opacity-20"></div>
                                 <div className="flex justify-between items-start">
                                    <div className="font-semibold text-sm flex items-center gap-1.5">
                                      <UserIcon className="w-4 h-4 opacity-70" />
                                      {cita.patientName}
                                      {cita.status === 'confirmado' && (
                                        <MessageCircle className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600 ml-1" />
                                      )}
                                    </div>
                                    <div className="text-xs font-mono font-medium flex items-center gap-1 opacity-80">
                                      <Clock className="w-3 h-3" />
                                      {cita.time}
                                    </div>
                                 </div>
                                 <div className="flex justify-between mt-1 items-end">
                                    <div className="text-xs opacity-90">{cita.type} • {cita.status}</div>
                                 </div>
                               </div>
                             ))}
                          </div>
                       </div>
                    </div>
                  )
                })}
             </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

