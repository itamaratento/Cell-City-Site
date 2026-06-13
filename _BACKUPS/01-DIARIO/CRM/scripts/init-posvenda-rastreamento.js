/**
 * Script de inicialização: criar coleção posvenda_rastreamento
 * Estrutura para rastreamento de envios (futuro)
 *
 * Execute UMA VEZ no console do Firebase Console ou via Firebase Functions
 * Depois pode deletar este arquivo
 *
 * Estrutura de documento:
 * {
 *   osId: "OS-0001",
 *   clientName: "João Silva",
 *   phone: "(62) 98111-1111",
 *   model: "iPhone 12",
 *   prazo: 5,
 *   status: "nao_enviado",  // "nao_enviado" | "enviado" | "respondido"
 *   dataEnvio: null,
 *   horaEnvio: null,
 *   usuarioEnvio: "user_id",
 *   dataResposta: null,
 *   horaResposta: null,
 *   createdAt: timestamp,
 *   updatedAt: timestamp
 * }
 */

import { db, setDoc, doc, serverTimestamp } from "./firebase.js";

async function inicializarRastreamento() {
    try {
        // Criar documento de exemplo (para testes)
        await setDoc(doc(db, "posvenda_rastreamento", "exemplo_001"), {
            osId: "OS-0001",
            clientName: "Exemplo",
            phone: "(62) 98111-1111",
            model: "iPhone",
            prazo: 5,
            status: "nao_enviado",
            dataEnvio: null,
            horaEnvio: null,
            usuarioEnvio: null,
            dataResposta: null,
            horaResposta: null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        console.log("✅ Estrutura de rastreamento criada (documento exemplo)");
    } catch (error) {
        console.error("❌ Erro ao inicializar rastreamento:", error);
    }
}

export { inicializarRastreamento };

// Execute no console do browser:
// import('./scripts/init-posvenda-rastreamento.js').then(m => m.inicializarRastreamento());
