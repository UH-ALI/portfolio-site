// Progressive enhancement only: the page reads fine without this file.
(function () {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  /* ---------- reveal on scroll ---------- */
  const revealEls = document.querySelectorAll('.reveal');
  if (!reduce && 'IntersectionObserver' in window) {
    document.documentElement.classList.add('js-reveal');
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.15 });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('in'));
  }

  /* ---------- STRUGGLER: BFS validator demo ---------- */
  const canvas = document.getElementById('bfsCanvas');
  if (canvas) {
    const COLS = 16, ROWS = 9;
    const ctx = canvas.getContext('2d');
    const log = document.getElementById('bfsLog');
    const btn = document.getElementById('bfsBtn');
    const start = [0, 4], exit = [COLS - 1, 4];
    let grid = [], state = {}, timer = null;

    function size() {
      const w = canvas.clientWidth || 560;
      const h = Math.round(w * ROWS / COLS);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    }
    const key = (x, y) => y * COLS + x;
    const nbrs = (x, y) => [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]
      .filter(([a, b]) => a >= 0 && b >= 0 && a < COLS && b < ROWS);

    function generate() {
      grid = [];
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) grid.push(Math.random() < 0.36 ? 1 : 0);
      grid[key(...start)] = 0; grid[key(...exit)] = 0;
      state = { visited: new Map(), path: [], repaired: [] };
    }

    function bfs() {
      const order = [], prev = new Map(), seen = new Set([key(...start)]);
      let frontier = [start], depth = 0, found = false;
      while (frontier.length && !found) {
        const next = [];
        for (const [x, y] of frontier) {
          order.push([key(x, y), depth]);
          if (x === exit[0] && y === exit[1]) { found = true; break; }
          for (const [a, b] of nbrs(x, y)) {
            const k = key(a, b);
            if (!seen.has(k) && !grid[k]) { seen.add(k); prev.set(k, key(x, y)); next.push([a, b]); }
          }
        }
        frontier = next; depth++;
      }
      const path = [];
      if (found) { let k = key(...exit); while (k !== undefined) { path.unshift(k); k = prev.get(k); } }
      return { order, found, path };
    }

    // 0-1 BFS: cheapest route where walking through a wall costs 1. Those walls get removed.
    function repairWalls() {
      const dist = new Array(COLS * ROWS).fill(Infinity), prev = new Map();
      const dq = [start]; dist[key(...start)] = 0;
      while (dq.length) {
        const [x, y] = dq.shift(), d = dist[key(x, y)];
        for (const [a, b] of nbrs(x, y)) {
          const k = key(a, b), w = grid[k];
          if (d + w < dist[k]) { dist[k] = d + w; prev.set(k, key(x, y)); w ? dq.push([a, b]) : dq.unshift([a, b]); }
        }
      }
      const walls = []; let k = key(...exit);
      while (k !== undefined) { if (grid[k]) walls.push(k); k = prev.get(k); }
      return walls;
    }

    function draw() {
      const w = canvas.clientWidth || 560, cell = w / COLS;
      ctx.clearRect(0, 0, w, cell * ROWS);
      const cFloor = css('--panel'), cWall = css('--ink'), cSeen = css('--accent-soft'),
            cPath = css('--accent'), cFix = css('--warn'), cRule = css('--rule');
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
        const k = key(x, y);
        let c = cFloor;
        if (grid[k]) c = cWall;
        else if (state.path && state.path.includes(k)) c = cPath;
        else if (state.repaired && state.repaired.includes(k)) c = cFix;
        else if (state.visited && state.visited.has(k)) c = cSeen;
        ctx.fillStyle = c;
        ctx.fillRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2);
      }
      ctx.strokeStyle = cRule;
      ctx.font = `600 ${Math.max(10, cell * 0.38)}px "IBM Plex Mono", monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      [[start, 'S'], [exit, 'E']].forEach(([[x, y], t]) => {
        ctx.fillStyle = cWall;
        ctx.fillText(t, x * cell + cell / 2, y * cell + cell / 2 + 1);
      });
    }

    function animate(order, done) {
      if (reduce) { order.forEach(([k]) => state.visited.set(k, 1)); draw(); done(); return; }
      let i = 0;
      const maxDepth = order.length ? order[order.length - 1][1] : 0;
      let depth = 0;
      timer = setInterval(() => {
        while (i < order.length && order[i][1] <= depth) { state.visited.set(order[i][0], 1); i++; }
        draw(); depth++;
        if (depth > maxDepth) { clearInterval(timer); timer = null; done(); }
      }, 45);
    }

    function run() {
      if (timer) { clearInterval(timer); timer = null; }
      generate(); draw();
      log.textContent = 'Searching from S for a way to E…';
      const first = bfs();
      animate(first.order, () => {
        if (first.found) {
          state.path = first.path; draw();
          log.textContent = `Playable. Shortest route: ${first.path.length - 1} steps. The level can load.`;
          return;
        }
        const walls = repairWalls();
        log.textContent = `No way through. Removing ${walls.length} block${walls.length === 1 ? '' : 's'} (orange) and checking again…`;
        setTimeout(() => {
          walls.forEach((k) => { grid[k] = 0; });
          state = { visited: new Map(), path: [], repaired: walls };
          draw();
          const second = bfs();
          animate(second.order, () => {
            state.path = second.path; draw();
            log.textContent = `Repaired by removing ${walls.length} block${walls.length === 1 ? '' : 's'}. Now playable in ${second.path.length - 1} steps.`;
          });
        }, reduce ? 0 : 700);
      });
    }

    btn.addEventListener('click', run);
    window.addEventListener('resize', size);
    generate(); size();
  }

  /* ---------- AQI: leakage before / after ---------- */
  const leak = document.getElementById('leak');
  if (leak) {
    const hours = leak.querySelector('.hours');
    const cap = document.getElementById('leakCap');
    const labels = ['t−6', 't−5', 't−4', 't−3', 't−2', 't−1', 't', 't+1'];
    labels.forEach((l) => {
      const d = document.createElement('div');
      d.className = 'hr' + (l === 't' ? ' target' : '');
      d.innerHTML = `<span>${l}</span>`;
      hours.appendChild(d);
    });
    const cells = hours.querySelectorAll('.hr');
    const modes = {
      before: { from: 3, to: 6, text: 'Before: the 4-hour rolling average ended at hour t, the hour being predicted. The feature already contained the answer.' },
      after: { from: 2, to: 5, text: 'After: the window ends at t−1. The model only sees hours that would really have happened before t.' }
    };
    function set(mode) {
      const m = modes[mode];
      cells.forEach((c, i) => {
        c.classList.toggle('win', i >= m.from && i <= m.to);
        c.classList.toggle('bad', mode === 'before' && i === 6);
      });
      cap.textContent = m.text;
      leak.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
    }
    leak.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => set(b.dataset.mode)));
    set('before');
  }

  /* ---------- RepRush: hysteresis illustration ---------- */
  const rep = document.getElementById('repChart');
  if (rep) {
    const W = 560, H = 190, padL = 38, padR = 10, padT = 12, padB = 22;
    const y = (deg) => padT + (180 - deg) / (180 - 50) * (H - padT - padB);
    // angle keyframes [time, degrees]: three full reps and one shallow dip
    const keys = [[0, 172], [8, 170], [18, 72], [28, 168], [36, 171], [46, 75], [56, 166], [62, 170],
                  [70, 118], [78, 165], [84, 170], [94, 70], [104, 169], [112, 171]];
    const T = 112, x = (t) => padL + t / T * (W - padL - padR);
    const pts = [];
    for (let t = 0; t <= T; t += 0.5) {
      let i = 0; while (keys[i + 1][0] < t) i++;
      const [t0, a0] = keys[i], [t1, a1] = keys[i + 1];
      const u = (t - t0) / (t1 - t0), s = (1 - Math.cos(Math.PI * u)) / 2;
      const noise = Math.sin(t * 2.3) * 1.6 + Math.sin(t * 5.1) * 0.9;
      pts.push([t, a0 + (a1 - a0) * s + noise]);
    }
    let down = false, n = 0; const marks = [];
    pts.forEach(([t, a]) => { if (!down && a < 90) down = true; else if (down && a > 160) { down = false; n++; marks.push([t, a, n]); } });
    const path = pts.map(([t, a], i) => `${i ? 'L' : 'M'}${x(t).toFixed(1)},${y(a).toFixed(1)}`).join('');
    rep.innerHTML = `
      <line class="th" x1="${padL}" x2="${W - padR}" y1="${y(160)}" y2="${y(160)}"/>
      <line class="th" x1="${padL}" x2="${W - padR}" y1="${y(90)}" y2="${y(90)}"/>
      <text class="ax" x="${padL - 6}" y="${y(160) + 4}" text-anchor="end">160°</text>
      <text class="ax" x="${padL - 6}" y="${y(90) + 4}" text-anchor="end">90°</text>
      <text class="ax" x="${x(74)}" y="${y(118) + 26}" text-anchor="middle">shallow dip: not counted</text>
      <path class="trace" d="${path}"/>
      ${marks.map(([t, a, k]) => `<circle class="mk" cx="${x(t)}" cy="${y(a)}" r="4"/><text class="ax strong" x="${x(t)}" y="${y(a) - 9}" text-anchor="middle">rep ${k}</text>`).join('')}
      <text class="ax" x="${padL}" y="${H - 4}">elbow angle over time (illustration)</text>`;
  }
})();
