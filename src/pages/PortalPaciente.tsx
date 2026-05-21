import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { User, MessageCircle, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { db } from "../lib/firebase";
import { collection, query, orderBy, onSnapshot, getDoc, doc, addDoc, serverTimestamp } from "firebase/firestore";

interface Message {
  id: string;
  text: string;
  sender: 'patient' | 'doctor';
  createdAt: any;
}

export default function PortalPaciente() {
  const { clinicId, patientId } = useParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [patientName, setPatientName] = useState("Cargando...");
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadData() {
      if (!clinicId || !patientId) return;
      try {
        const ptDoc = await getDoc(doc(db, "clinics", clinicId, "patients", patientId));
        if (ptDoc.exists()) {
          setPatientName(ptDoc.data().name);
        } else {
          setPatientName("Paciente Desconocido");
        }
      } catch (e) {
        console.error(e);
      }
    }
    loadData();

    if (!clinicId || !patientId) return;
    const q = query(
      collection(db, "clinics", clinicId, "patients", patientId, "messages"),
      orderBy("createdAt", "asc")
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      setMessages(msgs);
      setLoading(false);
    });

    return () => unsub();
  }, [clinicId, patientId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !clinicId || !patientId) return;

    try {
      await addDoc(collection(db, "clinics", clinicId, "patients", patientId, "messages"), {
        text: newMessage,
        sender: 'patient',
        createdAt: serverTimestamp()
      });
      setNewMessage("");
    } catch (error) {
      console.error(error);
      alert("Error al enviar el mensaje");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg border-slate-200 shadow-xl rounded-3xl bg-white flex flex-col h-[600px] overflow-hidden">
        <CardHeader className="bg-blue-600 text-white rounded-t-3xl pb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
              <User className="w-6 h-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl">Portal del Paciente</CardTitle>
              <CardDescription className="text-blue-100 mt-1">
                Hola, {patientName}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
          <div className="bg-amber-50 p-3 text-xs text-amber-700 font-medium text-center border-b border-amber-100 flex items-center justify-center gap-2">
            <MessageCircle className="w-4 h-4" /> Comunícate directamente con tu médico
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
            {loading ? (
              <div className="flex justify-center p-10"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
            ) : messages.length === 0 ? (
              <div className="text-center text-slate-500 mt-10">
                <p>No hay mensajes aún.</p>
                <p className="text-sm mt-1">Escribe tu primer mensaje abajo.</p>
              </div>
            ) : (
              messages.map(msg => {
                const isPatient = msg.sender === 'patient';
                return (
                  <div key={msg.id} className={`flex ${isPatient ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                      isPatient 
                        ? 'bg-blue-600 text-white rounded-br-sm' 
                        : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm shadow-sm'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-slate-100 flex gap-2">
            <Input 
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              placeholder="Escribe un mensaje..."
              className="rounded-xl flex-1 bg-slate-50 border-slate-200"
            />
            <Button type="submit" disabled={!newMessage.trim()} className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white w-12 h-10 p-0 flex items-center justify-center">
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
