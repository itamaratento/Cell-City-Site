// ============================================
// CENTRAL DE INFORMAÇÕES — Painel de Visualização (Split View)
// Depende de informacoes.js (deve carregar depois)
// ============================================

let _viewerIdAtivo = null;

// ===== EXPOR FUNÇÕES GLOBAIS (chamadas pelo HTML) =====
window.abrirViewer       = abrirViewer;
window.fecharViewer      = fecharViewer;
window.editarDoViewer    = editarDoViewer;
window.copiarDoViewer    = copiarDoViewer;
window.imprimirViewer    = imprimirViewer;
window.ivCopiarLinha     = ivCopiarLinha;
window.ivMostrarSenha    = ivMostrarSenha;
window.ivAbrirUrl        = ivAbrirUrl;
window.ivCopiarUsuario   = ivCopiarUsuario;
window.ivCopiarSenha     = ivCopiarSenha;

// ===== ABRIR VIEWER =====
function abrirViewer(id) {
    // Busca o registro no array global exposto por informacoes.js
    const info = (window._informacoes || []).find(x => x.id === id);
    if (!info) return;

    _viewerIdAtivo = id;
    window._viewerIdAtivo = id;

    // Remove seleção anterior e marca o novo item
    document.querySelectorAll('.selecionado').forEach(el => el.classList.remove('selecionado'));
    document.querySelectorAll(`[data-id="${id}"]`).forEach(el => {
        el.closest('.info-lista-item, .info-card')?.classList.add('selecionado');
    });

    // Preenche o header
    document.getElementById('iv-icone').textContent       = _getIcone(info.tipo);
    document.getElementById('iv-titulo').textContent      = info.titulo || '(sem título)';
    document.getElementById('iv-categoria').textContent   = info.categoria || '';
    document.getElementById('iv-tipo-badge').textContent  = _getTipoLabel(info.tipo);

    // Corpo
    document.getElementById('iv-corpo').innerHTML = _renderCorpo(info);

    // Rodapé com datas
    document.getElementById('iv-rodape').innerHTML = _renderRodape(info);

    // Exibe o viewer
    document.getElementById('info-viewer-placeholder').style.display = 'none';
    document.getElementById('info-viewer').style.display = 'flex';

    // Mobile: abre como overlay
    const painelDir = document.getElementById('info-split-right');
    if (window.innerWidth <= 767) {
        painelDir.classList.add('mobile-aberto');
    }

    // Scroll suave ao topo do painel
    painelDir.scrollTo({ top: 0, behavior: 'smooth' });
}

// ===== FECHAR VIEWER =====
function fecharViewer() {
    _viewerIdAtivo = null;
    window._viewerIdAtivo = null;
    document.querySelectorAll('.selecionado').forEach(el => el.classList.remove('selecionado'));
    document.getElementById('info-viewer').style.display = 'none';
    document.getElementById('info-viewer-placeholder').style.display = 'flex';

    const painelDir = document.getElementById('info-split-right');
    painelDir.classList.remove('mobile-aberto');
}

// ===== EDITAR DO VIEWER =====
function editarDoViewer() {
    if (!_viewerIdAtivo) return;
    if (typeof window.editarInformacao === 'function') {
        window.editarInformacao(_viewerIdAtivo);
    }
}

// ===== COPIAR DO VIEWER =====
async function copiarDoViewer() {
    if (!_viewerIdAtivo) return;
    const info = (window._informacoes || []).find(x => x.id === _viewerIdAtivo);
    if (!info) return;

    let texto = '';

    if (info.tipo === 'anotacao') {
        texto = info.conteudo || '';
    } else if (info.tipo === 'comando') {
        const linhas = _getLinhas(info);
        texto = linhas.filter(l => l.cmd).map(l => l.cmd).join('\n');
    } else if (info.tipo === 'site') {
        const urls = Array.isArray(info.urls) && info.urls.length ? info.urls : (info.url ? [info.url] : []);
        texto = urls.join('\n');
    } else if (info.tipo === 'senha') {
        try {
            texto = _descriptografar(info.senhaOculta || '');
        } catch {
            _toast('❌ Erro ao descriptografar senha');
            return;
        }
    } else if (info.tipo === 'documento') {
        _toast('📥 Use o botão Download para arquivos');
        return;
    }

    if (!texto) { _toast('⚠️ Nenhum conteúdo para copiar'); return; }

    await navigator.clipboard.writeText(texto).catch(() => {
        document.execCommand('copy', false, texto);
    });
    _toast('✅ Conteúdo copiado!');
}

// ===== IMPRIMIR =====
function imprimirViewer() {
    window.print();
}

// ===== AÇÕES INLINE NO CORPO =====

async function ivCopiarLinha(cmd) {
    if (!cmd) return;
    await navigator.clipboard.writeText(cmd).catch(() => { document.execCommand('copy', false, cmd); });
    _toast('✅ Copiado!');
}

function ivMostrarSenha(id) {
    if (typeof window.visualizarSenha === 'function') {
        window.visualizarSenha(id);
    }
}

async function ivAbrirUrl(url) {
    if (url) window.open(url, '_blank');
}

async function ivCopiarUsuario(id) {
    if (typeof window.copiarUsuario === 'function') {
        window.copiarUsuario(id);
    }
}

async function ivCopiarSenha(id) {
    if (typeof window.copiarSenha === 'function') {
        window.copiarSenha(id, 'senha');
    }
}

// ===== RENDER CORPO (por tipo) =====

function _renderCorpo(info) {
    const id = info.id;

    if (info.tipo === 'anotacao') {
        const texto = _esc(info.conteudo || '(vazio)');
        return `<div class="iv-anotacao-texto">${texto}</div>`;
    }

    if (info.tipo === 'comando') {
        const linhas = _getLinhas(info);
        const tags = info.tags ? info.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
        const sistema = info.sistema || '';
        const obs = info.observacoes || '';

        let html = '';

        if (tags.length || sistema) {
            html += `<div style="display:flex; gap:16px; flex-wrap:wrap; margin-bottom:16px; align-items:center;">`;
            if (sistema) html += `<div class="iv-campo-label" style="margin:0;">🖥️ ${_esc(sistema)}</div>`;
            if (tags.length) {
                html += `<div class="iv-tags-wrap">`;
                tags.forEach(t => { html += `<span class="iv-tag">${_esc(t)}</span>`; });
                html += `</div>`;
            }
            html += `</div>`;
        }

        html += `<div class="iv-cmd-lista">`;
        let numCmd = 0;
        linhas.forEach(item => {
            if (item.grupo !== undefined) {
                html += `<div class="iv-cmd-grupo">── ${_esc(item.grupo || 'Grupo')} ──</div>`;
            } else if (item.cmd) {
                numCmd++;
                const cmdEsc = _esc(item.cmd);
                html += `
                    <div class="iv-cmd-linha">
                        <span class="iv-cmd-num">${numCmd}</span>
                        <code class="iv-cmd-code">${cmdEsc}</code>
                        <button class="iv-cmd-copy" onclick="ivCopiarLinha(${_attrJs(item.cmd)})" title="Copiar">📋</button>
                    </div>`;
            }
        });
        html += `</div>`;

        if (obs) {
            html += `<div class="iv-obs">
                <div class="iv-obs-label">Observações</div>
                <div class="iv-obs-texto">${_esc(obs)}</div>
            </div>`;
        }

        return html;
    }

    if (info.tipo === 'site') {
        const urls = Array.isArray(info.urls) && info.urls.length ? info.urls : (info.url ? [info.url] : []);
        const usuario = info.usuario || '';
        const obs = info.observacoes || '';
        let html = '';

        html += `<div class="iv-campo">
            <div class="iv-campo-label">URL${urls.length > 1 ? 'S' : ''}</div>`;
        urls.forEach(u => {
            html += `<div class="iv-campo-valor" style="margin-bottom:6px;">
                <a href="${_esc(u)}" onclick="event.preventDefault();ivAbrirUrl(${_attrJs(u)})">
                    🌐 ${_esc(u)}
                </a>
            </div>`;
        });
        html += `</div>`;

        if (usuario) {
            html += `<div class="iv-campo">
                <div class="iv-campo-label">Usuário</div>
                <div class="iv-campo-valor">${_esc(usuario)}</div>
            </div>`;
        }

        if (info.senhaOculta) {
            html += `<div class="iv-campo">
                <div class="iv-campo-label">Senha</div>
                <div class="iv-senha-protegida">
                    <span class="iv-senha-dots">••••••••••</span>
                    <button class="iv-senha-btn" onclick="ivMostrarSenha('${id}')">👁 Visualizar</button>
                    <button class="iv-senha-btn" onclick="ivCopiarSenha('${id}')">📋 Copiar</button>
                </div>
            </div>`;
        }

        if (obs) {
            html += `<div class="iv-obs">
                <div class="iv-obs-label">Observações</div>
                <div class="iv-obs-texto">${_esc(obs)}</div>
            </div>`;
        }

        html += `<div style="margin-top:20px; display:flex; gap:8px; flex-wrap:wrap;">`;
        urls.forEach((u, i) => {
            html += `<button class="info-viewer-btn copy" onclick="ivAbrirUrl(${_attrJs(u)})">🌐 Abrir${urls.length > 1 ? ' URL '+(i+1) : ''}</button>`;
        });
        if (usuario) html += `<button class="info-viewer-btn" onclick="ivCopiarUsuario('${id}')">👤 Copiar Usuário</button>`;
        if (info.senhaOculta) html += `<button class="info-viewer-btn" onclick="ivCopiarSenha('${id}')">🔑 Copiar Senha</button>`;
        html += `</div>`;

        return html;
    }

    if (info.tipo === 'senha') {
        const siteServico = info.site_servico || '';
        const usuario = info.usuario || '';
        const obs = info.observacoes || '';
        let html = '';

        if (siteServico) {
            html += `<div class="iv-campo">
                <div class="iv-campo-label">Site / Serviço</div>
                <div class="iv-campo-valor">${_esc(siteServico)}</div>
            </div>`;
        }

        html += `<div class="iv-campo">
            <div class="iv-campo-label">Usuário</div>
            <div class="iv-campo-valor">${_esc(usuario)}</div>
        </div>`;

        html += `<div class="iv-campo">
            <div class="iv-campo-label">Senha</div>
            <div class="iv-senha-protegida">
                <span class="iv-senha-dots">••••••••••</span>
                <button class="iv-senha-btn" onclick="ivMostrarSenha('${id}')">👁 Visualizar</button>
                <button class="iv-senha-btn" onclick="ivCopiarSenha('${id}')">📋 Copiar</button>
            </div>
        </div>`;

        if (obs) {
            html += `<div class="iv-obs">
                <div class="iv-obs-label">Observações</div>
                <div class="iv-obs-texto">${_esc(obs)}</div>
            </div>`;
        }

        html += `<div style="margin-top:20px; display:flex; gap:8px; flex-wrap:wrap;">
            <button class="info-viewer-btn" onclick="ivCopiarUsuario('${id}')">👤 Copiar Usuário</button>
            <button class="info-viewer-btn copy" onclick="ivCopiarSenha('${id}')">🔑 Copiar Senha</button>
            <button class="info-viewer-btn" onclick="ivMostrarSenha('${id}')">👁 Visualizar Senha</button>
        </div>`;

        return html;
    }

    if (info.tipo === 'documento') {
        const descricao = info.descricao || '';
        let html = `<div class="iv-campo">
            <div class="iv-campo-label">Documento</div>
            <div class="iv-campo-valor">📄 ${_esc(info.titulo)}${info.extensao ? '.'+_esc(info.extensao) : ''}</div>
        </div>`;

        if (descricao) {
            html += `<div class="iv-campo">
                <div class="iv-campo-label">Descrição</div>
                <div class="iv-campo-valor">${_esc(descricao)}</div>
            </div>`;
        }

        html += `<div style="margin-top:20px;">
            <button class="info-viewer-btn copy" onclick="window.downloadDocumento && window.downloadDocumento('${id}')">📥 Download</button>
        </div>`;

        return html;
    }

    return `<p style="color:var(--text-tertiary)">Tipo desconhecido.</p>`;
}

// ===== RENDER RODAPÉ (datas) =====

function _renderRodape(info) {
    const criado    = _formatarData(info.criadoEmISO    || info.criadoEm);
    const atualizado = _formatarData(info.atualizadoEmISO || info.atualizadoEm);

    return `
        <div class="iv-data-item">
            <span class="iv-data-label">Criado em</span>
            <span class="iv-data-valor">${criado}</span>
        </div>
        ${atualizado !== criado ? `
        <div class="iv-data-item">
            <span class="iv-data-label">Alterado em</span>
            <span class="iv-data-valor">${atualizado}</span>
        </div>` : ''}
    `;
}

// ===== UTILITÁRIOS =====

function _getIcone(tipo) {
    return { comando: '📝', site: '🌐', senha: '🔐', anotacao: '📌', documento: '📄' }[tipo] || '📌';
}

function _getTipoLabel(tipo) {
    return { comando: 'Comando', site: 'Site', senha: 'Senha', anotacao: 'Anotação', documento: 'Documento' }[tipo] || tipo;
}

function _getLinhas(info) {
    if (Array.isArray(info.linhas) && info.linhas.length) return info.linhas;
    if (info.conteudo) return [{ cmd: info.conteudo }];
    return [];
}

function _esc(text) {
    return String(text ?? '').replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' })[m]);
}

function _attrJs(value) {
    return _esc(JSON.stringify(String(value ?? '')));
}

function _descriptografar(ciphertext) {
    if (typeof CryptoJS === 'undefined') throw new Error('CryptoJS não carregado');
    const bytes = CryptoJS.AES.decrypt(ciphertext, 'cellcity-2026');
    return bytes.toString(CryptoJS.enc.Utf8);
}

function _formatarData(valor) {
    if (!valor) return '—';
    // Pode ser Firestore Timestamp ou ISO string
    let d;
    try {
        if (valor && typeof valor === 'object' && valor.seconds) {
            d = new Date(valor.seconds * 1000);
        } else {
            d = new Date(valor);
        }
        if (isNaN(d.getTime())) return '—';
        return d.toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
    } catch {
        return '—';
    }
}

function _toast(msg) {
    if (typeof window.toast === 'function') {
        window.toast(msg);
        return;
    }
    // Fallback: re-usa o elemento de toast existente
    const el = document.getElementById('info-toast');
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
    el.className = 'info-toast';
    if (msg.includes('✅')) el.classList.add('success');
    else if (msg.includes('❌')) el.classList.add('error');
    else if (msg.includes('⚠️')) el.classList.add('warning');
    setTimeout(() => { el.style.display = 'none'; }, 2500);
}
