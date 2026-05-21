import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { db } from "../lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function RecetaPrint() {
  const { clinicId, patientId, recordId } = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!clinicId || !patientId || !recordId) return;
      try {
        const ptSnap = await getDoc(doc(db, "clinics", clinicId, "patients", patientId));
        const recSnap = await getDoc(doc(db, "clinics", clinicId, "records", recordId));
        
        if (ptSnap.exists() && recSnap.exists()) {
          setData({
            patient: ptSnap.data(),
            record: recSnap.data()
          });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [clinicId, patientId, recordId]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  if (!data) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50">Registro no encontrado.</div>;
  }

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-100 py-8 print:py-0 print:bg-white text-slate-900">
      <div className="max-w-2xl mx-auto bg-white shadow-xl min-h-[850px] relative p-12 rounded-lg border border-slate-200 print:shadow-none print:border-none print:p-0 print:min-h-auto">
        
        {/* Header no-print controls */}
        <div className="absolute top-4 right-4 print:hidden">
          <Button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700">
            <Printer className="w-4 h-4 mr-2" /> Imprimir Receta
          </Button>
        </div>

        {/* Receta Header */}
        <div className="border-b-2 border-slate-800 pb-6 mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-serif text-slate-800">Clínica Médica Integral</h1>
            <p className="text-sm text-slate-500 mt-1 uppercase tracking-wider font-medium">Recetario Médico</p>
          </div>
          <div className="text-right text-sm text-slate-600 space-y-1">
            <p>123 Avenida Salud, Ciudad Médica</p>
            <p>Tel: (555) 123-4567</p>
            <p className="font-semibold text-slate-800 mt-2">Dr. Titular a Cargo</p>
            <p className="text-xs">Cédula Prof: 12345678</p>
          </div>
        </div>

        {/* Patient Info */}
        <div className="grid grid-cols-2 gap-4 mb-8 text-sm pb-6 border-b border-slate-200">
          <div>
            <span className="text-xs text-slate-500 uppercase font-semibold">Paciente</span>
            <p className="text-lg font-medium text-slate-900 leading-snug">{data.patient.name}</p>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-500 uppercase font-semibold">Fecha</span>
            <p className="text-lg text-slate-900 leading-snug">
              {new Date(data.record.date).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div>
             <span className="text-xs text-slate-500 uppercase font-semibold">Edad / Sexo</span>
             <p className="text-slate-900">{(data.patient.edad || "N/D")} años / {(data.patient.sexo || "N/D")}</p>
          </div>
          <div className="text-right">
             <span className="text-xs text-slate-500 uppercase font-semibold">Peso / Presión</span>
             <p className="text-slate-900">{(data.patient.peso || "N/D")} / {(data.patient.presion || "N/D")}</p>
          </div>
        </div>

        {/* Rx Symbol */}
        <div className="mb-4">
          <span className="text-4xl font-serif font-bold text-slate-800">Rx</span>
        </div>

        {/* Prescription content */}
        <div className="min-h-[300px] text-lg leading-relaxed whitespace-pre-wrap text-slate-800">
          {data.record.content}
        </div>

        {/* Footer info */}
        <div className="absolute bottom-12 left-12 right-12 border-t border-slate-300 pt-8 print:bottom-0">
          <div className="flex justify-between items-center text-sm">
             <div className="text-slate-500">
               <p>Firma del Páciente: _________________</p>
               <p className="mt-4 text-xs italic">La receta tiene validez de 72 horas desde su expedición.</p>
             </div>
             <div className="text-center">
               <div className="w-48 border-b border-slate-800 mb-2"></div>
               <p className="font-semibold text-slate-800">Firma del Médico</p>
             </div>
          </div>
        </div>

      </div>
    </div>
  );
}
