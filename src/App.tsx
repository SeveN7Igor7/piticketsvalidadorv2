import React, { useEffect, useState } from 'react';
import { QrCode, Ticket, AlertCircle, CheckCircle2, XCircle, ChevronDown, Loader2 } from 'lucide-react';
import firebase from 'firebase/app';
import 'firebase/database';
import { Html5Qrcode } from 'html5-qrcode';

// Initialize Firebase
const firebaseConfig = {
  apiKey: "AIzaSyB2JMVHvH8FKs_GEl8JVRoRfPDjY9Ztcf8",
  authDomain: "piauiticketsdb.firebaseapp.com",
  databaseURL: "https://piauiticketsdb-default-rtdb.firebaseio.com",
  projectId: "piauiticketsdb",
  storageBucket: "piauiticketsdb.appspot.com",
  messagingSenderId: "372256479753",
  appId: "1:372256479753:web:8b5890e8c94dc75daaf6d8"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const db = firebase.database();

function App() {
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [ticketCode, setTicketCode] = useState('');
  const [validationMessage, setValidationMessage] = useState('');
  const [showQrReader, setShowQrReader] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [ticketInfo, setTicketInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationSuccess, setValidationSuccess] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    db.ref('/eventos').once('value').then(snapshot => {
      const eventos = snapshot.val();
      const eventsList = [];
      for (const id in eventos) {
        eventsList.push({ id, name: eventos[id].nomeevento });
      }
      setEvents(eventsList);
      setIsLoading(false);
    });
  }, []);

  const validateTicket = async () => {
    if (!selectedEvent || !ticketCode) {
      setValidationMessage('Selecione um evento e insira o código do ingresso.');
      return;
    }

    setIsValidating(true);
    try {
      const snapshot = await db.ref(`/ingressos/${selectedEvent}/disponiveis/${ticketCode}`).once('value');
      const ticket = snapshot.val();
      console.log("Ingresso encontrado em /disponiveis/:", ticket);

      if (ticket) {
        setTicketInfo({
          eventName: events.find(e => e.id === selectedEvent)?.name,
          fullName: ticket.fullname || 'N/A',
          cpf: ticket.compradorcpf || 'N/A',
          type: ticket.tipo,
          isValidated: ticket.isvalidaded,
          rawTicket: ticket
        });
        setIsModalOpen(true);
        setValidationMessage('');
        setValidationSuccess(false);
      } else {
        setValidationMessage('Ingresso não encontrado, confira os dados novamente com o cliente.');
      }
    } catch (error) {
      console.error('Error validating ticket:', error);
      setValidationMessage('Erro ao validar o ingresso. Tente novamente.');
    } finally {
      setIsValidating(false);
    }
  };

  const handleFinalValidation = async () => {
    if (!ticketInfo) return;

    const ticketType = ticketInfo.type || 'Desconhecido';
    const ticket = ticketInfo.rawTicket;

    setIsValidating(true);
    try {
      await db.ref(`/ingressos/${selectedEvent}/disponiveis/${ticketCode}`).update({
        isvalidaded: true
      });

      const validatedTypeRef = db.ref(`/ingressos/${selectedEvent}/validados/${ticketType}`);
      const validatedSnapshot = await validatedTypeRef.once('value');
      
      if (!validatedSnapshot.exists()) {
        await validatedTypeRef.set({});
      }

      await db.ref(`/ingressos/${selectedEvent}/validados/${ticketType}/${ticketCode}`).set({
        ...ticket,
        isvalidaded: true
      });

      setTicketInfo(prev => ({ ...prev, isValidated: true }));
      setValidationSuccess(true);
    } catch (error) {
      console.error('Error validating ticket:', error);
      setValidationMessage('Erro ao validar o ingresso. Tente novamente.');
    } finally {
      setIsValidating(false);
    }
  };

  const startQrScanner = () => {
    setShowQrReader(true);
    const html5QrCode = new Html5Qrcode("qr-reader");
    html5QrCode.start(
      { facingMode: "environment" },
      {
        fps: 10,
        qrbox: 250
      },
      (decodedText) => {
        setTicketCode(decodedText);
        setShowQrReader(false);
        html5QrCode.stop();
      },
      (error) => {
        console.error(error);
      }
    ).catch(err => {
      console.error("Error starting scanner:", err);
    });
  };

  return (
    <div className="min-h-screen gradient-background text-white">
      <header className="bg-black/50 backdrop-blur-sm p-6 shadow-lg animate-slide-down">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <img src="/logo.png" alt="Logo PITICKETS" className="h-12 hover-glow" />
          <span className="text-sm bg-white/10 px-3 py-1 rounded-full">v1.3.0</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-8">
        <div className="glass-effect rounded-xl p-8 shadow-xl animate-fade-in hover-glow">
          <div className="flex items-center gap-3 mb-6 bg-yellow-500/10 p-4 rounded-lg">
            <AlertCircle className="text-yellow-400 animate-pulse-glow" />
            <p className="font-medium">Antes de usar essa ferramenta, por favor, leia as informações no final da página.</p>
          </div>

          <div className="space-y-6">
            <div className="relative">
              <label className="block text-sm font-medium mb-2">Selecione um evento:</label>
              <div className="relative">
                <select 
                  className="w-full bg-white/5 border border-white/20 rounded-lg p-4 pr-10 focus:ring-2 focus:ring-blue-500 transition appearance-none hover-glow"
                  value={selectedEvent}
                  onChange={(e) => setSelectedEvent(e.target.value)}
                  disabled={isLoading}
                >
                  <option value="">Selecione um evento</option>
                  {events.map(event => (
                    <option key={event.id} value={event.id}>{event.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Código do Ingresso:</label>
              <div className="relative">
                <input
                  type="text"
                  className="w-full bg-white/5 border border-white/20 rounded-lg p-4 pl-12 focus:ring-2 focus:ring-blue-500 transition hover-glow"
                  placeholder="Digite o código do ingresso"
                  value={ticketCode}
                  onChange={(e) => setTicketCode(e.target.value)}
                />
                <Ticket className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              </div>
            </div>

            <div className="flex gap-4">
              <button
                className="flex-1 bg-blue-600 hover:bg-blue-700 rounded-lg p-4 font-medium flex items-center justify-center gap-2 transition hover-glow disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={validateTicket}
                disabled={isValidating}
              >
                {isValidating ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <CheckCircle2 size={20} />
                )}
                Validar
              </button>
              
              <button
                className="flex-1 bg-purple-600 hover:bg-purple-700 rounded-lg p-4 font-medium flex items-center justify-center gap-2 transition hover-glow"
                onClick={startQrScanner}
              >
                <QrCode size={20} />
                Escanear QR Code
              </button>
            </div>

            {validationMessage && (
              <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 animate-shake">
                <p className="text-red-300">{validationMessage}</p>
              </div>
            )}

            {showQrReader && (
              <div id="qr-reader" className="mt-4 bg-black rounded-lg overflow-hidden animate-scale" />
            )}
          </div>
        </div>

        <section className="glass-effect rounded-xl p-8 shadow-xl animate-slide-up hover-glow">
          <h2 className="text-xl font-bold mb-4">Informações Importantes</h2>
          <div className="space-y-4 text-gray-300">
            <p className="bg-white/5 p-4 rounded-lg"><strong>Essa é uma área restrita e desenvolvida apenas para os organizadores e produtores de eventos.</strong></p>
            <p className="bg-white/5 p-4 rounded-lg"><strong>Não nos responsabilizamos pelo uso indevido e incorreto da ferramenta.</strong></p>
            <p className="bg-white/5 p-4 rounded-lg"><strong>Selecione e se atente ao evento selecionado para a validação do Ingressos. Cada Evento tem o armazenamento próprio dos ingressos vendidos.</strong></p>
          </div>
        </section>

        <section className="glass-effect rounded-xl p-8 shadow-xl animate-slide-up hover-glow bg-green-600/10">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <AlertCircle className="text-green-400" />
            Aconteceu algum erro? Precisa de ajuda?
          </h2>
          <p className="mb-6 text-gray-300">Entre em contato direto comigo, respondo rápido.</p>
          <a
            href="https://wa.me/5589994582600?text=Equipe%20de%20validação%20de%20Ingressos%20aqui,%20preciso%20de%20suporte%20urgente."
            className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 rounded-lg px-8 py-4 font-medium transition hover-glow"
            target="_blank"
            rel="noopener noreferrer"
          >
            <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" alt="WhatsApp" className="w-6 h-6" />
            Falar no WhatsApp
          </a>
        </section>
      </main>

      {isModalOpen && ticketInfo && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-gradient-to-b from-gray-900 to-gray-800 rounded-xl p-8 max-w-md w-full animate-scale text-white">
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-2xl font-bold">Informações do Ingresso</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-white transition hover-glow"
              >
                <XCircle size={24} />
              </button>
            </div>
            
            <div className="space-y-6">
              <div className="flex justify-center mb-8">
                {ticketInfo.isValidated ? (
                  <div className={`p-4 rounded-full ${validationSuccess ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'} animate-pulse-glow`}>
                    {validationSuccess ? <CheckCircle2 size={64} /> : <XCircle size={64} />}
                  </div>
                ) : (
                  <div className="bg-blue-500/20 text-blue-400 p-4 rounded-full animate-pulse-glow">
                    <CheckCircle2 size={64} />
                  </div>
                )}
              </div>
              
              <div className="space-y-4">
                <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                  <p className="text-gray-400 text-sm">Evento</p>
                  <p className="text-lg font-medium">{ticketInfo.eventName}</p>
                </div>
                <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                  <p className="text-gray-400 text-sm">Nome do Comprador</p>
                  <p className="text-lg font-medium">{ticketInfo.fullName}</p>
                </div>
                <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                  <p className="text-gray-400 text-sm">CPF do Comprador</p>
                  <p className="text-lg font-medium">{ticketInfo.cpf}</p>
                </div>
                <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                  <p className="text-gray-400 text-sm">Tipo</p>
                  <p className="text-lg font-medium">{ticketInfo.type || 'Não especificado'}</p>
                </div>
                <div className={`p-4 rounded-lg font-bold text-center ${
                  ticketInfo.isValidated 
                    ? validationSuccess
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                }`}>
                  {ticketInfo.isValidated 
                    ? validationSuccess
                      ? 'Ingresso validado com sucesso! Libere a entrada para o evento.'
                      : 'Ingresso já validado!'
                    : 'Ingresso pode ser validado!'}
                </div>
              </div>

              {!ticketInfo.isValidated && (
                <button
                  className="w-full bg-green-500 hover:bg-green-600 text-white rounded-lg p-4 font-medium transition hover-glow flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleFinalValidation}
                  disabled={isValidating}
                >
                  {isValidating ? (
                    <Loader2 className="animate-spin" size={20} />
                  ) : (
                    <CheckCircle2 size={20} />
                  )}
                  Validar Ingresso
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;