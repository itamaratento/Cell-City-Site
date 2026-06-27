/* ================================================================
   BOOTSTRAP MASTER — Configuração inicial do ambiente SaaS
   Cell City Gestão Empresarial

   USAR UMA ÚNICA VEZ para criar:
     - Empresa master no Firestore (empresas/cellcity-master)
     - Documento do usuário master (usuarios/{uid})

   Como usar:
     1. Faça login com Google no CRM (página de config)
     2. Abra o Console do navegador (F12)
     3. Cole o conteúdo deste arquivo e pressione Enter
     4. Confirme as mensagens e aguarde a conclusão

   ATENÇÃO: Este script não deve ser importado em produção.
            Usar apenas uma vez no Console do navegador.
   ================================================================ */

(async function bootstrapMaster() {
  console.log('🚀 Cell City — Bootstrap Master SaaS');
  console.log('══════════════════════════════════════');

  // Verifica se firebase está carregado
  if (typeof firebase === 'undefined' && !window._ccBootstrapDb) {
    console.error('❌ Firebase não encontrado. Execute este script na página do CRM.');
    return;
  }

  // Usa o db/auth expostos pelo firebase.js (window.dbFirestore)
  const db   = window.dbFirestore || window._ccBootstrapDb;
  // firebase.js expõe window.ccAuth
  let authInst = window.ccAuth || window._ccBootstrapAuth;
  if (!authInst) {
    try {
      const { getAuth } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');
      authInst = getAuth();
    } catch {}
  }

  if (!db) {
    console.warn('⚠️  Firestore (db) não disponível.');
    console.warn('    Abra este script em uma aba que já carregou o CRM (ex: /CRM/pages/config).');
    return;
  }

  const auth2 = authInst;

  const user = auth2?.currentUser;
  if (!user) {
    console.error('❌ Nenhum usuário logado. Faça login com Google primeiro.');
    return;
  }

  if (user.isAnonymous) {
    console.error('❌ Usuário anônimo (PIN). Faça login com Google para ser master.');
    return;
  }

  console.log(`👤 Usuário logado: ${user.email} (UID: ${user.uid})`);

  const confirmar = confirm(
    `Bootstrap Master SaaS\n\n` +
    `Este script vai criar:\n` +
    `• Empresa: empresas/cellcity-master\n` +
    `• Usuário master: usuarios/${user.uid}\n\n` +
    `Usuário logado: ${user.email}\n\n` +
    `Continuar?`
  );

  if (!confirmar) { console.log('Cancelado.'); return; }

  const { doc, setDoc, serverTimestamp } = await import(
    'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js'
  );

  try {
    // ── 1. Empresa master ──────────────────────────────────────
    console.log('📝 Criando empresas/cellcity-master...');
    await setDoc(doc(db, 'empresas', 'cellcity-master'), {
      nome_fantasia:  'Cell City',
      razao_social:   'Cell City Informática e Assistência Técnica',
      is_master:      true,
      status:         'ativo',
      plano:          'enterprise',
      modulos_ativos: null,     // enterprise = sem filtro
      feature_flags:  {
        whatsapp: true, api_externa: false, ia: false,
        dashboard_avancado: true, relatorios_premium: true,
        portal_cliente: false, aplicativo: false,
        nfe: false, white_label: true, importacao_dados: true,
        modo_suporte: true, backup_automatico: false
      },
      white_label:    { nome: '', cor_primaria: '#00c853', cor_secundaria: '' },
      valor_mensal:   0,
      data_vencimento: null,    // master nunca vence
      data_cadastro:  serverTimestamp(),
      atualizado_em:  serverTimestamp()
    }, { merge: true });
    console.log('✅ Empresa master criada: empresas/cellcity-master');

    // ── 2. Usuário master ──────────────────────────────────────
    console.log(`📝 Criando usuarios/${user.uid}...`);
    await setDoc(doc(db, 'usuarios', user.uid), {
      nome:           user.displayName || 'Itamar',
      email:          user.email       || '',
      foto_url:       user.photoURL    || '',
      empresa_id:     'cellcity-master',
      perfil:         'master_admin',
      permissoes_modulos: {},   // master vê tudo, sem override
      ativo:          true,
      data_cadastro:  serverTimestamp(),
      ultimo_acesso:  serverTimestamp()
    }, { merge: true });
    console.log(`✅ Usuário master criado: usuarios/${user.uid}`);

    // ── 3. Log de auditoria ────────────────────────────────────
    const { addDoc, collection } = await import(
      'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js'
    );
    await addDoc(collection(db, 'auditoria_saas'), {
      empresa_id:   'cellcity-master',
      usuario_id:   user.uid,
      usuario_nome: user.displayName || 'Itamar',
      perfil:       'master_admin',
      acao:         'bootstrap_master',
      detalhes:     { email: user.email, timestamp: new Date().toISOString() },
      em_suporte:   false,
      timestamp:    serverTimestamp()
    });

    console.log('');
    console.log('══════════════════════════════════════');
    console.log('✅ Bootstrap concluído com sucesso!');
    console.log('');
    console.log('Próximos passos:');
    console.log('1. Recarregue a página (F5)');
    console.log('2. Faça login com Google novamente');
    console.log('3. A Central SaaS aparecerá na sidebar');
    console.log('══════════════════════════════════════');

    alert(
      '✅ Bootstrap Master concluído!\n\n' +
      'Recarregue a página e faça login com Google.\n' +
      'A Central SaaS estará disponível na sidebar.'
    );

  } catch (err) {
    console.error('❌ Erro no bootstrap:', err);
    console.error('Tente as instruções manuais no Firebase Console.');
  }
})();
