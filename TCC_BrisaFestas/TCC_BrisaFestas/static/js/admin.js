// static/js/admin.js (versão dinâmica)
// Helpers
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

/* Elements */
const btnNew = $('#btn-new-event');
const modal = $('#modal');
const eventForm = $('#event-form');
const cancelBtn = $('#cancel-btn');
const eventsTableBody = $('#events-table tbody');
const modalTitle = $('#modal-title');
const searchInput = $('#search');

/* State */
let eventsCache = [];      // cache dos eventos carregados
let pollingTimer = null;
let isLoading = false;
let searchDebounceTimer = null;

/* Toast helper */
function showToast(msg, type = 'info', timeout = 3500) {
  const t = document.createElement('div');
  t.className = `app-toast app-toast-${type}`;
  t.textContent = msg;
  Object.assign(t.style, {
    position: 'fixed',
    right: '20px',
    bottom: '20px',
    padding: '10px 14px',
    borderRadius: '8px',
    boxShadow: '0 10px 30px rgba(2,6,23,0.12)',
    background: type === 'error' ? '#ff6464' : (type === 'success' ? '#2ECC71' : '#333'),
    color: '#fff',
    zIndex: 9999,
    opacity: 0,
    transition: 'opacity 200ms'
  });
  document.body.appendChild(t);
  requestAnimationFrame(() => t.style.opacity = 1);
  setTimeout(() => {
    t.style.opacity = 0;
    setTimeout(() => t.remove(), 300);
  }, timeout);
}

/* modal helpers */
const showModal = () => modal.classList.remove('hidden');
const hideModal = () => {
  modal.classList.add('hidden');
  eventForm.reset();
  delete eventForm.dataset.editing;
  // remover campo lucro se existir
  const lucroEl = eventForm.querySelector('.lucro-display');
  if (lucroEl) lucroEl.remove();
};

/* API fetch wrapper */
const apiFetch = (url, options = {}) => {
  options.credentials = options.credentials || 'same-origin';
  options.headers = options.headers || {};
  return fetch(url, options);
};

/* ---- UX: carregar lista e renderizar ---- */
async function loadEvents(showLoader = true) {
  if (isLoading) return;
  isLoading = true;
  eventsTableBody.innerHTML = `<tr><td colspan="7">Carregando...</td></tr>`;
  try {
    // Corrija a URL de listagem para o endpoint correto do Flask: /api/pedidos
    const res = await apiFetch('/api/pedidos'); 
    
    if (!res.ok) {
      const txt = await res.text().catch(()=>`status ${res.status}`);
      eventsTableBody.innerHTML = `<tr><td colspan="7">Erro ao carregar eventos</td></tr>`;
      console.error('/api/pedidos error', txt);
      showToast('Erro ao carregar eventos', 'error');
      return;
    }
    const data = await res.json();
    eventsCache = Array.isArray(data) ? data : [];
    renderTable(eventsCache);
  } catch (err) {
    console.error('Network error loading events', err);
    eventsTableBody.innerHTML = `<tr><td colspan="7">Erro de rede</td></tr>`;
    showToast('Erro de rede ao carregar eventos', 'error');
  } finally {
    isLoading = false;
  }
}

function renderTable(list) {
  if (!list || list.length === 0) {
    eventsTableBody.innerHTML = '<tr><td colspan="7">Nenhum evento</td></tr>';
    return;
  }
  eventsTableBody.innerHTML = list.map(ev => renderRow(ev)).join('');
  attachRowListeners();
}

function renderRow(ev) {
  const id = ev.id_evento ?? ev.id ?? ev.id_event;
  const nome = ev.nome_evento ?? ev.nome ?? '';
  const tipo = ev.tipo_evento ?? '';
  const data = ev.data_evento ?? '';
  const valor = ev.valor_contrato_final ?? ev.valor_final ?? null;
  const custos = ev.custos_adicionais ?? ev.custos ?? null;
  let lucroText = '';
  if (valor !== null && custos !== null && !isNaN(Number(valor)) && !isNaN(Number(custos))) {
    const lucro = Number(valor) - Number(custos);
    lucroText = `<div class="lucro-badge" title="Lucro (valor - custos)">Lucro: R$ ${lucro.toFixed(2)}</div>`;
  }
  const status = ev.status_evento ?? ev.status ?? '';
  const valorDisplay = (valor !== null && valor !== undefined && valor !== '') ? `R$ ${Number(valor).toFixed(2)}` : '';
  return `
    <tr data-id="${id}">
      <td>${id}</td>
      <td>${escapeHtml(nome)}</td>
      <td>${escapeHtml(tipo)}</td>
      <td>${data}</td>
      <td>
        ${valorDisplay}
        ${lucroText}
      </td>
      <td>${escapeHtml(status)}</td>
      <td>
        <button class="btn-edit">Editar</button>
        <button class="btn-delete">Apagar</button>
        <a class="btn-download" href="/admin/gerar-contrato/${id}" target="_blank">Contrato</a>
      </td>
    </tr>
  `;
}

/* escape */
function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/[&<>"'`]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;', '`':'&#96;'}[c]));
}

/* ---- attach listeners nas linhas ---- */
function attachRowListeners() {
  $$('.btn-edit').forEach(btn => btn.removeEventListener('click', onEdit) || btn.addEventListener('click', onEdit));
  $$('.btn-delete').forEach(btn => btn.removeEventListener('click', onDelete) || btn.addEventListener('click', onDelete));
}

/* ---- novo evento (abrir modal) ---- */
if (btnNew) {
  btnNew.addEventListener('click', () => {
    eventForm.reset();
    delete eventForm.dataset.editing;
    modalTitle.textContent = 'Novo Evento';
    // remove lucro display se existir
    const lucroEl = eventForm.querySelector('.lucro-display');
    if (lucroEl) lucroEl.remove();
    showModal();
  });
}

/* cancelar */
if (cancelBtn) cancelBtn.addEventListener('click', hideModal);
window.addEventListener('click', e => { if (e.target === modal) hideModal(); });

/* ---- editar ---- */
function onEdit(e) {
  const tr = e.currentTarget.closest('tr');
  const id = tr.dataset.id;
  modalTitle.textContent = 'Editar Evento';
  showModal();
  // buscar dados
  apiFetch(`/api/events/${id}`, { method: 'GET' })
    .then(async r => {
      if (!r.ok) {
        const txt = await r.text().catch(()=>r.status);
        throw new Error(txt);
      }
      return r.json();
    })
    .then(ev => {
      // preenche form (só set os campos que existem no form)
      if (eventForm.elements['id_evento']) eventForm.elements['id_evento'].value = ev.id_evento ?? ev.id ?? id;
      if (eventForm.elements['nome_evento']) eventForm.elements['nome_evento'].value = ev.nome_evento ?? ev.nome ?? '';
      if (eventForm.elements['tipo_evento']) eventForm.elements['tipo_evento'].value = ev.tipo_evento ?? '';
      if (eventForm.elements['id_cliente']) eventForm.elements['id_cliente'].value = ev.id_cliente ?? '';
      if (eventForm.elements['data_evento']) eventForm.elements['data_evento'].value = ev.data_evento ?? '';
      if (eventForm.elements['hora_inicio']) eventForm.elements['hora_inicio'].value = ev.hora_inicio ?? '';
      if (eventForm.elements['hora_termino']) eventForm.elements['hora_termino'].value = ev.hora_termino ?? '';
      if (eventForm.elements['local_externo_endereco']) eventForm.elements['local_externo_endereco'].value = ev.local_externo_endereco ?? '';
      if (eventForm.elements['valor_orcamento_inicial']) eventForm.elements['valor_orcamento_inicial'].value = ev.valor_orcamento_inicial ?? '';
      if (eventForm.elements['valor_contrato_final']) eventForm.elements['valor_contrato_final'].value = ev.valor_contrato_final ?? '';
      if (eventForm.elements['custos_adicionais']) eventForm.elements['custos_adicionais'].value = ev.custos_adicionais ?? '';
      if (eventForm.elements['status_pagamento']) eventForm.elements['status_pagamento'].value = ev.status_pagamento ?? '';
      if (eventForm.elements['status_evento']) eventForm.elements['status_evento'].value = ev.status_evento ?? '';
      if (eventForm.elements['feedback_cliente']) eventForm.elements['feedback_cliente'].value = ev.feedback_cliente ?? '';

      eventForm.dataset.editing = id;
      // show lucro display
      attachLucroListener();
    })
    .catch(err => {
      console.error('Erro ao buscar evento', err);
      showToast('Erro ao carregar evento', 'error');
    });
}

/* ---- deletar ---- */
function onDelete(e) {
  const tr = e.currentTarget.closest('tr');
  const id = tr.dataset.id;
  if (!confirm('Deseja realmente apagar este evento?')) return;
  apiFetch(`/api/events/${id}`, { method: 'DELETE' })
    .then(r => {
      if (!r.ok) throw new Error(`Status ${r.status}`);
      showToast('Evento apagado', 'success');
      loadEvents();
    })
    .catch(err => {
      console.error('Erro ao apagar', err);
      showToast('Erro ao apagar evento', 'error');
    });
}

// ... (código anterior do admin.js)

/* ---- submit do form (criar / atualizar) ---- */
eventForm.addEventListener('submit', function (ev) {
    ev.preventDefault();
    const form = ev.currentTarget;
    const fd = new FormData(form);

    // ===============================================
    // 💡 TABELA DE MAPEAMENTO: HTML Name -> API Name
    // Estes são os nomes que o seu backend em Flask espera (colunas da tabela 'pedidos'):
    // ===============================================
    const API_MAPPING = {
        'nome_evento': 'nome',                  // nome_evento (HTML) -> nome (DB)
        'tipo_evento': 'tipo_festa',            // tipo_evento (HTML) -> tipo_festa (DB)
        'data_evento': 'data_evento',           // nome igual
        'valor_contrato_final': 'valor_final',  // valor_contrato_final (HTML) -> valor_final (DB)
        'valor_orcamento_inicial': 'valor_orcado', // valor_orcamento_inicial (HTML) -> valor_orcado (DB)
        'feedback_cliente': 'observacoes',      // feedback_cliente (HTML) -> observacoes (DB)
        'status_evento': 'status',              // status_evento (HTML) -> status (DB)
        // Os demais campos (hora_inicio, status_pagamento, custos_adicionais, id_cliente, etc.)
        // não estão mapeados no Flask ou não são colunas da tabela 'pedidos' e serão ignorados
        // pelo backend, o que está correto para a sua API atual.
        // Se você tiver inputs para CPF, telefone, email, adicione-os aqui!
    };

    const payload = {};
    for (const [formKey, v] of fd.entries()) {
        if (v === '' || formKey === 'id_evento') continue; 
        
        // 1. Obter o nome da chave que a API espera
        const apiKey = API_MAPPING[formKey] || formKey; 

        // 2. Tratar valores numéricos para garantir que cheguem como números ou null/vazio
        if (apiKey === 'valor_final' || apiKey === 'valor_orcado') {
            const num = parseFloat(v);
            payload[apiKey] = isNaN(num) ? null : num;
        } else {
            payload[apiKey] = v;
        }
    }

    const editingId = form.dataset.editing;
    
    // CORRIGINDO O ENDPOINT DO BACKEND:
    // O seu backend Flask tem rotas '/api/pedido' (POST) e '/api/pedidos/<id>' (PUT).
    // O seu JS está chamando '/api/events' e '/api/events/<id>', o que resultaria em 404.
    // ESTA É UMA SEGUNDA FALHA GRAVE QUE PRECISA SER CORRIGIDA:
    const url = editingId ? `/api/pedidos/${editingId}` : '/api/pedido'; // Corrigido para '/api/pedidos' e '/api/pedido'
    const method = editingId ? 'PUT' : 'POST';

    // show loader
    const saveBtn = $('#save-btn');
    if (saveBtn) saveBtn.disabled = true;
    
    // O fetch agora usa a URL e o payload corrigidos
    apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(async r => {
        if (!r.ok) {
            const txt = await r.text().catch(()=>`status ${r.status}`);
            // Se o Flask retornar 400 'Nada para atualizar', o erro agora será capturado aqui.
            throw new Error(`Erro API: ${r.status} ${txt}`);
        }
        showToast('Salvo com sucesso', 'success');
        hideModal();
        return loadEvents(); // Recarrega os eventos
    })
    .catch(err => {
        console.error('Erro salvar evento', err);
        showToast('Erro ao salvar evento', 'error');
    })
    .finally(() => { if (saveBtn) saveBtn.disabled = false; });
});

/* ---- Lucro dinâmico no form ---- */
function attachLucroListener() {
  // cria ou reaponta elementos
  const valorEl = eventForm.elements['valor_contrato_final'];
  const custosEl = eventForm.elements['custos_adicionais'];

  // cria display se não existir
  let lucroDisplay = eventForm.querySelector('.lucro-display');
  if (!lucroDisplay) {
    lucroDisplay = document.createElement('div');
    lucroDisplay.className = 'lucro-display';
    lucroDisplay.style.cssText = 'margin-top:8px;font-weight:700;color:#111';
    // inserir antes das ações (se existir)
    const actions = eventForm.querySelector('.modal-actions');
    if (actions) eventForm.insertBefore(lucroDisplay, actions);
    else eventForm.appendChild(lucroDisplay);
  }

  function calc() {
    const v = Number(valorEl?.value || 0);
    const c = Number(custosEl?.value || 0);
    if (isNaN(v) || isNaN(c)) {
      lucroDisplay.textContent = 'Lucro: —';
      return;
    }
    const lucro = v - c;
    lucroDisplay.textContent = `Lucro estimado: R$ ${lucro.toFixed(2)}`;
    lucroDisplay.style.color = lucro >= 0 ? '#15803d' : '#c53030';
  }

  if (valorEl) valorEl.removeEventListener('input', calc);
  if (custosEl) custosEl.removeEventListener('input', calc);
  if (valorEl) valorEl.addEventListener('input', calc);
  if (custosEl) custosEl.addEventListener('input', calc);
  calc(); // calcula inicial
}

/* ---- search (filtro local com debounce) ---- */
if (searchInput) {
  searchInput.addEventListener('input', () => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      const q = (searchInput.value || '').toLowerCase().trim();
      if (!q) {
        renderTable(eventsCache);
        return;
      }
      const filtered = eventsCache.filter(ev => {
        const nome = (ev.nome_evento ?? ev.nome ?? '').toString().toLowerCase();
        const tipo = (ev.tipo_evento ?? '').toString().toLowerCase();
        return nome.includes(q) || tipo.includes(q);
      });
      renderTable(filtered);
    }, 250);
  });
}

/* ---- polling / auto refresh (only when visible) ---- */
function startPolling(intervalMs = 15000) {
  stopPolling();
  pollingTimer = setInterval(() => {
    if (document.visibilityState === 'visible') loadEvents(false);
  }, intervalMs);
}
function stopPolling() {
  if (pollingTimer) { clearInterval(pollingTimer); pollingTimer = null; }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') loadEvents(false);
});

/* ---- init on DOM ready ---- */
document.addEventListener('DOMContentLoaded', () => {
  // attach lucro listener to support new modal opens
  attachLucroListener();
  loadEvents();
  startPolling(15000);
});


document.getElementById("btn-logout").addEventListener("click", () => {
  // se tiver sessão guardada em localStorage, apaga:
  localStorage.removeItem("auth_token");
  localStorage.removeItem("admin_logged");

  // redireciona para login
  window.location.href = "/login";
});
