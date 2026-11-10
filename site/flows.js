(() => {
  const page = location.pathname.replace(/\/$/, '');
  const main = document.querySelector('main');
  const marksKey = 'mx-life-marks-v1';
  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  };
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const make = (tag, text) => {
    const el = document.createElement(tag);
    if (text) el.textContent = text;
    return el;
  };
  const button = (text, action) => {
    const el = make('button', text);
    el.type = 'button';
    el.className = 'life-action';
    el.addEventListener('click', action);
    return el;
  };
  const panel = (title) => {
    const el = make('section');
    el.style.cssText = 'max-width:70rem;margin:1rem auto;padding:1.25rem;border:1px solid;border-radius:1rem';
    el.append(make('h2', title));
    return el;
  };
  const link = (item) => {
    const el = make('a', item.title);
    el.href = item.url;
    return el;
  };
  let catalog;
  const entries = () => catalog ??= fetch('/entries.json').then(response => {
    if (!response.ok) throw Error('建议目录加载失败');
    return response.json();
  }).catch(error => { catalog = undefined; throw error; });
  const sample = (list, count) => {
    const pool = [...list];
    for (let i = 0; i < Math.min(count, pool.length); i++) {
      const j = i + Math.floor(Math.random() * (pool.length - i));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, count);
  };
  function download(name, blob) {
    const url = URL.createObjectURL(blob);
    const a = make('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function mark(items, status) {
    const marks = read(marksKey, {});
    for (const item of items) marks[item.id] = { ...marks[item.id], ...item, status };
    write(marksKey, marks);
  }

  if (main && page === '/book') {
    const box = panel('搜索全书');
    const input = make('input');
    input.type = 'search';
    input.placeholder = '输入关键词搜索建议';
    input.setAttribute('aria-label', '搜索全书');
    const results = make('ul');
    results.setAttribute('aria-live', 'polite');
    box.append(input, results);
    main.prepend(box);
    input.addEventListener('input', async () => {
      const query = input.value.trim().toLowerCase();
      results.replaceChildren();
      if (!query) return;
      try {
        const list = await entries();
        if (query !== input.value.trim().toLowerCase()) return;
        const matches = list.filter(item => item.title.toLowerCase().includes(query));
        results.append(...matches.slice(0, 50).map(item => {
          const row = make('li');
          row.append(link(item));
          return row;
        }));
        if (!matches.length) results.append(make('li', '没有找到匹配的建议'));
      } catch (error) { results.append(make('li', error.message)); }
    });
  }

  if (main && page === '/dashboard') {
    const box = main.querySelector('section');
    if (box && box.querySelector('h2')?.textContent === '我的本地清单') {
      const list = make('div');
      const filters = make('div');
      function render(type) {
        list.replaceChildren();
        for (const [id, entry] of Object.entries(read(marksKey, {}))) {
          if (!(entry.status || entry.favorite || entry.note)) continue;
          if (type === 'favorite' ? !entry.favorite : type && entry.status !== type) continue;
          const row = make('p');
          row.append(link({ title: entry.title || id, url: '/book/' + id.split('-')[0] + '#' + id }));
          if (entry.note) row.append(make('small', ' · ' + entry.note));
          list.append(row);
        }
        if (!list.children.length) list.append(make('p', '这个分类还没有记录。'));
      }
      for (const [label, type] of [['全部',''],['已做到','done'],['待做','todo'],['已忽略','ignored'],['收藏','favorite']])
        filters.append(button(label, () => render(type)));
      const exportCSV = () => {
        const field = value => '"' + String(value ?? '').replace(/^[=+\-@\t\r]/, m => "'" + m).replaceAll('"', '""') + '"';
        const rows = Object.entries(read(marksKey, {})).map(([id, m]) => [id, m.title, m.status, m.favorite, m.note].map(field).join(','));
        download('我的清单.csv', new Blob(['\uFEFF编号,标题,状态,收藏,备注\r\n' + rows.join('\r\n')], {type:'text/csv;charset=utf-8'}));
      };
      filters.append(button('导出 CSV', exportCSV));
      for (const existing of main.querySelectorAll('button')) {
        const label = existing.textContent.trim();
        const mapped = [['我的条目',''],['已做到','done'],['待做','todo'],['已忽略','ignored'],['收藏','favorite']].find(([name]) => label.startsWith(name));
        if (mapped) existing.addEventListener('click', () => { render(mapped[1]); box.scrollIntoView(); });
        if (label === '导出 CSV') existing.addEventListener('click', exportCSV);
      }
      box.replaceChildren(make('h2', '我的本地清单'), filters, list);
      render('');
    }
  }

  if (page.startsWith('/book/')) {
    for (const card of document.querySelectorAll('.life-entry-card[id]')) {
      const note = make('textarea');
      note.rows = 2;
      note.placeholder = '添加个人备注';
      note.setAttribute('aria-label', '个人备注');
      const key = 'mx-entry-note-' + card.id;
      note.value = read(marksKey, {})[card.id]?.note ?? read(key, '');
      note.addEventListener('change', () => { const marks = read(marksKey, {}); marks[card.id] = { ...marks[card.id], title: card.querySelector('h2')?.textContent, note: note.value }; write(marksKey, marks); });
      const details = make('details');
      details.append(make('summary','个人备注'), note);
      card.append(details);
    }
  }

  if (main && page === '/checkup') {
    for (const trigger of main.querySelectorAll('button')) {
      if (!['开始体检', '给爸妈做一份'].includes(trigger.textContent.trim())) continue;
      trigger.addEventListener('click', async () => {
        const key = 'mx-checkup-' + (trigger.textContent.includes('爸妈') ? 'family' : 'self');
        const box = panel('生活行动自查');
        document.getElementById('mx-checkup')?.remove();
        box.id = 'mx-checkup';
        main.append(box);
        box.scrollIntoView();
        try {
          const list = await entries();
          const saved = read(key, null);
          const questions = saved?.ids?.map(id => list.find(item => item.id === id)).filter(Boolean)
            ?? sample(list.filter(item => /^(01|02|03|04|05|14|17)-/.test(item.id)), 15);
          const answers = saved?.answers ?? {};
          const form = make('form');
          for (const item of questions) {
            const row = make('fieldset');
            row.append(make('legend', item.title));
            for (const [label, value] of [['已做到','done'],['还没做到','todo'],['不适用','skip']]) {
              const wrap = make('label');
              const radio = make('input');
              Object.assign(radio, {type:'radio', name:item.id, value, required:true, checked:answers[item.id] === value});
              radio.addEventListener('change', () => {
                answers[item.id] = value;
                write(key, {ids:questions.map(q => q.id), answers});
              });
              wrap.append(radio, document.createTextNode(label + ' '));
              row.append(wrap);
            }
            form.append(row);
          }
          const submit = make('button','查看行动清单');
          form.append(submit);
          const result = make('div');
          form.addEventListener('submit', event => {
            event.preventDefault();
            const todo = questions.filter(item => answers[item.id] === 'todo').slice(0, 10);
            result.replaceChildren(make('h3', todo.length ? '可以先做的事' : '本次没有待做项'));
            for (const item of todo) { const p = make('p'); p.append(link(item)); result.append(p); }
            if (todo.length) result.append(button('加入我的待做', () => {
              mark(todo,'todo');
              result.append(make('p','已加入待做'));
            }));
            result.scrollIntoView();
          });
          box.append(form,result);
        } catch (error) { box.append(make('p',error.message)); }
      });
    }
  }
})();

(async () => {
  if (location.pathname.replace(/\/$/, '') !== '/bingo') return;
  const main = document.querySelector('main');
  const buttons = [...main.querySelectorAll('button')];
  const cells = buttons.filter(b => b.textContent.includes('点亮这一格')).slice(0, 9);
  if (cells.length !== 9) return;
  const key = 'mx-bingo-v1';
  let data;
  try {
    const response = await fetch('/entries.json');
    if (!response.ok) return;
    data = await response.json();
  } catch { return; }
  let state;
  try { state = JSON.parse(localStorage.getItem(key)); } catch {}
  if (!state || state.length !== 9) {
    state = cells.map((cell, i) => {
      const title = cell.textContent.trim().replace(/^\d{2}/,'').replace(/点亮这一格$/, '').trim();
      return { ...(data.find(item => item.title === title) ?? data[i]), done:false };
    });
  }
  function paint() {
    cells.forEach((b, i) => {
      const item = state[i];
      b.textContent = (i + 1) + '. ' + item.title + (item.done ? ' ✓' : '');
      b.setAttribute('aria-pressed', String(item.done));
      b.style.background = item.done ? '#41644a' : '';
      b.style.color = item.done ? '#fff' : '';
    });
    localStorage.setItem(key, JSON.stringify(state));
  }
  function replace(i) {
    const pool = data.filter(item => !state.some(slot => slot.id === item.id));
    state[i] = {...pool[Math.floor(Math.random() * pool.length)], done:false};
  }
  cells.forEach((b,i) => b.addEventListener('click', () => { state[i].done = !state[i].done; paint(); }));
  buttons.filter(b => b.textContent.trim() === '换一个').slice(0,9)
    .forEach((b,i) => b.addEventListener('click', () => { replace(i); paint(); }));
  for (const b of buttons) {
    const title = b.textContent.trim();
    if (title === '换一组行动') b.addEventListener('click', () => { cells.forEach((_,i) => replace(i)); paint(); });
    if (title === '未完成项加入待做') b.addEventListener('click', () => {
      const key = 'mx-life-marks-v1';
      const marks = JSON.parse(localStorage.getItem(key) || '{}');
      for (const item of state.filter(item => !item.done)) {
        if (marks[item.id]?.status !== 'done') marks[item.id] = {...marks[item.id], ...item, status:'todo'};
      }
      localStorage.setItem(key, JSON.stringify(marks));
      b.textContent = '已加入待做';
    });
    if (title === '生成分享卡') b.addEventListener('click', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 900;
      canvas.height = 1080;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#f1f4eb'; ctx.fillRect(0,0,900,1080);
      ctx.fillStyle = '#24392b'; ctx.font = 'bold 44px sans-serif';
      ctx.fillText('我的零元行动卡',42,85);
      state.forEach((item,i) => {
        const x = 42 + (i%3)*275, y = 135 + Math.floor(i/3)*285;
        ctx.fillStyle = item.done ? '#c7dfbd' : '#fff';
        ctx.fillRect(x,y,255,260);
        ctx.fillStyle = '#24392b'; ctx.font = '22px sans-serif';
        ctx.fillText(String(i+1).padStart(2,'0') + (item.done?'  ✓':''),x+16,y+35);
        let line = '', row = 0;
        for(const char of item.title) {
          if (ctx.measureText(line+char).width>220) {
            ctx.fillText(line,x+16,y+72+row++*29);
            line='';
          }
          if(row>=6) break;
          line+=char;
        }
        if(line) ctx.fillText(line,x+16,y+72+row*29);
      });
      ctx.font='20px sans-serif'; ctx.fillText(location.host,42,1040);
      canvas.toBlob(blob => {
        if (!blob) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = '我的零元行动卡.png';
        a.click(); setTimeout(() => URL.revokeObjectURL(a.href),1000);
      });
    });
  }
  paint();
})();
