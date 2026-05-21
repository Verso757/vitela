import React, { useState, useEffect } from "react";
import { Download, FileText, Plus, Search, Filter, MoreHorizontal, FileCheck, XCircle, AlertCircle, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../lib/firebase";
import { collection, onSnapshot, query, addDoc, updateDoc, doc } from "firebase/firestore";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface Factura {
  id: string;
  paciente: string;
  rfc: string;
  monto: number;
  fecha: string;
  estado: string;
  usoCFDI?: string;
  metodoPago?: string;
}

export default function Facturacion() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [loading, setLoading] = useState(true);

  // New Factura Dialog
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newFactura, setNewFactura] = useState({
    paciente: "",
    rfc: "",
    monto: "",
    usoCFDI: "D01 - Honorarios médicos",
    metodoPago: "PUE"
  });

  useEffect(() => {
    if (!user?.clinicId) return;

    const q = query(collection(db, "clinics", user.clinicId, "invoices"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Factura[] = [];
      snapshot.forEach(doc => data.push({id: doc.id, ...doc.data()} as Factura));
      data.sort((a,b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
      setFacturas(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.clinicId]);

  const handleAddFactura = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.clinicId || !newFactura.paciente || !newFactura.rfc) return;

    try {
      setIsSubmitting(true);
      await addDoc(collection(db, "clinics", user.clinicId, "invoices"), {
        paciente: newFactura.paciente,
        rfc: newFactura.rfc,
        monto: parseFloat(newFactura.monto) || 0,
        fecha: new Date().toISOString(),
        estado: "Pendiente",
        usoCFDI: newFactura.usoCFDI,
        metodoPago: newFactura.metodoPago
      });
      setIsDialogOpen(false);
      setNewFactura({ paciente: "", rfc: "", monto: "", usoCFDI: "D01 - Honorarios médicos", metodoPago: "PUE" });
      toast.success("Factura borrador creada correctamente");
    } catch(err) {
      console.error(err);
      toast.error("Error al crear la factura");
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateEstado = async (id: string, estado: string) => {
    if (!user?.clinicId) return;
    try {
      if (estado === 'Timbrada') {
        const factura = facturas.find(f => f.id === id);
        if(!factura) return;
        
        toast.info("Generando CFDI...", { id: "facturar_toast" });
        const req = await fetch("/api/facturar", {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify(factura)
        });
        const res = await req.json();

        if (res.status === "success") {
          await updateDoc(doc(db, "clinics", user.clinicId, "invoices", id), { 
            estado, 
            cfdiFolio: res.cfdiResponse.Folio,
            cfdiUuid: res.cfdiResponse.Uuid 
          });
          toast.success(`Factura timbrada exitosamente (Folio: ${res.cfdiResponse.Folio})`, { id: "facturar_toast" });
        } else {
          throw new Error(res.message);
        }
      } else {
        await updateDoc(doc(db, "clinics", user.clinicId, "invoices", id), { estado });
        toast.success(`Factura ${estado.toLowerCase()}`);
      }
    } catch(err: any) {
      console.error(err);
      toast.error(err.message || "Error al actualizar la factura", { id: "facturar_toast" });
    }
  };

  const filteredFacturas = facturas.filter(f => 
    f.paciente?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    f.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.rfc?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalFacturadoMes = facturas
      .filter(f => f.estado === "Timbrada" && new Date(f.fecha).getMonth() === new Date().getMonth())
      .reduce((sum, f) => sum + f.monto, 0);

  const pendientesToTimbrar = facturas.filter(f => f.estado === "Pendiente").length;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Facturación CFDI 4.0</h1>
          <p className="text-slate-500 mt-1">Administra y emite facturas conectadas al SAT.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="text-slate-700 bg-white shadow-sm border-slate-200">
            <Download className="mr-2 h-4 w-4" /> Exportar a Excel
          </Button>
          <Button onClick={() => setIsDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm">
            <Plus className="mr-2 h-4 w-4" /> Nueva Factura
          </Button>
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleAddFactura}>
            <DialogHeader>
              <DialogTitle>Nueva Factura (Borrador)</DialogTitle>
              <DialogDescription>
                Crea una factura pre-llenada antes de timbrarla.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="paciente">Nombre o Razón Social</Label>
                <Input 
                  id="paciente"
                  required
                  value={newFactura.paciente}
                  onChange={(e) => setNewFactura({...newFactura, paciente: e.target.value})}
                  placeholder="Ej. Juan Pérez"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                   <Label htmlFor="rfc">RFC</Label>
                   <Input 
                     id="rfc"
                     required
                     value={newFactura.rfc}
                     onChange={(e) => setNewFactura({...newFactura, rfc: e.target.value})}
                     placeholder="XAXX010101000"
                   />
                 </div>
                 <div className="space-y-2">
                   <Label htmlFor="monto">Monto Total</Label>
                   <Input 
                     id="monto"
                     type="number"
                     required
                     value={newFactura.monto}
                     onChange={(e) => setNewFactura({...newFactura, monto: e.target.value})}
                     placeholder="1500"
                   />
                 </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700">
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin"/>} Guardar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="border-slate-200 shadow-sm rounded-2xl p-5 bg-white">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">Total Facturado (Mes)</p>
              <h3 className="text-2xl font-bold text-slate-900">${totalFacturadoMes.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</h3>
            </div>
            <div className="bg-emerald-100 p-2 rounded-lg text-emerald-600">
              <FileCheck className="h-5 w-5" />
            </div>
          </div>
        </Card>
        <Card className="border-slate-200 shadow-sm rounded-2xl p-5 bg-white">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">Pendientes por Timbrar</p>
              <h3 className="text-2xl font-bold text-slate-900">{pendientesToTimbrar}</h3>
            </div>
            <div className="bg-amber-100 p-2 rounded-lg text-amber-600">
              <AlertCircle className="h-5 w-5" />
            </div>
          </div>
        </Card>
        <Card className="border-slate-200 shadow-sm rounded-2xl p-5 bg-white">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">Timbres Disponibles</p>
              <h3 className="text-2xl font-bold text-slate-900">945</h3>
            </div>
            <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
              <FileText className="h-5 w-5" />
            </div>
          </div>
        </Card>
      </div>

      <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-4 justify-between bg-white">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              type="search"
              placeholder="Buscar por folio, paciente o RFC..."
              className="w-full bg-slate-50 pl-9 border-slate-200 focus-visible:ring-1 focus-visible:ring-blue-500 rounded-lg"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-lg text-slate-600">
              <Filter className="mr-2 h-4 w-4" /> Filtros
            </Button>
          </div>
        </div>
        
        <div className="overflow-x-auto bg-white">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50/50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-medium tracking-wider">Folio / Fecha</th>
                <th className="px-6 py-4 font-medium tracking-wider">Cliente (Receptor)</th>
                <th className="px-6 py-4 font-medium tracking-wider">Monto</th>
                <th className="px-6 py-4 font-medium tracking-wider">Estado</th>
                <th className="px-6 py-4 font-medium tracking-wider text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredFacturas.map((factura) => (
                <tr key={factura.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-mono font-medium text-slate-900">{factura.id}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {new Date(factura.fecha).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{factura.paciente}</div>
                    <div className="text-xs text-slate-500 mt-0.5 font-mono">{factura.rfc} • {factura.usoCFDI}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">
                      ${factura.monto.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">{factura.metodoPago}</div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge 
                      variant="outline" 
                      className={`
                        ${factura.estado === 'Timbrada' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : ''}
                        ${factura.estado === 'Pendiente' ? 'bg-amber-50 text-amber-700 border-amber-200' : ''}
                        ${factura.estado === 'Cancelada' ? 'bg-red-50 text-red-700 border-red-200' : ''}
                      `}
                    >
                      {factura.estado === 'Timbrada' && <FileCheck className="w-3 h-3 mr-1" />}
                      {factura.estado === 'Cancelada' && <XCircle className="w-3 h-3 mr-1" />}
                      {factura.estado === 'Pendiente' && <AlertCircle className="w-3 h-3 mr-1" />}
                      {factura.estado}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger className="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 h-8 w-8 text-slate-400 hover:bg-slate-100 hover:text-slate-600 border border-transparent hover:border-slate-200 rounded-lg">
                        <span className="sr-only">Abrir menú</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-lg border-slate-200">
                           <DropdownMenuLabel>Acciones CFDI</DropdownMenuLabel>
                           <DropdownMenuSeparator />
                           <DropdownMenuItem disabled={factura.estado !== 'Timbrada'}>Descargar PDF</DropdownMenuItem>
                           <DropdownMenuItem disabled={factura.estado !== 'Timbrada'}>Descargar XML</DropdownMenuItem>
                           <DropdownMenuItem>Enviar por correo</DropdownMenuItem>
                           {factura.estado === 'Pendiente' && (
                             <>
                               <DropdownMenuSeparator />
                               <DropdownMenuItem onClick={() => updateEstado(factura.id, 'Timbrada')} className="text-blue-600 font-medium">Timbrar ahora</DropdownMenuItem>
                             </>
                           )}
                           {factura.estado === 'Timbrada' && (
                             <>
                               <DropdownMenuSeparator />
                               <DropdownMenuItem onClick={() => updateEstado(factura.id, 'Cancelada')} className="text-red-600 focus:text-red-600">Cancelar Factura</DropdownMenuItem>
                             </>
                           )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredFacturas.length === 0 && (
            <div className="py-12 text-center text-slate-500">
              No se encontraron facturas con ese criterio de búsqueda.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
