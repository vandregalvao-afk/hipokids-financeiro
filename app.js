(() => {
  'use strict';

  /* =====================================================================
     Constantes
     ===================================================================== */
  const cfg = window.HIPOKIDS_CONFIG || {};
  const CANAIS = ['Feira', 'Instagram', 'WhatsApp', 'Live', 'Site', 'Outro'];
  const FORMAS = ['Pix', 'Dinheiro', 'Débito', 'Crédito', 'Outro'];
  const CATEGORIAS_PADRAO = [
    'Mercadoria (fornecedores)', 'Impostos (MEI)', 'Empréstimos', 'Cartão de crédito',
    'Feiras e eventos', 'Embalagens', 'Marketing', 'Frete', 'Contas fixas', 'Outros'
  ];
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

  // Configuração das duas listas de contas (a pagar e a receber)
  const K = {
    pagar: {
      tabela: 'contas_pagar', data: 'vencimento', feito: 'pago', feitoEm: 'pago_em', quem: 'fornecedor',
      verbo: 'Pagar', titulo: 'Contas a pagar', abertas: 'A pagar', feitas: 'Pagas', feitaMin: 'paga',
      msgFeita: 'Paga', mesKey: 'pagasMes', labelData: 'Vencimento', labelQuem: 'Fornecedor (opcional)',
      vazio: 'Nenhuma conta em aberto.', vazioSub: 'Cadastre cartão, empréstimos, fornecedores e impostos.'
    },
    receber: {
      tabela: 'contas_receber', data: 'previsao', feito: 'recebido', feitoEm: 'recebido_em', quem: 'cliente',
      verbo: 'Receber', titulo: 'Contas a receber', abertas: 'A receber', feitas: 'Recebidas', feitaMin: 'recebida',
      msgFeita: 'Recebida', mesKey: 'recebidasMes', labelData: 'Previsão de recebimento', labelQuem: 'Cliente (opcional)',
      vazio: 'Nada a receber no momento.', vazioSub: 'Use para vendas fiadas, parceladas ou cartão a cair.'
    }
  };

  /* =====================================================================
     Utilidades
     ===================================================================== */
  const $ = (s, el = document) => el.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = n => Number(n) || 0;
  const sum = (arr, key) => arr.reduce((t, x) => t + num(x[key]), 0);
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* sem armazenamento */ } }
  };
  const uuid = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID()
    : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10));

  const pad = n => String(n).padStart(2, '0');
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => ymd(new Date());
  const parseYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
  const addMonths = (s, n) => {
    const [y, m, d] = s.split('-').map(Number);
    const t = new Date(y, m - 1 + n, 1);
    const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
    t.setDate(Math.min(d, last));
    return ymd(t);
  };
  const diffDays = (a, b) => Math.round((parseYmd(a) - parseYmd(b)) / 86400000);
  const monthKey = s => (s || '').slice(0, 7);
  const monthLabel = key => { const [y, m] = key.split('-').map(Number); return `${MESES[m - 1]} de ${y}`; };
  const monthTitle = key => monthLabel(key).replace(/^./, c => c.toUpperCase());
  const fmtDate = s => {
    if (!s) return '';
    const [y, m, d] = s.split('-');
    return y === String(new Date().getFullYear()) ? `${d}/${m}` : `${d}/${m}/${y}`;
  };
  const fmtDia = s => `${s === today() ? 'hoje' : DIAS[parseYmd(s).getDay()]}, ${fmtDate(s)}`;
  const rel = s => {
    const d = diffDays(s, today());
    if (d === 0) return 'hoje';
    if (d === 1) return 'amanhã';
    if (d === -1) return 'ontem';
    return d < 0 ? `${-d} dias atrás` : `em ${d} dias`;
  };

  const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const BRL0 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  const COMPACT = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
  const brl = n => BRL.format(num(n));
  const brl0 = n => BRL0.format(num(n));
  const fmtInput = n => String(num(n)).replace('.', ',');
  const parseMoney = str => {
    let s = String(str ?? '').trim().replace(/[^\d.,-]/g, '');
    if (!s) return NaN;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    const n = parseFloat(s);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
  };
  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

  /* =====================================================================
     Camada de dados: Supabase (nuvem) ou localStorage (modo de teste)
     ===================================================================== */
  const configurado = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);
  const cloud = configurado && window.supabase
    ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY)
    : null;

  const LS_KEY = 'hipokids_financeiro_v1';
  const local = {
    read() { try { return JSON.parse(ls.get(LS_KEY)) || {}; } catch { return {}; } },
    write(d) { ls.set(LS_KEY, JSON.stringify(d)); }
  };

  const db = {
    async list(t) {
      if (!cloud) {
        const d = local.read();
        if (t === 'categorias' && !d.categorias) {
          d.categorias = CATEGORIAS_PADRAO.map(nome => ({ id: uuid(), nome, created_at: new Date().toISOString() }));
          local.write(d);
        }
        return d[t] || [];
      }
      const out = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await cloud.from(t).select('*')
          .order('created_at', { ascending: true }).order('id', { ascending: true })
          .range(from, from + 999);
        if (error) throw error;
        out.push(...data);
        if (data.length < 1000) break;
      }
      return out;
    },
    async insert(t, rows) {
      rows = rows.map(r => ({ ...r }));
      if (!cloud) {
        const d = local.read();
        d[t] = d[t] || [];
        const now = new Date().toISOString();
        rows.forEach(r => { r.id = uuid(); r.created_at = now; d[t].push(r); });
        local.write(d);
        return rows;
      }
      const { data, error } = await cloud.from(t).insert(rows).select();
      if (error) throw error;
      return data;
    },
    async update(t, id, patch) {
      if (!cloud) {
        const d = local.read();
        const r = (d[t] || []).find(x => x.id === id);
        if (r) Object.assign(r, patch);
        local.write(d);
        return;
      }
      const { error } = await cloud.from(t).update(patch).eq('id', id);
      if (error) throw error;
    },
    async remove(t, ids) {
      if (!cloud) {
        const d = local.read();
        d[t] = (d[t] || []).filter(x => !ids.includes(x.id));
        if (t === 'categorias') (d.contas_pagar || []).forEach(c => { if (ids.includes(c.categoria_id)) c.categoria_id = null; });
        local.write(d);
        return;
      }
      const { error } = await cloud.from(t).delete().in('id', ids);
      if (error) throw error;
    },
    async user() {
      const { data } = await cloud.auth.getSession();
      return data.session ? data.session.user : null;
    },
    signIn: (email, password) => cloud.auth.signInWithPassword({ email, password }),
    signOut: () => cloud.auth.signOut()
  };

  /* =====================================================================
     Estado
     ===================================================================== */
  const S = { vendas: [], contas_pagar: [], contas_receber: [], categorias: [] };
  const hoje0 = monthKey(today());
  const R = { vendasMes: hoje0, pagasMes: hoje0, recebidasMes: hoje0, painelMes: hoje0, tabs: { pagar: 'abertas', receber: 'abertas' } };
  let loading = false;
  let undoFn = null;
  let sheetBtns = [];

  async function loadAll() {
    const nomes = Object.keys(S);
    const res = await Promise.all(nomes.map(n => db.list(n)));
    nomes.forEach((n, i) => { S[n] = res[i]; });
  }
  async function refresh(t) { S[t] = await db.list(t); render(); }

  const catNome = id => (S.categorias.find(c => c.id === id) || {}).nome || '';
  const porData = key => (a, b) => a[key].localeCompare(b[key]) || String(a.created_at).localeCompare(String(b.created_at));
  const feitaData = (c, kind) => c[K[kind].feitoEm] || c[K[kind].data] || '';
  const lastCanal = () => ls.get('hk_canal') || CANAIS[0];
  const lastForma = () => ls.get('hk_forma') || FORMAS[0];

  function fluxoMes(m) {
    const vendas = S.vendas.filter(v => monthKey(v.data) === m);
    const rec = S.contas_receber.filter(c => c.status === 'recebido' && monthKey(feitaData(c, 'receber')) === m);
    const pag = S.contas_pagar.filter(c => c.status === 'pago' && monthKey(feitaData(c, 'pagar')) === m);
    const v = sum(vendas, 'valor'), r = sum(rec, 'valor'), s = sum(pag, 'valor');
    return { vendas, rec, pag, v, r, ent: v + r, sai: s, res: v + r - s };
  }
  function agrupa(arr, keyFn) {
    const m = new Map();
    arr.forEach(x => { const k = keyFn(x); m.set(k, (m.get(k) || 0) + num(x.valor)); });
    return [...m].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  }

  /* =====================================================================
     Componentes de HTML
     ===================================================================== */
  const field = (label, input) => `<label class="f"><span>${esc(label)}</span>${input}</label>`;
  const select = (name, options, current, extra = '') =>
    `<select name="${name}" ${extra}>${options.map(o => {
      const [v, l] = Array.isArray(o) ? o : [o, o];
      return `<option value="${esc(v)}" ${v === current ? 'selected' : ''}>${esc(l)}</option>`;
    }).join('')}</select>`;
  const empty = (titulo, texto) =>
    `<div class="empty"><img src="icon-192.png" alt=""><p><b>${esc(titulo)}</b></p>${texto ? `<p>${esc(texto)}</p>` : ''}</div>`;
  const monthNav = which =>
    `<div class="mnav"><button data-act="mes" data-w="${which}" data-d="-1" aria-label="Mês anterior">‹</button>` +
    `<strong>${monthTitle(R[which])}</strong>` +
    `<button data-act="mes" data-w="${which}" data-d="1" aria-label="Próximo mês">›</button></div>`;

  const ICONES = {
    inicio: '<path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>',
    vendas: '<circle cx="12" cy="12" r="8"/><path d="M12 7.5v9M9.5 14.2c.4 1 1.3 1.5 2.5 1.5 1.5 0 2.5-.7 2.5-1.8 0-2.4-5-1.2-5-3.6 0-1 1-1.8 2.5-1.8 1.1 0 2 .5 2.4 1.4"/>',
    pagar: '<path d="M7 17 17 7M9 7h8v8"/>',
    receber: '<path d="M17 7 7 17M15 17H7V9"/>',
    painel: '<path d="M5 20V11M12 20V5M19 20v-7"/>'
  };
  const icone = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONES[n]}</svg>`;

  /* =====================================================================
     Telas
     ===================================================================== */
  function contaRow(kind, c) {
    const k = K[kind];
    const done = c.status !== 'pendente';
    const d = c[k.data];
    const partes = [];
    const quem = kind === 'pagar' ? catNome(c.categoria_id) : (c.cliente || '');
    if (quem) partes.push(esc(quem));
    if (c.total_parcelas) partes.push(`parcela ${c.parcela}/${c.total_parcelas}`);
    partes.push(done ? `${k.feitaMin} em ${fmtDate(feitaData(c, kind))}` : `${fmtDate(d)} (${rel(d)})`);
    const atrasada = !done && d < today();
    return `<div class="item ${atrasada ? 'late' : ''}">
      <button class="row" data-act="conta-edit" data-k="${kind}" data-id="${c.id}">
        <span class="r-main"><b>${esc(c.descricao)}</b><small>${partes.join(', ')}</small></span>
        <span class="r-val">${brl(c.valor)}</span>
      </button>
      ${done ? '' : `<button class="pill" data-act="conta-baixa" data-k="${kind}" data-id="${c.id}">${k.verbo}</button>`}
    </div>`;
  }

  function semanas() {
    const t = today();
    const ab = S.contas_pagar.filter(c => c.status === 'pendente');
    const rc = S.contas_receber.filter(c => c.status === 'pendente');
    return [0, 1, 2, 3].map(w => {
      const ini = addDays(t, 7 * w), fim = addDays(t, 7 * w + 6);
      const dentro = d => d <= fim && (w === 0 || d >= ini);
      return { w, ini, fim, sai: sum(ab.filter(c => dentro(c.vencimento)), 'valor'), ent: sum(rc.filter(c => dentro(c.previsao)), 'valor') };
    });
  }

  function cardSemanas() {
    const ws = semanas();
    const max = Math.max(1, ...ws.map(w => Math.max(w.ent, w.sai)));
    const h = v => (v > 0 ? Math.max(3, Math.round(v / max * 100)) : 0);
    const temAlgo = ws.some(w => w.ent || w.sai);
    return `<section class="card">
      <h2>Próximas 4 semanas</h2>
      ${temAlgo ? `<div class="weeks">${ws.map(w => {
        const net = w.ent - w.sai;
        return `<div class="wk">
          <div class="bars" title="Entra ${brl(w.ent)}, sai ${brl(w.sai)}">
            <i class="b-in" style="height:${h(w.ent)}%"></i><i class="b-out" style="height:${h(w.sai)}%"></i>
          </div>
          <span class="wk-d">${w.w === 0 ? 'Esta semana' : 'Semana de ' + fmtDate(w.ini)}</span>
          <span class="wk-n ${net < 0 ? 'neg' : 'pos'}">${net < 0 ? 'Falta' : 'Sobra'} ${brl0(Math.abs(net))}</span>
        </div>`;
      }).join('')}</div>
      <div class="legend"><span class="in">Entra (a receber)</span><span>Sai (a pagar)</span></div>
      <p class="sub">A primeira semana inclui contas atrasadas. Mostra só o que já está cadastrado.</p>`
        : '<p class="sub">Cadastre contas a pagar e a receber para ver se o dinheiro vai dar para cada semana.</p>'}
    </section>`;
  }

  function cardLembretes() {
    const t = today();
    const ab = S.contas_pagar.filter(c => c.status === 'pendente').sort(porData('vencimento'));
    const grupos = [
      ['Atrasadas', ab.filter(c => c.vencimento < t), 'late'],
      ['Hoje', ab.filter(c => c.vencimento === t), ''],
      ['Próximos 7 dias', ab.filter(c => c.vencimento > t && c.vencimento <= addDays(t, 7)), '']
    ].filter(g => g[1].length);
    const podeAvisar = 'Notification' in window && Notification.permission === 'default';
    return `<section class="card">
      <h2>Contas para pagar</h2>
      ${grupos.length ? grupos.map(([n, l, cls]) =>
        `<h3 class="grp ${cls}">${n}<span>${brl(sum(l, 'valor'))}</span></h3><div class="list">${l.map(c => contaRow('pagar', c)).join('')}</div>`).join('')
        : '<p class="sub">Nada vencendo nos próximos 7 dias.</p>'}
      ${podeAvisar ? '<button class="link" data-act="notif">Ativar aviso de vencimentos</button>' : ''}
    </section>`;
  }

  function viewInicio() {
    const t = today();
    const hojeVendas = S.vendas.filter(v => v.data === t);
    const f = fluxoMes(monthKey(t));
    const vazio = !S.vendas.length && !S.contas_pagar.length && !S.contas_receber.length;
    return `
      ${cloud ? '' : '<p class="note">Modo de teste: os dados ficam só neste aparelho. Para usar na nuvem, siga o LEIA-ME.</p>'}
      <section class="card quick">
        <h2>Venda de hoje</h2>
        <p class="sub">${hojeVendas.length ? `${brl(sum(hojeVendas, 'valor'))} em ${plural(hojeVendas.length, 'lançamento', 'lançamentos')}` : 'Nenhum lançamento hoje ainda.'}</p>
        <form data-form="venda-rapida" class="quick-row">
          <input name="valor" inputmode="decimal" autocomplete="off" placeholder="Valor, ex.: 189,90" aria-label="Valor da venda">
          ${select('canal', CANAIS, lastCanal(), 'aria-label="Canal"')}
          <button class="btn primary" type="submit">Lançar</button>
        </form>
        <button class="link" data-act="venda-nova">Outra data ou mais detalhes</button>
      </section>
      ${vazio ? empty('Tudo pronto para começar', 'Lance a primeira venda acima ou cadastre uma conta em Pagar ou Receber.') : ''}
      ${cardLembretes()}
      ${cardSemanas()}
      <section class="card">
        <h2>${monthTitle(monthKey(t))}</h2>
        <div class="stats">
          <div class="stat"><small>Entrou</small><b class="pos">${brl0(f.ent)}</b></div>
          <div class="stat"><small>Saiu</small><b>${brl0(f.sai)}</b></div>
          <div class="stat"><small>Resultado</small><b class="${f.res < 0 ? 'neg' : 'pos'}">${brl0(f.res)}</b></div>
        </div>
      </section>`;
  }

  function vendaRow(v) {
    const sub = [v.forma_pagamento, v.observacao].filter(Boolean).map(esc).join(', ');
    return `<div class="item"><button class="row" data-act="venda-edit" data-id="${v.id}">
      <span class="r-main"><b>${esc(v.canal || 'Venda')}</b>${sub ? `<small>${sub}</small>` : ''}</span>
      <span class="r-val in">${brl(v.valor)}</span></button></div>`;
  }

  function viewVendas() {
    const m = R.vendasMes;
    const rows = S.vendas.filter(v => monthKey(v.data) === m)
      .sort((a, b) => b.data.localeCompare(a.data) || String(b.created_at).localeCompare(String(a.created_at)));
    const dias = [...new Set(rows.map(r => r.data))];
    return `
      <div class="head"><h2>Vendas</h2><button class="btn primary small" data-act="venda-nova">+ Nova venda</button></div>
      ${monthNav('vendasMes')}
      <p class="total">${brl(sum(rows, 'valor'))}<small>em ${plural(rows.length, 'lançamento', 'lançamentos')}</small></p>
      ${rows.length ? dias.map(d => {
        const l = rows.filter(r => r.data === d);
        return `<h3 class="grp">${fmtDia(d)}<span>${brl(sum(l, 'valor'))}</span></h3><div class="list">${l.map(vendaRow).join('')}</div>`;
      }).join('') : empty('Nenhuma venda neste mês.', 'Use o botão Nova venda para lançar.')}`;
  }

  function viewContas(kind) {
    const k = K[kind];
    const t = today();
    const all = S[k.tabela];
    const tab = R.tabs[kind];
    const seg = `<div class="seg" role="group" aria-label="Filtro">
      <button data-act="tab" data-k="${kind}" data-v="abertas" class="${tab === 'abertas' ? 'on' : ''}">${k.abertas}</button>
      <button data-act="tab" data-k="${kind}" data-v="feitas" class="${tab === 'feitas' ? 'on' : ''}">${k.feitas}</button></div>`;
    const head = `<div class="head"><h2>${k.titulo}</h2><button class="btn primary small" data-act="conta-nova" data-k="${kind}">+ Nova</button></div>`;
    let corpo = '';
    if (tab === 'abertas') {
      const ab = all.filter(c => c.status === 'pendente').sort(porData(k.data));
      const lim = addDays(t, 7);
      const grupos = [
        ['Atrasadas', c => c[k.data] < t, 'late'],
        ['Hoje', c => c[k.data] === t, ''],
        ['Próximos 7 dias', c => c[k.data] > t && c[k.data] <= lim, ''],
        ['Depois', c => c[k.data] > lim, '']
      ];
      corpo = `<p class="total">${brl(sum(ab, 'valor'))}<small>em aberto</small></p>` +
        (ab.length ? grupos.map(([n, f, cls]) => {
          const l = ab.filter(f);
          return l.length ? `<h3 class="grp ${cls}">${n}<span>${brl(sum(l, 'valor'))}</span></h3><div class="list">${l.map(c => contaRow(kind, c)).join('')}</div>` : '';
        }).join('') : empty(k.vazio, k.vazioSub));
    } else {
      const m = R[k.mesKey];
      const feitas = all.filter(c => c.status !== 'pendente' && monthKey(feitaData(c, kind)) === m)
        .sort((a, b) => feitaData(b, kind).localeCompare(feitaData(a, kind)));
      corpo = monthNav(k.mesKey) +
        `<p class="total">${brl(sum(feitas, 'valor'))}<small>${k.feitas.toLowerCase()} no mês</small></p>` +
        (feitas.length ? `<div class="list">${feitas.map(c => contaRow(kind, c)).join('')}</div>` : empty(`Nenhuma conta ${k.feitaMin} neste mês.`, ''));
    }
    return head + seg + corpo;
  }

  function barras(lista) {
    if (!lista.length) return '<p class="sub">Sem dados neste mês.</p>';
    const max = lista[0].value || 1;
    const tot = sum(lista, 'value') || 1;
    return `<div class="hbars">${lista.map(i => `
      <div class="hb"><div class="hb-top"><span>${esc(i.label)}</span><b>${brl(i.value)}</b></div>
        <div class="hb-track"><i style="width:${Math.max(2, i.value / max * 100)}%"></i></div>
        <small>${Math.round(i.value / tot * 100)}% do total</small></div>`).join('')}</div>`;
  }

  function cardSeisMeses() {
    const t = today();
    const ms = [5, 4, 3, 2, 1, 0].map(i => monthKey(addMonths(t, -i)));
    const dados = ms.map(m => ({ m, ...fluxoMes(m) }));
    const max = Math.max(1, ...dados.map(d => Math.max(d.ent, d.sai)));
    const h = v => (v > 0 ? Math.max(3, Math.round(v / max * 100)) : 0);
    return `<section class="card"><h2>Últimos 6 meses</h2>
      <div class="months">${dados.map(d => `<div class="wk">
        <div class="bars" title="Entrou ${brl(d.ent)}, saiu ${brl(d.sai)}">
          <i class="b-in" style="height:${h(d.ent)}%;width:14px"></i><i class="b-out" style="height:${h(d.sai)}%;width:14px"></i></div>
        <span class="wk-d">${MESES_CURTOS[Number(d.m.slice(5)) - 1]}</span>
        <span class="wk-n ${d.res < 0 ? 'neg' : 'pos'}">${d.res < 0 ? '-' : ''}${COMPACT.format(Math.abs(d.res))}</span></div>`).join('')}</div>
      <div class="legend"><span class="in">Entrou</span><span>Saiu</span></div>
      <p class="sub">O número embaixo de cada mês é o resultado.</p></section>`;
  }

  function viewPainel() {
    const m = R.painelMes;
    const f = fluxoMes(m);
    const ant = fluxoMes(monthKey(addMonths(m + '-01', -1)));
    const canais = agrupa(f.vendas, v => v.canal || 'Sem canal');
    const cats = agrupa(f.pag, c => catNome(c.categoria_id) || 'Sem categoria');
    const dias = agrupa(f.vendas, v => v.data);
    const media = dias.length ? f.v / dias.length : 0;
    const delta = ant.ent > 0 ? Math.round((f.ent - ant.ent) / ant.ent * 100) : null;
    const comprometido = sum(S.contas_pagar.filter(c => c.status === 'pendente' && c.vencimento <= addDays(today(), 30)), 'valor');
    return `
      <div class="head"><h2>Painel</h2></div>
      ${monthNav('painelMes')}
      <section class="card">
        <p class="sub">Resultado do mês</p>
        <p class="big ${f.res < 0 ? 'neg' : 'pos'}">${brl(f.res)}</p>
        <div class="split">
          <div><small>Entrou</small><b>${brl(f.ent)}</b><em>vendas ${brl0(f.v)}, recebimentos ${brl0(f.r)}</em></div>
          <div><small>Saiu</small><b>${brl(f.sai)}</b><em>contas pagas no mês</em></div>
        </div>
        ${delta !== null ? `<p class="sub">Entradas ${delta >= 0 ? 'subiram' : 'caíram'} ${Math.abs(delta)}% em relação ao mês anterior.</p>` : ''}
        <p class="sub">Conta o que foi efetivamente recebido e pago dentro do mês.</p>
      </section>
      <section class="card"><h2>Vendas por canal</h2>${barras(canais)}</section>
      <section class="card"><h2>Despesas por categoria</h2>${barras(cats)}</section>
      <section class="card"><h2>Ritmo das vendas</h2>
        <div class="hl">
          <div class="stat"><small>Dias com venda</small><b>${dias.length}</b></div>
          <div class="stat"><small>Média por dia</small><b>${brl0(media)}</b></div>
          <div class="stat"><small>Melhor dia</small><b>${dias.length ? brl0(dias[0].value) : '-'}</b></div>
        </div>
        ${dias.length ? `<p class="sub">Melhor dia: ${fmtDia(dias[0].label)}.</p>` : ''}
      </section>
      ${cardSeisMeses()}
      <section class="card"><h2>Já comprometido</h2>
        <p class="big">${brl0(comprometido)}</p>
        <p class="sub">Contas a pagar com vencimento até daqui a 30 dias, incluindo atrasadas.</p></section>`;
  }

  const VIEWS = { inicio: viewInicio, vendas: viewVendas, pagar: () => viewContas('pagar'), receber: () => viewContas('receber'), painel: viewPainel };
  const currentView = () => { const v = location.hash.replace(/^#\/?/, ''); return VIEWS[v] ? v : 'inicio'; };

  function render() {
    const main = $('#main');
    if (!main) return;
    const v = currentView();
    main.innerHTML = loading ? '<p class="boot">Carregando…</p>' : VIEWS[v]();
    document.querySelectorAll('.tabs a').forEach(a => a.classList.toggle('on', a.dataset.v === v));
  }

  /* =====================================================================
     Janelas (formulários) e avisos
     ===================================================================== */
  function openSheet({ title, body, submitLabel = 'Salvar', onSubmit, buttons = [] }) {
    const d = $('#sheet');
    sheetBtns = buttons.map(b => b.fn);
    d.innerHTML = `<form class="sheet-form">
      <header class="sheet-head"><h2>${esc(title)}</h2><button type="button" class="x" data-act="sheet-close" aria-label="Fechar">×</button></header>
      <div class="sheet-body">${body}</div>
      <p class="err" role="alert" hidden></p>
      ${(onSubmit || buttons.length) ? `<footer class="sheet-foot">
        ${buttons.map((b, i) => `<button type="button" class="btn ${b.cls || 'ghost'}" data-act="sheet-btn" data-i="${i}">${esc(b.label)}</button>`).join('')}
        ${onSubmit ? `<button class="btn primary" type="submit">${esc(submitLabel)}</button>` : ''}</footer>` : ''}
    </form>`;
    const form = $('form', d);
    const err = $('.err', d);
    if (onSubmit) {
      form.addEventListener('submit', async ev => {
        ev.preventDefault();
        const btn = $('button[type=submit]', form);
        err.hidden = true;
        btn.disabled = true;
        try {
          const r = await onSubmit(new FormData(form));
          if (r !== 'stay') closeSheet();
        } catch (ex) {
          err.textContent = (ex && ex.message) || 'Não foi possível salvar.';
          err.hidden = false;
        } finally { btn.disabled = false; }
      });
    }
    if (!d.open) d.showModal();
    const first = $('input:not([type=hidden]):not([hidden]), select', form);
    if (first && onSubmit) first.focus();
  }
  const closeSheet = () => { const d = $('#sheet'); if (d.open) d.close(); };

  function ask(titulo, texto, opcoes) {
    return new Promise(resolve => {
      const d = $('#ask');
      d.innerHTML = `<form method="dialog" class="ask-form"><h2>${esc(titulo)}</h2><p>${esc(texto)}</p>
        <div class="ask-btns">${opcoes.map(([k, l]) => `<button class="btn danger" value="${esc(k)}">${esc(l)}</button>`).join('')}
        <button class="btn ghost" value="">Cancelar</button></div></form>`;
      d.returnValue = '';
      d.onclose = () => resolve(d.returnValue || null);
      d.showModal();
    });
  }

  let toastTimer;
  function toast(msg, undo) {
    const el = $('#toast');
    undoFn = undo || null;
    el.innerHTML = `<span>${esc(msg)}</span>${undo ? '<button data-act="undo">Desfazer</button>' : ''}`;
    el.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('on'), undo ? 7000 : 4000);
  }
  async function run(fn) {
    try { await fn(); } catch (e) { toast('Não foi possível concluir: ' + ((e && e.message) || 'erro desconhecido')); }
  }

  /* ---------- vendas ---------- */
  function vendaSheet(v) {
    const edit = !!v;
    v = v || { data: today(), valor: '', canal: lastCanal(), forma_pagamento: lastForma(), observacao: '' };
    openSheet({
      title: edit ? 'Editar venda' : 'Lançar venda',
      submitLabel: edit ? 'Salvar' : 'Lançar venda',
      body: field('Valor', `<input name="valor" inputmode="decimal" autocomplete="off" required placeholder="0,00" value="${v.valor === '' ? '' : fmtInput(v.valor)}">`) +
        field('Data', `<input type="date" name="data" required value="${esc(v.data)}">`) +
        field('Canal', select('canal', CANAIS, v.canal)) +
        field('Pagamento', select('forma_pagamento', FORMAS, v.forma_pagamento)) +
        field('Observação (opcional)', `<input name="observacao" value="${esc(v.observacao || '')}" placeholder="Ex.: total do dia, feira da praça">`),
      buttons: edit ? [{
        label: 'Excluir', cls: 'danger', fn: async () => {
          const r = await ask('Excluir venda?', `${brl(v.valor)} em ${fmtDate(v.data)}`, [['sim', 'Excluir venda']]);
          if (!r) return;
          await run(async () => { await db.remove('vendas', [v.id]); await refresh('vendas'); closeSheet(); toast('Venda excluída.'); });
        }
      }] : [],
      onSubmit: async fd => {
        const valor = parseMoney(fd.get('valor'));
        if (!(valor > 0)) throw new Error('Informe um valor maior que zero.');
        const data = fd.get('data');
        if (!data) throw new Error('Informe a data.');
        const row = {
          data, valor, canal: fd.get('canal'), forma_pagamento: fd.get('forma_pagamento'),
          observacao: (fd.get('observacao') || '').trim() || null
        };
        if (edit) await db.update('vendas', v.id, row); else await db.insert('vendas', [row]);
        ls.set('hk_canal', row.canal); ls.set('hk_forma', row.forma_pagamento);
        await refresh('vendas');
      }
    });
  }

  /* ---------- contas ---------- */
  async function resolverCategoria(fd) {
    const sel = fd.get('categoria_id');
    if (sel === '__nova') {
      const nome = (fd.get('nova_categoria') || '').trim();
      if (!nome) throw new Error('Digite o nome da nova categoria.');
      const existente = S.categorias.find(c => c.nome.toLowerCase() === nome.toLowerCase());
      if (existente) return existente.id;
      const [nova] = await db.insert('categorias', [{ nome }]);
      S.categorias.push(nova);
      return nova.id;
    }
    return sel || null;
  }

  function contaSheet(kind, c) {
    const k = K[kind];
    const edit = !!c;
    const x = c || { descricao: '', valor: '', [k.data]: today(), categoria_id: '', forma_pagamento: '', observacao: '', [k.quem]: '' };
    const done = edit && c.status !== 'pendente';
    const cats = [...S.categorias].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    const catHtml = kind === 'pagar'
      ? field('Categoria', `<select name="categoria_id"><option value="">Sem categoria</option>${cats.map(cat =>
        `<option value="${cat.id}" ${cat.id === x.categoria_id ? 'selected' : ''}>${esc(cat.nome)}</option>`).join('')}<option value="__nova">+ Nova categoria…</option></select>`) +
        `<label class="f js-nova" hidden><span>Nome da nova categoria</span><input name="nova_categoria" autocomplete="off"></label>`
      : '';
    const repHtml = !edit
      ? field('Repetição', `<select name="repete"><option value="unica">Só esta vez</option><option value="parcelada">Parcelada (mesmo valor, todo mês)</option><option value="mensal">Todo mês, pelos próximos 12 meses</option></select>`) +
        `<label class="f js-parc" hidden><span>Número de parcelas</span><input name="parcelas" inputmode="numeric" autocomplete="off" placeholder="Ex.: 10"></label>`
      : '';
    const buttons = [];
    if (edit && done) {
      buttons.push({
        label: 'Voltar para pendente', fn: async () => run(async () => {
          await db.update(k.tabela, c.id, { status: 'pendente', [k.feitoEm]: null });
          await refresh(k.tabela); closeSheet();
        })
      });
    }
    if (edit) buttons.push({ label: 'Excluir', cls: 'danger', fn: () => excluirConta(kind, c) });

    openSheet({
      title: edit ? 'Editar conta' : (kind === 'pagar' ? 'Nova conta a pagar' : 'Nova conta a receber'),
      submitLabel: edit ? 'Salvar' : 'Cadastrar',
      buttons,
      body: field('Descrição', `<input name="descricao" required autocomplete="off" value="${esc(x.descricao)}" placeholder="${kind === 'pagar' ? 'Ex.: Fatura do cartão' : 'Ex.: Venda parcelada, Maria'}">`) +
        field('Valor', `<input name="valor" inputmode="decimal" autocomplete="off" required placeholder="0,00" value="${x.valor === '' ? '' : fmtInput(x.valor)}">`) +
        field(k.labelData, `<input type="date" name="data" required value="${esc(x[k.data])}">`) +
        catHtml + repHtml +
        field(k.labelQuem, `<input name="quem" autocomplete="off" value="${esc(x[k.quem] || '')}">`) +
        field('Forma de pagamento (opcional)', select('forma_pagamento', [['', 'Não informar'], ...FORMAS], x.forma_pagamento || '')) +
        (done ? field('Data em que foi ' + k.feitaMin, `<input type="date" name="feita_em" value="${esc(feitaData(c, kind))}">`) : '') +
        field('Observação (opcional)', `<input name="observacao" autocomplete="off" value="${esc(x.observacao || '')}">`),
      onSubmit: async fd => {
        const descricao = (fd.get('descricao') || '').trim();
        if (!descricao) throw new Error('Informe a descrição.');
        const valor = parseMoney(fd.get('valor'));
        if (!(valor > 0)) throw new Error('Informe um valor maior que zero.');
        const data = fd.get('data');
        if (!data) throw new Error('Informe a data.');
        const comum = {
          descricao, valor, [k.data]: data,
          forma_pagamento: fd.get('forma_pagamento') || null,
          observacao: (fd.get('observacao') || '').trim() || null,
          [k.quem]: (fd.get('quem') || '').trim() || null
        };
        if (kind === 'pagar') comum.categoria_id = await resolverCategoria(fd);

        if (edit) {
          if (done) comum[k.feitoEm] = fd.get('feita_em') || c[k.feitoEm];
          await db.update(k.tabela, c.id, comum);
        } else {
          const rep = fd.get('repete') || 'unica';
          let n = 1;
          if (rep === 'parcelada') {
            n = parseInt(fd.get('parcelas'), 10);
            if (!(n >= 2 && n <= 120)) throw new Error('Informe de 2 a 120 parcelas.');
          } else if (rep === 'mensal') n = 12;
          const grupo = n > 1 ? uuid() : null;
          const rows = Array.from({ length: n }, (_, i) => ({
            ...comum, [k.data]: addMonths(data, i), status: 'pendente',
            grupo_id: grupo,
            parcela: rep === 'parcelada' ? i + 1 : null,
            total_parcelas: rep === 'parcelada' ? n : null
          }));
          await db.insert(k.tabela, rows);
        }
        await refresh(k.tabela);
      }
    });
  }

  async function excluirConta(kind, c) {
    const k = K[kind];
    const seg = c.grupo_id
      ? S[k.tabela].filter(x => x.grupo_id === c.grupo_id && x.status === 'pendente' && x.id !== c.id && x[k.data] > c[k.data])
      : [];
    const opcoes = [['so', 'Excluir só esta']];
    if (seg.length) opcoes.push(['seg', `Excluir esta e as ${seg.length} seguintes`]);
    const r = await ask('Excluir lançamento?', `${c.descricao}, ${brl(c.valor)}`, opcoes);
    if (!r) return;
    const ids = r === 'seg' ? [c.id, ...seg.map(x => x.id)] : [c.id];
    await run(async () => {
      await db.remove(k.tabela, ids);
      await refresh(k.tabela);
      closeSheet();
      toast(ids.length > 1 ? `${ids.length} lançamentos excluídos.` : 'Lançamento excluído.');
    });
  }

  async function baixar(kind, id) {
    const k = K[kind];
    const c = S[k.tabela].find(x => x.id === id);
    if (!c) return;
    await run(async () => {
      await db.update(k.tabela, id, { status: k.feito, [k.feitoEm]: today() });
      await refresh(k.tabela);
      toast(`${k.msgFeita}: ${c.descricao}`, () => run(async () => {
        await db.update(k.tabela, id, { status: 'pendente', [k.feitoEm]: null });
        await refresh(k.tabela);
      }));
    });
  }

  /* ---------- menu, categorias, exportação, avisos ---------- */
  function menuSheet() {
    openSheet({
      title: 'Menu',
      body: `<div class="menu">
        <button type="button" class="menu-i" data-act="categorias">Categorias de despesa</button>
        ${'Notification' in window ? '<button type="button" class="menu-i" data-act="notif">Ativar aviso de vencimentos</button>' : ''}
        <button type="button" class="menu-i" data-act="csv">Baixar planilha (CSV)</button>
        <button type="button" class="menu-i" data-act="json">Baixar backup completo</button>
        ${cloud ? '<button type="button" class="menu-i" data-act="sair">Sair</button>' : ''}
      </div>
      <p class="sub">${cloud ? 'Dados guardados na nuvem (Supabase).' : 'Modo de teste: dados guardados só neste aparelho.'}</p>`
    });
  }

  function categoriasSheet() {
    const lista = [...S.categorias].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    openSheet({
      title: 'Categorias de despesa',
      submitLabel: 'Adicionar',
      body: `<ul class="cats">${lista.map(c => `<li><span>${esc(c.nome)}</span>
        <button type="button" class="x" data-act="cat-del" data-id="${c.id}" aria-label="Excluir ${esc(c.nome)}">×</button></li>`).join('')}</ul>` +
        field('Nova categoria', '<input name="nome" autocomplete="off" placeholder="Ex.: Aluguel de espaço">'),
      onSubmit: async fd => {
        const nome = (fd.get('nome') || '').trim();
        if (!nome) throw new Error('Digite o nome da categoria.');
        if (S.categorias.some(c => c.nome.toLowerCase() === nome.toLowerCase())) throw new Error('Essa categoria já existe.');
        await db.insert('categorias', [{ nome }]);
        await refresh('categorias');
        categoriasSheet();
        return 'stay';
      }
    });
  }

  function baixarArquivo(nome, conteudo, tipo) {
    const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
    const a = document.createElement('a');
    a.href = url; a.download = nome;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  function exportarCsv() {
    const cel = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const dec = v => num(v).toFixed(2).replace('.', ',');
    const linhas = [['Tipo', 'Data', 'Descrição', 'Categoria ou canal', 'Valor', 'Situação', 'Data da baixa']];
    S.vendas.forEach(v => linhas.push(['Venda', v.data, v.observacao || '', v.canal || '', dec(v.valor), 'recebida', v.data]));
    S.contas_pagar.forEach(c => linhas.push(['A pagar', c.vencimento, c.descricao, catNome(c.categoria_id), dec(c.valor), c.status, c.pago_em || '']));
    S.contas_receber.forEach(c => linhas.push(['A receber', c.previsao, c.descricao, c.cliente || '', dec(c.valor), c.status, c.recebido_em || '']));
    const csv = '\ufeff' + linhas.map(l => l.map(cel).join(';')).join('\r\n');
    baixarArquivo(`financeiro-hipokids-${today()}.csv`, csv, 'text/csv;charset=utf-8');
    toast('Planilha baixada.');
  }
  function exportarJson() {
    baixarArquivo(`backup-financeiro-hipokids-${today()}.json`, JSON.stringify(S, null, 2), 'application/json');
    toast('Backup baixado.');
  }

  async function lembrar(forcar) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const t = today();
    if (!forcar && ls.get('hk_notif') === t) return;
    const limite = addDays(t, 1);
    const devidas = S.contas_pagar.filter(c => c.status === 'pendente' && c.vencimento <= limite);
    if (!devidas.length) { if (forcar) toast('Nenhuma conta vence hoje ou amanhã.'); return; }
    ls.set('hk_notif', t);
    const atrasadas = devidas.filter(c => c.vencimento < t).length;
    const hojeN = devidas.filter(c => c.vencimento === t).length;
    const amanha = devidas.filter(c => c.vencimento === limite).length;
    const partes = [];
    if (atrasadas) partes.push(plural(atrasadas, 'atrasada', 'atrasadas'));
    if (hojeN) partes.push(`${plural(hojeN, 'vence', 'vencem')} hoje`);
    if (amanha) partes.push(`${plural(amanha, 'vence', 'vencem')} amanhã`);
    const corpo = `${partes.join(', ')}. Total: ${brl(sum(devidas, 'valor'))}.`;
    try {
      const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
      if (reg) await reg.showNotification('Contas para pagar', { body: corpo, icon: 'icon-192.png' });
      else new Notification('Contas para pagar', { body: corpo, icon: 'icon-192.png' });
    } catch { /* aviso indisponível neste aparelho */ }
  }
  async function ativarAvisos() {
    if (!('Notification' in window)) return;
    const p = await Notification.requestPermission();
    closeSheet();
    if (p === 'granted') { toast('Avisos ativados. Você recebe o aviso ao abrir o app.'); await lembrar(true); }
    else toast('O aparelho não permitiu os avisos.');
    render();
  }

  /* =====================================================================
     Eventos
     ===================================================================== */
  const ACTIONS = {
    'sheet-close': () => closeSheet(),
    'sheet-btn': ds => { const f = sheetBtns[Number(ds.i)]; if (f) f(); },
    menu: menuSheet,
    mes: ds => { R[ds.w] = monthKey(addMonths(R[ds.w] + '-01', Number(ds.d))); render(); },
    tab: ds => { R.tabs[ds.k] = ds.v; render(); },
    'venda-nova': () => vendaSheet(),
    'venda-edit': ds => { const v = S.vendas.find(x => x.id === ds.id); if (v) vendaSheet(v); },
    'conta-nova': ds => contaSheet(ds.k),
    'conta-edit': ds => { const c = S[K[ds.k].tabela].find(x => x.id === ds.id); if (c) contaSheet(ds.k, c); },
    'conta-baixa': ds => baixar(ds.k, ds.id),
    undo: () => { const f = undoFn; undoFn = null; $('#toast').classList.remove('on'); if (f) f(); },
    notif: ativarAvisos,
    categorias: categoriasSheet,
    'cat-del': async ds => {
      const cat = S.categorias.find(c => c.id === ds.id);
      if (!cat) return;
      const r = await ask('Excluir categoria?', `${cat.nome}. As contas que usam esta categoria ficam sem categoria.`, [['sim', 'Excluir categoria']]);
      if (!r) return;
      await run(async () => { await db.remove('categorias', [cat.id]); await Promise.all([refresh('categorias'), refresh('contas_pagar')]); categoriasSheet(); });
    },
    csv: () => { closeSheet(); exportarCsv(); },
    json: () => { closeSheet(); exportarJson(); },
    sair: async () => { closeSheet(); await db.signOut(); },
    reload: () => location.reload()
  };

  const FORMS = {
    'venda-rapida': async f => {
      const fd = new FormData(f);
      const valor = parseMoney(fd.get('valor'));
      if (!(valor > 0)) { toast('Digite o valor da venda.'); return; }
      const canal = fd.get('canal');
      ls.set('hk_canal', canal);
      await run(async () => {
        const [row] = await db.insert('vendas', [{ data: today(), valor, canal, forma_pagamento: lastForma() }]);
        await refresh('vendas');
        toast(`Venda de ${brl(valor)} lançada.`, () => run(async () => { await db.remove('vendas', [row.id]); await refresh('vendas'); }));
      });
    },
    login: async f => {
      const fd = new FormData(f);
      const btn = $('button', f);
      btn.disabled = true;
      const { error } = await db.signIn(String(fd.get('email')).trim(), fd.get('senha'));
      btn.disabled = false;
      if (error) {
        const e = $('.err', f);
        e.textContent = /invalid/i.test(error.message) ? 'E-mail ou senha incorretos.' : 'Não foi possível entrar: ' + error.message;
        e.hidden = false;
      } else start();
    }
  };

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const fn = ACTIONS[el.dataset.act];
    if (fn) fn(el.dataset, el, e);
  });
  document.addEventListener('submit', e => {
    const f = e.target.closest('[data-form]');
    if (!f) return;
    e.preventDefault();
    const fn = FORMS[f.dataset.form];
    if (fn) fn(f);
  });
  document.addEventListener('change', e => {
    const t = e.target;
    const d = $('#sheet');
    if (!d.contains(t)) return;
    if (t.name === 'repete') {
      $('.js-parc', d).hidden = t.value !== 'parcelada';
      const rotulo = $('[name=valor]', d).closest('label').firstElementChild;
      rotulo.textContent = t.value === 'parcelada' ? 'Valor de cada parcela' : (t.value === 'mensal' ? 'Valor de cada mês' : 'Valor');
    }
    if (t.name === 'categoria_id') $('.js-nova', d).hidden = t.value !== '__nova';
  });
  $('#sheet').addEventListener('click', e => { if (e.target === e.currentTarget) closeSheet(); });
  window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });

  /* =====================================================================
     Início do app
     ===================================================================== */
  function shell() {
    const aba = (v, rot) => `<a href="#/${v}" data-v="${v}">${icone(v)}<span>${rot}</span></a>`;
    $('#app').innerHTML = `
      <header class="top">
        <img src="icon-192.png" alt="">
        <h1>Financeiro</h1>
        <button class="icon-btn" data-act="menu" aria-label="Menu">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
        </button>
      </header>
      <main id="main"></main>
      <nav class="tabs" aria-label="Seções">
        ${aba('inicio', 'Início')}${aba('vendas', 'Vendas')}${aba('pagar', 'Pagar')}${aba('receber', 'Receber')}${aba('painel', 'Painel')}
      </nav>`;
  }

  async function start() {
    shell();
    loading = true; render();
    try {
      await loadAll();
      loading = false; render();
      lembrar();
    } catch (e) {
      loading = false;
      $('#main').innerHTML = `<div class="empty"><p><b>Não foi possível carregar os dados.</b></p><p>${esc((e && e.message) || '')}</p>
        <button class="btn primary" data-act="reload">Tentar de novo</button></div>`;
    }
  }

  function telaLogin() {
    $('#app').innerHTML = `<main class="login">
      <img src="logo-completa-transparente.png" alt="Hipokids" width="150">
      <h1>Financeiro</h1>
      <p class="sub">Entre com seu e-mail e senha.</p>
      <form data-form="login">
        ${field('E-mail', '<input type="email" name="email" autocomplete="username" required>')}
        ${field('Senha', '<input type="password" name="senha" autocomplete="current-password" required>')}
        <p class="err" role="alert" hidden></p>
        <button class="btn primary wide" type="submit">Entrar</button>
      </form></main>`;
  }

  async function boot() {
    if (configurado && !cloud) {
      $('#app').innerHTML = `<div class="empty"><p><b>Sem conexão com o servidor.</b></p>
        <p>Não foi possível carregar o Supabase. Confira a internet e tente de novo.</p>
        <button class="btn primary" data-act="reload">Tentar de novo</button></div>`;
      return;
    }
    if (cloud) {
      cloud.auth.onAuthStateChange(ev => { if (ev === 'SIGNED_OUT') telaLogin(); });
      let user = null;
      try { user = await db.user(); } catch { /* sem sessão */ }
      if (!user) { telaLogin(); return; }
    }
    await start();
  }

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
  boot();
})();
