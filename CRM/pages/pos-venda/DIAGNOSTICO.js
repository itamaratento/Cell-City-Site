/**
 * SCRIPT DE DIAGNÓSTICO — Carregamento de Mensagens
 *
 * Execute no Console (F12) quando estiver na página de Pós-venda
 *
 * Cole no Console:
 * fetch('./DIAGNOSTICO.js').then(r=>r.text()).then(eval)
 */

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║  🔍 DIAGNÓSTICO — CARREGAMENTO DE MENSAGENS PÓS-VENDA         ║');
console.log('╚════════════════════════════════════════════════════════════════╝');
console.log('');

// 1. Verificar window.mensagensPosvenda
console.log('📊 1. VERIFICANDO window.mensagensPosvenda...');
if (window.mensagensPosvenda) {
    console.log('✅ window.mensagensPosvenda ENCONTRADO');
    console.log('');

    const msgs = window.mensagensPosvenda;

    console.log('   5 dias:');
    if (msgs[5] && msgs[5].length > 0) {
        console.log(`   ✅ "${msgs[5].substring(0, 60)}..."`);
    } else {
        console.log('   ❌ VAZIO ou undefined');
    }

    console.log('');
    console.log('   15 dias:');
    if (msgs[15] && msgs[15].length > 0) {
        console.log(`   ✅ "${msgs[15].substring(0, 60)}..."`);
    } else {
        console.log('   ❌ VAZIO ou undefined');
    }

    console.log('');
    console.log('   30 dias:');
    if (msgs[30] && msgs[30].length > 0) {
        console.log(`   ✅ "${msgs[30].substring(0, 60)}..."`);
    } else {
        console.log('   ❌ VAZIO ou undefined');
    }
} else {
    console.log('❌ window.mensagensPosvenda NÃO ENCONTRADO');
    console.log('⚠️  Mensagens não foram carregadas');
}

console.log('');
console.log('─────────────────────────────────────────────────────────────────');
console.log('');

// 2. Verificar cards
console.log('📊 2. VERIFICANDO CARDS...');
const cards = document.querySelectorAll('.pv-card');
console.log(`✅ ${cards.length} cards encontrados`);

if (cards.length > 0) {
    const card = cards[0];
    console.log('');
    console.log('   Primeiro card:');
    console.log(`   osId: ${card.dataset.osid}`);
    console.log(`   prazo: ${card.dataset.prazo}`);

    const btnMsg = card.querySelector('.pv-copy-btn');
    const btnPhone = card.querySelector('.pv-copy-phone-btn');
    const btnAll = card.querySelector('.pv-copy-all-btn');

    console.log('');
    console.log('   Botões:');
    console.log(`   ${btnMsg ? '✅' : '❌'} Botão "Copiar Mensagem"`);
    console.log(`   ${btnPhone ? '✅' : '❌'} Botão "Copiar Telefone"`);
    console.log(`   ${btnAll ? '✅' : '❌'} Botão "Copiar Tudo"`);
}

console.log('');
console.log('─────────────────────────────────────────────────────────────────');
console.log('');

// 3. Verificar funções
console.log('📊 3. VERIFICANDO FUNÇÕES...');
console.log(`${typeof copiarMensagem === 'function' ? '✅' : '❌'} copiarMensagem()`);
console.log(`${typeof copiarTelefone === 'function' ? '✅' : '❌'} copiarTelefone()`);
console.log(`${typeof copiarTudo === 'function' ? '✅' : '❌'} copiarTudo()`);
console.log(`${typeof atalhos === 'function' ? '✅' : '❌'} atalhos()`);

console.log('');
console.log('─────────────────────────────────────────────────────────────────');
console.log('');

// 4. Verificar pendentes
console.log('📊 4. VERIFICANDO DADOS DE ATENDIMENTOS...');
if (window.pendentes) {
    console.log('✅ window.pendentes ENCONTRADO');
    console.log(`   5 dias: ${window.pendentes[5] ? window.pendentes[5].length : 0} atendimentos`);
    console.log(`   15 dias: ${window.pendentes[15] ? window.pendentes[15].length : 0} atendimentos`);
    console.log(`   30 dias: ${window.pendentes[30] ? window.pendentes[30].length : 0} atendimentos`);
} else {
    console.log('❌ window.pendentes NÃO ENCONTRADO');
}

console.log('');
console.log('═════════════════════════════════════════════════════════════════');
console.log('');

// 5. Diagnóstico Final
console.log('🎯 DIAGNÓSTICO FINAL:');
const hasMensagens = window.mensagensPosvenda &&
                     window.mensagensPosvenda[5] &&
                     window.mensagensPosvenda[15] &&
                     window.mensagensPosvenda[30];

const hasCards = cards.length > 0;
const hasFunctions = typeof copiarMensagem === 'function' &&
                    typeof copiarTudo === 'function';

if (hasMensagens && hasCards && hasFunctions) {
    console.log('✅ TUDO OK! Sistema está funcionando corretamente');
    console.log('');
    console.log('   Próximos passos:');
    console.log('   1. Clique em "💬 Mensagem" para testar');
    console.log('   2. Ou pressione N para copiar tudo');
    console.log('   3. Ctrl+V para colar');
} else {
    console.log('❌ PROBLEMA IDENTIFICADO:');
    if (!hasMensagens) {
        console.log('   ❌ Mensagens não carregadas');
        console.log('      Solução: Execute init-posvenda-mensagens.js');
    }
    if (!hasCards) {
        console.log('   ❌ Nenhum card encontrado');
        console.log('      Verifique se há atendimentos pendentes');
    }
    if (!hasFunctions) {
        console.log('   ❌ Funções não encontradas');
        console.log('      Recarregue a página (F5)');
    }
}

console.log('');
console.log('═════════════════════════════════════════════════════════════════');
