/**
 * Script de inicialização: criar coleção posvenda_mensagens
 * Execute UMA VEZ no console do Firebase Console ou via Firebase Functions
 * Depois pode deletar este arquivo
 */

import { db, setDoc, doc } from "./firebase.js";

async function inicializarMensagensPosvenda() {
    const mensagens = {
        5: "Olá {{nome}}, como está o funcionamento do {{modelo}}? Precisa de ajuda?",
        15: "Olá {{nome}}, estamos com uma oferta especial para você. Gostaria de saber?",
        30: "Olá {{nome}}, sua garantia está perto do fim. Agende uma revisão."
    };

    try {
        for (const [prazo, mensagem] of Object.entries(mensagens)) {
            await setDoc(doc(db, "posvenda_mensagens", prazo), {
                mensagem,
                createdAt: new Date(),
                updatedAt: new Date()
            });
            console.log(`✅ Mensagem para ${prazo} dias criada`);
        }
        console.log("✅ Inicialização concluída! Mensagens carregadas no Firestore.");
    } catch (error) {
        console.error("❌ Erro ao inicializar mensagens:", error);
    }
}

// Execute no console do browser (abra DevTools, vá para Console):
// import('./scripts/init-posvenda-mensagens.js').then(m => m.inicializarMensagensPosvenda());
export { inicializarMensagensPosvenda };
