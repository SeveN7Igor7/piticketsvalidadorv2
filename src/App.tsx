import React, { useEffect, useState } from 'react';
import { QrCode, Ticket, AlertCircle, CheckCircle2, XCircle, ChevronDown, Loader2, Archive, CheckSquare, Tag } from 'lucide-react';
import firebase from 'firebase/app';
import 'firebase/database';
import { Html5Qrcode } from 'html5-qrcode';

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

interface ValidatedTypeCount {
  type: string;
  count: number;
}

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
  const [qrScanner, setQrScanner] = useState<Html5Qrcode | null>(null);
  const [scannedCode, setScannedCode] = useState<string | null>(null);

  // Ticket tracking state
  const [storedTickets, setStoredTickets] = useState(0);
  const [validatedTickets, setValidatedTickets] = useState(0);
  const [validatedTypesCounts, setValidatedTypesCounts] = useState<ValidatedTypeCount[]>([]);
  const [companyId, setCompanyId] = useState('');

  useEffect(() => {
    console.log('Loading events...');
    setIsLoading(true);
    db.ref('/eventos').once('value').then(snapshot => {
      const eventos = snapshot.val();
      console.log('Events loaded:', eventos);
      const eventsList = [];
      for (const id in eventos) {
        eventsList.push({ 
          id, 
          name: eventos[id].nomeevento,
          companyId: eventos[id].empresavinculada 
        });
      }
      console.log('Processed events list:', eventsList);
      setEvents(eventsList);
      setIsLoading(false);
    });
  }, []);

  useEffect(() => {
    console.log('Selected event changed:', selectedEvent);
    console.log('Current events:', events);

    if (!selectedEvent) {
      console.log('No event selected, resetting states');
      setStoredTickets(0);
      setValidatedTickets(0);
      setValidatedTypesCounts([]);
      setCompanyId('');
      return;
    }

    const event = events.find(e => e.id === selectedEvent);
    console.log('Found event:', event);

    if (event?.companyId) {
      console.log('Setting company ID:', event.companyId);
      setCompanyId(event.companyId);
      
      // Listen for stored tickets
      const storedRef = db.ref(`empresas/${event.companyId}/vendas/vendasrealizadas/${selectedEvent}`);
      console.log('Listening to stored tickets at:', storedRef.toString());

      storedRef.on('value', (snapshot) => {
        const tickets = snapshot.val();
        console.log('Stored tickets data:', tickets);
        const count = tickets ? Object.keys(tickets).length : 0;
        console.log('Stored tickets count:', count);
        setStoredTickets(count);
      });

      // Listen for validated tickets with type breakdown
      const validatedRef = db.ref(`/ingressos/${selectedEvent}/validados`);
      console.log('Listening to validated tickets at:', validatedRef.toString());

      validatedRef.on('value', (snapshot) => {
        const validatedTypes = snapshot.val();
        console.log('Validated tickets data:', validatedTypes);
        let totalValidated = 0;
        const typesCounts: ValidatedTypeCount[] = [];

        if (validatedTypes) {
          Object.entries(validatedTypes).forEach(([type, tickets]: [string, any]) => {
            const count = Object.keys(tickets).length;
            totalValidated += count;
            typesCounts.push({ type, count });
          });
        }

        console.log('Total validated:', totalValidated);
        console.log('Types breakdown:', typesCounts);
        setValidatedTickets(totalValidated);
        setValidatedTypesCounts(typesCounts);
      });

      return () => {
        console.log('Cleaning up listeners');
        storedRef.off();
        validatedRef.off();
      };
    }
  }, [selectedEvent, events]);

  // Effect to handle QR code validation after scanning
  useEffect(() => {
    if (scannedCode) {
      console.log('Scanned code changed, preparing validation:', scannedCode);
      const validateScannedCode = async () => {
        setTicketCode(scannedCode);
        await validateTicket(scannedCode);
        setScannedCode(null);
      };
      validateScannedCode();
    }
  }, [scannedCode]);

  const validateTicket = async (codeToValidate?: string) => {
    console.log('Starting ticket validation');
    console.log('Selected event:', selectedEvent);
    console.log('Ticket code to validate:', codeToValidate || ticketCode);

    const finalCode = codeToValidate || ticketCode;

    if (!selectedEvent) {
      console.log('Validation failed: No event selected');
      setValidationMessage('Por favor, selecione um evento antes de validar o ingresso.');
      return;
    }

    if (!finalCode) {
      console.log('Validation failed: No ticket code');
      setValidationMessage('Por favor, insira o código do ingresso.');
      return;
    }

    console.log('Validation prerequisites met, proceeding with validation');
    setIsValidating(true);
    try {
      console.log(`Checking ticket at path: /ingressos/${selectedEvent}/disponiveis/${finalCode}`);
      const snapshot = await db.ref(`/ingressos/${selectedEvent}/disponiveis/${finalCode}`).once('value');
      const ticket = snapshot.val();
      console.log("Ticket data found:", ticket);

      if (ticket) {
        console.log('Setting ticket info');
        const eventName = events.find(e => e.id === selectedEvent)?.name;
        console.log('Event name:', eventName);
        
        setTicketInfo({
          eventName: eventName,
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
        console.log('No ticket found');
        setValidationMessage('Ingresso não encontrado, confira os dados novamente com o cliente.');
      }
    } catch (error) {
      console.error('Error validating ticket:', error);
('Ingresso não encontrado, confira os dados novamente com o cliente.');
      }
    } catch (error) {
      console.error('10. Erro ao validar ingresso:', error);
og('Starting final validation');
    console.log('Ticket info:', ticketInfo);

    if (!ticketInfo) {
      console.log('No ticket info available');
      return;
    }

    const ticketType = ticketInfo.type || 'Desconhecido';
    const ticket = ticketInfo.rawTicket;
    console.log('Ticket type:', ticketType);
    console.log('Raw ticket data:', ticket);

    setIsValidating(true);
    try {
      console.log('Updating ticket validation status');
      await db.ref(`/ingressos/${selectedEvent}/disponiveis/${ticketCode}`).update({
        isvalidaded: true
      });

      const validatedTypeRef = db.ref(`/ingressos/${selectedEvent}/validados/${ticketType}`);
      console.log('Checking validated type ref:', validatedTypeRef.toString());
      const validatedSnapshot = await validatedTypeRef.once('value');
      
      if (!validatedSnapshot.exists()) {
        console.log('Creating new validated type entry');
        await validatedTypeRef.set({});
      }

      console.log('Saving validated ticket');
      await db.ref(`/ingressos/${selectedEvent}/validados/${ticketType}/${ticketCode}`).set({
        ...ticket,
        isvalidaded: true
      });

      console.log('Updating UI state');
      setTicketInfo(prev => ({ ...prev, isValidated: true }));
      setValidationSuccess(true);
    } catch (error) {
      console.error('Error in final validation:', error);
      setValidationMessage('Erro ao validar o ingresso. Tente novamente.');
    } finally {
      setIsValidating(false);
    }
  };

  const startQrScanner = () => {
    console.log('Starting QR scanner');
    console.log('Selected event:', selectedEvent);

    if (!selectedEvent) {
      console.log('Cannot start scanner: No event selected');
      setValidationMessage('Por favor, selecione um evento antes de escanear o QR code.');
      return;
    }

    setShowQrReader(true);
    const scanner = new Html5Qrcode("qr-reader");
    console.log('Scanner instance created');
    setQrScanner(scanner);

    scanner.start(
      { facingMode: "environment" },
      {
        fps: 10,
        qrbox: { width: 250, height: 250 }
      },
      async (decodedText) => {
        console.log('QR code scanned:', decodedText);
        try {
          // First stop the scanner and hide the UI
          if (scanner) {
            await scanner.stop();
            setShowQrReader(false);
            setQrScanner(null);
          }
          
          // Then set the validation message and proceed with code processing
          setValidationMessage('QR Code escaneado com sucesso! Aguarde a validação...');
          setScannedCode(decodedText);
        } catch (error) {
          console.error('Error processing QR code:', error);
          setValidationMessage('Erro ao processar o QR code. Por favor, tente novamente.');
        }
      },
      (error) => {
        console.error('QR scanner error:', error);
      }
    ).catch(err => {
      console.error("Error starting scanner:", err);
      setValidationMessage('Erro ao iniciar o scanner. Por favor, tente novamente.');
    });
  };

  const stopQrScanner = async () => {
    console.log('Attempting to stop QR scanner');
    if (qrScanner) {
      try {
        await qrScanner.stop();
        console.log('Scanner stopped successfully');
        setShowQrReader(false);
        setQrScanner(null);
      } catch (err) {
        console.error("Error stopping scanner:", err);
        setValidationMessage('Erro ao parar o scanner. Por favor, recarregue a página.');
        throw err;
      }
    } else {
      console.log('No scanner instance to stop');
    }
  };

  return (
    <div className="min-h-screen gradient-background text-white">
      <header className="bg-black/50 backdrop-blur-sm p-6 shadow-lg animate-slide-down">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <span className="text-sm bg-white/10 px-3 py-1 rounded-full">Piauí Tickets</span>
          <span className="text-sm bg-white/10 px-3 py-1 rounded-full">v1.3.2</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6 sm:space-y-8">
        {selectedEvent && (
          <div className="space-y-4 animate-fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="glass-effect rounded-xl p-6 shadow-xl hover-glow">
                <div className="flex items-center gap-3 mb-4">
                  <Archive className="text-blue-400" size={24} />
                  <h3 className="text-lg font-semibold">Ingressos Armazenados</h3>
                </div>
                <p className="text-3xl font-bold text-blue-400">{storedTickets}</p>
              </div>
              
              <div className="glass-effect rounded-xl p-6 shadow-xl hover-glow">
                <div className="flex items-center gap-3 mb-4">
                  <CheckSquare className="text-green-400" size={24} />
                  <h3 className="text-lg font-semibold">Total de Ingressos Validados</h3>
                </div>
                <p className="text-3xl font-bold text-green-400">{validatedTickets}</p>
              </div>
            </div>

            {validatedTypesCounts.length > 0 && (
              <div className="glass-effect rounded-xl p-6 shadow-xl hover-glow">
                <div className="flex items-center gap-3 mb-4">
                  <Tag className="text-purple-400" size={24} />
                  <h3 className="text-lg font-semibold">Validações por Tipo</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {validatedTypesCounts.map((type) => (
                    <div key={type.type} className="bg-white/5 p-4 rounded-lg border border-white/10">
                      <p className="text-gray-400 text-sm">Lote {type.type}</p>
                      <p className="text-xl font-bold text-purple-400">{type.count} validados</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="glass-effect rounded-xl p-4 sm:p-8 shadow-xl animate-fade-in hover-glow">
          <div className="flex items-center gap-3 mb-6 bg-yellow-500/10 p-4 rounded-lg">
            <AlertCircle className="text-yellow-400 animate-pulse-glow flex-shrink-0" />
            <p className="font-medium text-sm sm:text-base">Antes de usar essa ferramenta, por favor, leia as informações no final da página.</p>
          </div>

          <div className="space-y-4 sm:space-y-6">
            <div className="relative">
              <label className="block text-sm font-medium mb-2">Selecione um evento:</label>
              <div className="relative">
                <select 
                  className="w-full bg-white/5 border border-white/20 rounded-lg p-3 sm:p-4 pr-10 focus:ring-2 focus:ring-blue-500 transition appearance-none hover-glow"
                  value={selectedEvent}
                  onChange={(e) => {
                    console.log('Event selected:', e.target.value);
                    setSelectedEvent(e.target.value);
                  }}
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
                  className="w-full bg-white/5 border border-white/20 rounded-lg p-3 sm:p-4 pl-12 focus:ring-2 focus:ring-blue-500 transition hover-glow"
                  placeholder="Digite o código do ingresso"
                  value={ticketCode}
                  onChange={(e) => {
                    console.log('Ticket code changed:', e.target.value);
                    setTicketCode(e.target.value);
                  }}
                />
                <Ticket className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              </div>
            </div>

            <div className="flex gap-4">
              <button
                className="flex-1 bg-blue-600 hover:bg-blue-700 rounded-lg p-3 sm:p-4 font-medium flex items-center justify-center gap-2 transition hover-glow disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                onClick={() => validateTicket()}
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
                className="flex-1 bg-purple-600 hover:bg-purple-700 rounded-lg p-3 sm:p-4 font-medium flex items-center justify-center gap-2 transition hover-glow text-sm sm:text-base"
                onClick={startQrScanner}
              >
                <QrCode size={20} />
                Escanear QR Code
              </button>
            </div>

            {validationMessage && (
              <div className={`border rounded-lg p-4 animate-shake ${
                validationMessage.includes('sucesso') 
                  ? 'bg-green-500/20 border-green-500/50 text-green-300'
                  : 'bg-red-500/20 border-red-500/50 text-red-300'
              }`}>
                <p className="text-sm sm:text-base">{validationMessage}</p>
              </div>
            )}

            {showQrReader && (
              <div className="relative">
                <div id="qr-reader" className="mt-4 bg-black rounded-lg overflow-hidden animate-scale max-w-sm mx-auto" />
                <button
                  onClick={stopQrScanner}
                  className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 rounded-full p-2 transition hover-glow"
                >
                  <XCircle size={24} />
                </button>
              </div>
            )}
          </div>
        </div>

        <section className="glass-effect rounded-xl p-4 sm:p-8 shadow-xl animate-slide-up hover-glow">
          <h2 className="text-lg sm:text-xl font-bold mb-4">Informações Importantes</h2>
          <div className="space-y-4 text-gray-300 text-sm sm:text-base">
            <p className="bg-white/5 p-4 rounded-lg"><strong>Essa é uma área restrita e desenvolvida apenas para os organizadores e produtores de eventos.</strong></p>
            <p className="bg-white/5 p-4 rounded-lg"><strong>Não nos responsabilizamos pelo uso indevido e incorreto da ferramenta.</strong></p>
            <p className="bg-white/5 p-4 rounded-lg"><strong>Selecione e se atente ao evento selecionado para a validação do Ingressos. Cada Evento tem o armazenamento próprio dos ingressos vendidos.</strong></p>
          </div>
        </section>

        <section className="glass-effect rounded-xl p-4 sm:p-8 shadow-xl animate-slide-up hover-glow bg-green-600/10">
          <h2 className="text-lg sm:text-xl font-bold mb-4 flex items-center gap-2">
            <AlertCircle className="text-green-400" />
            Aconteceu algum erro? Precisa de ajuda?
          </h2>
          <p className="mb-6 text-gray-300 text-sm sm:text-base">Entre em contato direto comigo, respondo rápido.</p>
          <a
            href="https://wa.me/5589994582600?text=Equipe%20de%20validação%20de%20Ingressos%20aqui,%20preciso%20de%20suporte%20urgente."
            className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 rounded-lg px-6 sm:px-8 py-3 sm:py-4 font-medium transition hover-glow text-sm sm:text-base"
            target="_blank"
            rel="noopener noreferrer"
          >
            <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" alt="WhatsApp" className="w-5 h-5 sm:w-6 sm:h-6" />
            Falar no WhatsApp
          </a>
        </section>
      </main>

      {isModalOpen && ticketInfo && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-gradient-to-b from-gray-900 to-gray-800 rounded-xl p-4 sm:p-8 max-w-md w-full animate-scale text-white">
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-xl sm:text-2xl font-bold">Informações do Ingresso</h3>
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
                  <p className="text-base sm:text-lg font-medium">{ticketInfo.eventName}</p>
                </div>
                <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                  <p className="text-gray-400 text-sm">Nome do Comprador</p>
                  <p className="text-base sm:text-lg font-medium">{ticketInfo.fullName}</p>
                </div>
                <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                  <p className="text-gray-400 text-sm">CPF do Comprador</p>
                  <p className="text-base sm:text-lg font-medium">{ticketInfo.cpf}</p>
                </div>
                <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                  <p className="text-gray-400 text-sm">Tipo</p>
                  <p className="text-base sm:text-lg font-medium">{ticketInfo.type || 'Não especificado'}</p>
                </div>
                <div className={`p-4 rounded-lg font-bold text-center text-sm sm:text-base ${
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
                  className="w-full bg-green-500 hover:bg-green-600 text-white rounded-lg p-3 sm:p-4 font-medium transition hover-glow flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
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
