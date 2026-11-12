/* Supplementary site: renders tables and charts from data/*.json. No dependencies. */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var MINUS = "−";

  function fmt(x, d) {
    if (x === null || x === undefined || x === "" || isNaN(x)) return "–";
    var s = Number(x).toFixed(d === undefined ? 2 : d);
    return s.charAt(0) === "-" ? MINUS + s.slice(1) : s;
  }
  function sgn(x, d) { var s = fmt(x, d); return (x > 0 ? "+" : "") + s; }
  function ci(v, d) {
    if (!v || v[0] === null) return "–";
    return sgn(v[0], d) + (v[1] === null || v[1] === undefined ? "" : ' <span class="ci">[' + fmt(v[1], d) + ", " + fmt(v[2], d) + "]</span>");
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function getJSON(name) { return fetch("data/" + name, { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error(name); return r.json(); }); }
  function verdictClass(v) { return /^supported(?!, narrowly)/.test(v) ? "ok" : /narrowly|partly/.test(v) ? "part" : "no"; }
  function decimalsFor(unit) { return unit === "share" || unit === "per episode" ? 3 : 2; }

  /* ------------------------------------------------------------------ chrome: theme, jump menu, active section */
  var themeBtn = $("[data-theme-toggle]");
  if (themeBtn) themeBtn.addEventListener("click", function () {
    var root = document.documentElement;
    var cur = root.getAttribute("data-theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    var next = cur === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("site-theme", next); } catch (e) { /* storage unavailable */ }
  });
  var jump = $("[data-jump]");
  if (jump) jump.addEventListener("change", function () { location.hash = jump.value; });
  var links = $$(".rail nav a");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (a) { a.classList.toggle("active", a.getAttribute("href") === "#" + e.target.id); });
      });
    }, { rootMargin: "-20% 0px -70% 0px" });
    $$("section.sec").forEach(function (s) { io.observe(s); });
  }

  /* ------------------------------------------------------------------ top-down video tabs */
  $$('[data-tabs="topdown"] .tab').forEach(function (b) {
    b.addEventListener("click", function () {
      $$('[data-tabs="topdown"] .tab').forEach(function (x) { x.setAttribute("aria-selected", x === b ? "true" : "false"); });
      var v = $("#topdown-video"), src = b.getAttribute("data-src");
      v.pause();
      v.setAttribute("poster", "assets/video/" + src + ".jpg");
      v.querySelector("source").setAttribute("src", "assets/video/" + src + ".mp4");
      v.load();
    });
  });

  /* ------------------------------------------------------------------ six-agent replay tabs (chase / top-down view) */
  $$('[data-tabs="six"] .tab').forEach(function (b) {
    b.addEventListener("click", function () {
      $$('[data-tabs="six"] .tab').forEach(function (x) { x.setAttribute("aria-selected", x === b ? "true" : "false"); });
      var v = $("#six-video"), src = b.getAttribute("data-src");
      v.pause();
      v.setAttribute("poster", "assets/video/" + src + ".jpg");
      v.querySelector("source").setAttribute("src", "assets/video/" + src + ".mp4");
      v.load();
    });
  });

  /* ------------------------------------------------------------------ open a folded block when a link points into it */
  function openTarget() {
    var id = location.hash.slice(1), el = id && document.getElementById(id);
    while (el) { if (el.tagName === "DETAILS") el.open = true; el = el.parentElement; }
  }
  window.addEventListener("hashchange", openTarget);
  openTarget();

  /* ------------------------------------------------------------------ registered hypotheses */
  getJSON("hypotheses.json").then(function (h) {
    var rows = h.grid.map(function (r) {
      var d = decimalsFor(r.unit);
      return "<tr><td><b>" + r.id + "</b></td><td>" + esc(r.label) + ' <span class="muted small">(' + esc(r.unit) + ")</span></td><td>" +
        esc(r.prediction.replace("-", MINUS)) + '</td><td class="n">' + ci(r.q01.pooled, d) + '</td><td class="n">' + ci(r.q01.S0, d) +
        '</td><td class="n">' + ci(r.q01.S1, d) + '</td><td class="n">' + ci(r.r01.pooled, d) + '</td><td><span class="verdict ' +
        verdictClass(r.verdict) + '">' + esc(r.verdict) + "</span></td></tr>";
    });
    $("#hyp-table tbody").innerHTML = rows.join("");
    var c = h.checks.Q01;
    $("#checks-line").innerHTML = "Run checks (Q01): " + h.checks.n_episodes.Q01 + " of 960 episodes complete; " + c.standstill_runs +
      " standstills; " + c.contact_runs + " runs with body contact (polygon test); minimum gap " + fmt(c.min_gap_m, 3) + " m; " +
      c.runs_using_pass_rule + " runs used the stopped-car pass rule.";
    var g = h.generator_v5;
    var v5 = [
      ["H1", g.H1.label, g.H1.verdict, "People held or slowed, means: calibrated " + fmt(g.H1.means.S0, 1) + ", LLM " + fmt(g.H1.means.S1, 1) +
        ", uniform " + fmt(g.H1.means.S2, 1) + " person·s; LLM − calibrated [" + fmt(g.H1.ci_S1_minus_S0[0], 1) + ", " + fmt(g.H1.ci_S1_minus_S0[1], 1) + "]"],
      ["H2", g.H2.label, g.H2.verdict, "Assertive − courteous gap in people's cost: calibrated " + fmt(g.H2.mean_gap.S0, 1) + ", LLM " +
        fmt(g.H2.mean_gap.S1, 1) + ", uniform " + fmt(g.H2.mean_gap.S2, 1) + " person·s"],
      ["H3", g.H3.label, g.H3.verdict, Object.keys(g.H3.by_brief).map(function (b) {
        var x = g.H3.by_brief[b]; return b + ": LLM " + fmt(x.S1, 2) + " vs uniform " + fmt(x.S2, 2);
      }).join("; ")]
    ];
    $("#v5-table tbody").innerHTML = v5.map(function (r) {
      return "<tr><td><b>" + r[0] + "</b></td><td>" + esc(r[1]) + '</td><td><span class="verdict ' + verdictClass(r[2]) + '">' + esc(r[2]) +
        '</span></td><td class="small">' + esc(r[3]) + "</td></tr>";
    }).join("");
  }).catch(function (e) { $("#hyp-table tbody").innerHTML = '<tr><td colspan="8">Could not load data (' + esc(e.message) + "). Serve the folder over HTTP.</td></tr>"; });

  /* ------------------------------------------------------------------ condition explorer */
  var METRICS = {
    person_held_slowed_s: ["People held or slowed", "person·s per episode", 1],
    vehicle_stationary_s: ["Vehicles standing", "vehicle·s per episode", 1],
    close_passes: ["Close passes, all vehicles", "per episode", 2],
    lead_close_passes: ["Close passes, lead car", "per episode", 2],
    follower_close_passes: ["Close passes, followers", "per episode", 2],
    person_first_share: ["Encounters the person wins", "share (no interval)", 3],
    cars_full_turn_by_green: ["Cars through by the end of the green", "of 3", 2],
    crossed_by_green_share: ["People across by the end of the green", "share", 3],
    lead_clear_t: ["Lead car clears the zebra", "s after start", 1],
    person_delay_mean_s: ["Mean delay per person", "s", 2]
  };
  var PCOL = { P1: "var(--people)", P2: "var(--vehicles)", P3: "var(--teal)" };
  var PNAME = { P1: "reactive", P2: "gap acceptance", P3: "courteous" };
  function niceTicks(lo, hi, n) {
    var span = hi - lo || 1, step = Math.pow(10, Math.floor(Math.log10(span / n))), err = span / n / step;
    step *= err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1;
    var t = [], v = Math.ceil(lo / step) * step;
    for (; v <= hi + 1e-9; v += step) t.push(+v.toFixed(10));
    return t;
  }
  var cellsData = null;
  function drawExplorer() {
    if (!cellsData) return;
    var m = $("#ex-metric").value, src = $("#ex-source").value, fol = $("#ex-follower").value, grid = $("#ex-grid").value;
    var meta = METRICS[m], pts = [];
    ["P1", "P2", "P3"].forEach(function (p, i) {
      ["concurrent", "lpi"].forEach(function (s, j) {
        var c = cellsData[grid][src + "|" + p + "|" + fol + "|" + s];
        if (!c || !c[m]) return;
        pts.push({ p: p, s: s, x: i, j: j, v: c[m][0], lo: c[m][1], hi: c[m][2] });
      });
    });
    var W = 720, H = 300, L = 64, R = 16, T = 18, B = 46;
    var lo = Math.min.apply(null, pts.map(function (d) { return d.lo === null ? d.v : d.lo; }));
    var hi = Math.max.apply(null, pts.map(function (d) { return d.hi === null ? d.v : d.hi; }));
    lo = Math.min(0, lo); hi = hi + (hi - lo) * 0.08;
    var ticks = niceTicks(lo, hi, 5);
    var y = function (v) { return T + (H - T - B) * (1 - (v - lo) / (hi - lo)); };
    var gw = (W - L - R) / 3, x = function (d) { return L + gw * (d.x + 0.5) + (d.j ? 22 : -22); };
    var s = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + esc(meta[0]) + ' by lead planner and signal program">';
    ticks.forEach(function (t) {
      s += '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(t) + '" y2="' + y(t) + '"/>' +
        '<text x="' + (L - 8) + '" y="' + (y(t) + 4) + '" text-anchor="end">' + fmt(t, Math.abs(t) < 1 && t !== 0 ? 2 : 0) + "</text>";
    });
    s += '<text x="14" y="' + (T + (H - T - B) / 2) + '" transform="rotate(-90 14 ' + (T + (H - T - B) / 2) + ')" text-anchor="middle">' + esc(meta[1]) + "</text>";
    ["P1", "P2", "P3"].forEach(function (p, i) {
      s += '<text x="' + (L + gw * (i + 0.5)) + '" y="' + (H - B + 22) + '" text-anchor="middle" style="fill:' + PCOL[p] + ';font-weight:600">' + PNAME[p] + " lead</text>";
    });
    pts.forEach(function (d) {
      var cx = x(d), col = PCOL[d.p];
      if (d.lo !== null) s += '<line x1="' + cx + '" x2="' + cx + '" y1="' + y(d.lo) + '" y2="' + y(d.hi) + '" style="stroke:' + col + ';stroke-width:2"/>';
      s += '<circle cx="' + cx + '" cy="' + y(d.v) + '" r="6" style="stroke:' + col + ";stroke-width:2;fill:" + (d.j ? "var(--card)" : col) + '">' +
        "<title>" + PNAME[d.p] + ", " + (d.j ? "head start" : "shared green") + ": " + fmt(d.v, meta[2]) + (d.lo !== null ? " [" + fmt(d.lo, meta[2]) + ", " + fmt(d.hi, meta[2]) + "]" : "") + "</title></circle>" +
        '<text x="' + (cx + (d.j ? 10 : -10)) + '" y="' + (y(d.v) + 4) + '" text-anchor="' + (d.j ? "start" : "end") + '" style="font-size:11px">' + fmt(d.v, meta[2]) + "</text>";
    });
    s += "</svg>";
    $("#ex-chart").innerHTML = s + '<p class="chart-note">' + esc(meta[0]) + ", " + (src === "pooled" ? "all 80 scenarios" : src === "S0" ? "40 calibrated scenarios" : "40 LLM-written scenarios") +
      ", " + fol.toUpperCase() + " followers, grid " + grid + (grid === "R01" ? " (head-start runs equal their shared-green twins)" : "") + ".</p>";
  }
  getJSON("cells.json").then(function (c) {
    cellsData = c;
    var sel = $("#ex-metric");
    sel.innerHTML = Object.keys(METRICS).map(function (k) { return '<option value="' + k + '">' + esc(METRICS[k][0]) + "</option>"; }).join("");
    ["#ex-metric", "#ex-source", "#ex-follower", "#ex-grid"].forEach(function (id) { $(id).addEventListener("change", drawExplorer); });
    drawExplorer();
  }).catch(function () {});

  /* ------------------------------------------------------------------ per-vehicle table */
  getJSON("micro.json").then(function (m) {
    var rows = [];
    ["lead", "follower"].forEach(function (role) {
      ["P1", "P2", "P3"].forEach(function (p) {
        ["concurrent", "lpi"].forEach(function (s) {
          var v = m.per_vehicle[role + "|" + p + "|" + s];
          if (!v) return;
          rows.push("<tr><td>" + (role === "lead" ? "lead car" : "each follower") + "</td><td>" + PNAME[p] + "</td><td>" + (s === "lpi" ? "head start" : "shared green") +
            '</td><td class="n">' + fmt(v.close[0], 2) + ' <span class="ci">[' + fmt(v.close[1], 2) + ", " + fmt(v.close[2], 2) + ']</span></td><td class="n">' +
            fmt(100 * v.passed, 1) + "%</td></tr>");
        });
      });
    });
    $("#pv-table tbody").innerHTML = rows.join("");
  }).catch(function () {});

  /* ------------------------------------------------------------------ episodes (shared by scenario list and browser) */
  var EP = null, scen = null;
  Promise.all([getJSON("episodes.json"), getJSON("scenarios.json")]).then(function (res) {
    EP = res[0]; scen = res[1];
    buildBriefs(); buildScenarioList(); buildEpisodeBrowser();
  }).catch(function () {});

  function col(name) { return EP.cols.indexOf(name); }
  function scenarioOutcomes() {
    var out = {}, iS = col("scenario"), iP = col("planner"), iF = col("follower"), iG = col("signal"), iJ = col("person_held_slowed_s"), iV = col("vehicle_stationary_s"), iC = col("close_passes");
    EP.rows.forEach(function (r) {
      var o = out[r[iS]] || (out[r[iS]] = {});
      o[r[iP] + "|" + r[iF] + "|" + r[iG]] = [r[iJ], r[iV], r[iC]];
    });
    Object.keys(out).forEach(function (k) {
      var o = out[k], dp = 0, dv = 0, n = 0;
      ["idm", "gipps"].forEach(function (f) { ["concurrent", "lpi"].forEach(function (s) {
        var a = o["P1|" + f + "|" + s], b = o["P3|" + f + "|" + s];
        if (a && b) { dp += b[0] - a[0]; dv += b[1] - a[1]; n++; }
      }); });
      o.dp = n ? dp / n : null; o.dv = n ? dv / n : null;
    });
    return out;
  }
  function buildBriefs() {
    var b = scen.briefs;
    $("#brief-table tbody").innerHTML = Object.keys(b).map(function (k) {
      return "<tr><td><b>" + k + "</b></td><td>" + esc(b[k].name) + '</td><td class="small">' + esc(b[k].text) + "</td></tr>";
    }).join("");
    $("#sc-brief").innerHTML = '<option value="">all</option>' + Object.keys(b).map(function (k) { return '<option value="' + k + '">' + k + " · " + esc(b[k].name) + "</option>"; }).join("");
  }
  function crosserSummary(s) {
    var n = {};
    s.crossers.forEach(function (c) { n[c.kind] = (n[c.kind] || 0) + 1; });
    var parts = Object.keys(n).map(function (k) { return n[k] + " " + k + (n[k] > 1 ? "s" : ""); });
    if (s.moto) parts.push("motorcycle");
    return parts.join(", ");
  }
  function buildScenarioList() {
    var outc = scenarioOutcomes();
    function render() {
      var src = $("#sc-source").value, br = $("#sc-brief").value, sort = $("#sc-sort").value;
      var list = scen.scenarios.filter(function (s) { return (!src || s.source === src) && (!br || s.brief === br); });
      list.sort(function (a, b) {
        if (sort === "id") return a.id < b.id ? -1 : 1;
        var ka = outc[a.id] ? outc[a.id][sort] : 0, kb = outc[b.id] ? outc[b.id][sort] : 0;
        return sort === "dp" ? ka - kb : kb - ka;
      });
      $("#sc-list").innerHTML = list.map(function (s) {
        var o = outc[s.id] || {};
        var rel = s.crossers.map(function (c) { return c.release_s; }).filter(function (x) { return x !== null; });
        var head = "<summary><span class=\"mono\">" + s.id + '</span><span><span class="pill ' + (s.source === "S1" ? "s1" : "") + '">' + (s.source === "S1" ? s.brief : "calib.") +
          "</span></span><span>" + esc(crosserSummary(s)) + ' <span class="muted hide-sm">· released ' + fmt(Math.min.apply(null, rel), 0) + "–" + fmt(Math.max.apply(null, rel), 0) + ' s</span></span>' +
          '<span class="mono hide-sm" title="courteous − reactive, mean over follower law and signal">' + sgn(o.dp, 1) + " / " + sgn(o.dv, 1) + "</span></summary>";
        var cr = '<div class="table-wrap"><table><thead><tr><th>Crosser</th><th>Kind</th><th class="n">Release (s)</th><th class="n">Speed (m/s)</th><th class="n">Gap needed (s)</th><th>Style</th><th>Starts on flashing</th></tr></thead><tbody>' +
          s.crossers.map(function (c) {
            return "<tr><td>" + esc(c.id) + "</td><td>" + esc(c.kind) + '</td><td class="n">' + fmt(c.release_s, 1) + '</td><td class="n">' + fmt(c.desired_mps, 2) + '</td><td class="n">' + fmt(c.gap_s, 1) +
              "</td><td>" + esc(c.style || "–") + "</td><td>" + (c.starts_on_flashing ? "yes" : "no") + "</td></tr>";
          }).join("") + "</tbody></table></div>";
        var mo = s.moto ? '<p class="small">Delivery motorcycle: released at ' + fmt(s.moto.release_s, 1) + " s, " + fmt(s.moto.desired_mps, 1) + " m/s, style " + esc(s.moto.style || "–") + ".</p>" : '<p class="small muted">No motorcycle.</p>';
        var res = '<div class="table-wrap"><table><thead><tr><th>Lead (IDM followers)</th><th class="n">People held/slowed, conc.</th><th class="n">LPI</th><th class="n">Vehicles standing, conc.</th><th class="n">LPI</th><th class="n">Close passes, conc.</th><th class="n">LPI</th></tr></thead><tbody>' +
          ["P1", "P2", "P3"].map(function (p) {
            var a = o[p + "|idm|concurrent"] || [], b = o[p + "|idm|lpi"] || [];
            return "<tr><td>" + PNAME[p] + '</td><td class="n">' + fmt(a[0], 1) + '</td><td class="n">' + fmt(b[0], 1) + '</td><td class="n">' + fmt(a[1], 1) + '</td><td class="n">' + fmt(b[1], 1) +
              '</td><td class="n">' + fmt(a[2], 0) + '</td><td class="n">' + fmt(b[2], 0) + "</td></tr>";
          }).join("") + "</tbody></table></div>";
        return '<details class="scn">' + head + '<div class="scn-body">' + cr + mo + '<p class="small">Walkers released within 3 s of the walk onset: ' + fmt(s.walkers_at_onset, 0) + ".</p>" + res +
          '<p class="small muted mono" style="overflow-wrap:anywhere">sha256 ' + s.sha256 + "</p></div></details>";
      }).join("") || '<p class="muted" style="padding:10px">No scenarios match.</p>';
    }
    ["#sc-source", "#sc-brief", "#sc-sort"].forEach(function (id) { $(id).addEventListener("change", render); });
    render();
  }

  function buildEpisodeBrowser() {
    var show = [["scenario", "Scenario"], ["planner", "Lead"], ["follower", "Followers"], ["signal", "Signal"], ["person_held_slowed_s", "People held/slowed (person·s)"],
      ["vehicle_stationary_s", "Vehicles standing (vehicle·s)"], ["close_passes", "Close passes"], ["lead_close_passes", "Lead"], ["follower_close_passes", "Followers"],
      ["encounters", "Encounters"], ["person_first", "Person first"], ["min_gap_m", "Min gap (m)"]];
    var idx = show.map(function (s) { return col(s[0]); });
    var state = { page: 0, key: 0, dir: 1 }, per = 20;
    $("#ep-table thead").innerHTML = "<tr>" + show.map(function (s, i) {
      return '<th class="sortable' + (i > 3 ? " n" : "") + '" data-k="' + i + '" scope="col">' + esc(s[1]) + "</th>";
    }).join("") + "</tr>";
    $$("#ep-table th").forEach(function (th) {
      th.addEventListener("click", function () {
        var k = +th.getAttribute("data-k");
        state.dir = state.key === k ? -state.dir : 1; state.key = k; state.page = 0;
        $$("#ep-table th").forEach(function (x) { x.removeAttribute("aria-sort"); });
        th.setAttribute("aria-sort", state.dir > 0 ? "ascending" : "descending");
        render();
      });
    });
    function render() {
      var q = $("#ep-q").value.trim().toUpperCase(), fp = $("#ep-planner").value, ff = $("#ep-follower").value, fs = $("#ep-signal").value;
      var rows = EP.rows.filter(function (r) {
        return (!q || r[col("scenario")].toUpperCase().indexOf(q) >= 0) && (!fp || r[col("planner")] === fp) && (!ff || r[col("follower")] === ff) && (!fs || r[col("signal")] === fs);
      });
      var ki = idx[state.key];
      rows.sort(function (a, b) { return (a[ki] < b[ki] ? -1 : a[ki] > b[ki] ? 1 : 0) * state.dir; });
      var pages = Math.max(1, Math.ceil(rows.length / per));
      state.page = Math.min(state.page, pages - 1);
      $("#ep-table tbody").innerHTML = rows.slice(state.page * per, state.page * per + per).map(function (r) {
        return "<tr>" + idx.map(function (i, j) {
          var v = r[i];
          return j > 3 ? '<td class="n">' + (typeof v === "number" ? fmt(v, Number.isInteger(v) ? 0 : 2) : esc(v)) + "</td>" : "<td>" + esc(v) + "</td>";
        }).join("") + "</tr>";
      }).join("");
      $("#ep-pager").innerHTML = '<button type="button" data-p="-1"' + (state.page ? "" : " disabled") + ">Previous</button><span>" + (state.page + 1) + " / " + pages + " · " + rows.length +
        ' episodes</span><button type="button" data-p="1"' + (state.page < pages - 1 ? "" : " disabled") + ">Next</button>";
      $$("#ep-pager button").forEach(function (b) { b.addEventListener("click", function () { state.page += +b.getAttribute("data-p"); render(); }); });
    }
    ["#ep-q", "#ep-planner", "#ep-follower", "#ep-signal"].forEach(function (id) {
      $(id).addEventListener(id === "#ep-q" ? "input" : "change", function () { state.page = 0; render(); });
    });
    render();
  }

  /* ------------------------------------------------------------------ protocol and integrity */
  getJSON("report_index.json").then(function (docs) {
    $("#doc-table tbody").innerHTML = docs.map(function (d) {
      return '<tr><td><a href="report/' + d.slug + '.html">' + esc(d.title) + '</a></td><td class="mono small" style="overflow-wrap:anywhere">' + d.sha256 + "</td></tr>";
    }).join("");
  }).catch(function () {});
  getJSON("integrity.json").then(function (g) {
    $("#freeze-table tbody").innerHTML = g.freezes.map(function (f) {
      return "<tr><td>" + esc(f.name.replace("REGISTRATION_FREEZE_", "freeze ").replace(".json", "")) + (f.amendment ? ' <span class="muted small">(' + esc(f.amendment) + ")</span>" : "") +
        '</td><td class="n">' + f.files + '</td><td class="n">' + (f.episodes || "–") + "</td><td>" + esc(f.frozen_at || "–") + '</td><td class="mono small" style="overflow-wrap:anywhere">' + f.sha256.slice(0, 16) + "…</td></tr>";
    }).join("");
    $("#gate-table tbody").innerHTML = Object.keys(g.gates).map(function (k) {
      var v = g.gates[k];
      return "<tr><td>" + esc(k.replace("GATES_", "gates ")) + '</td><td class="small">' + Object.keys(v).map(function (x) { return "<b>" + esc(x) + "</b> " + esc(v[x]); }).join(" · ") + "</td></tr>";
    }).join("");
  }).catch(function () {});

  /* ------------------------------------------------------------------ amendment T status */
  getJSON("amendment_t.json").then(function (t) {
    var box = $("#t-status");
    if (t.status !== "complete") {
      var pct = Math.round(100 * t.episodes_complete / t.episodes_total);
      box.innerHTML = "<h4>Status: running</h4><p>" + t.episodes_complete + " of " + t.episodes_total + " runs complete at the last site update (" + pct + '%).</p><div class="progress"><div style="width:' + pct +
        '%"></div></div><p class="small">Baseline C0 from the primary grid: the lead car meets nobody in 9 of 40 scenarios; 25 of 40 separate the planners (span over 1 person·s); the lead car makes 23% of close passes [16%, 32%]. C1 and T1 results appear here when the grid completes.</p>';
      return;
    }
    var s = t.summary;
    box.className = "callout";
    var arms = ["C0", "C1", "T1"].map(function (a) {
      var x = s[a];
      return "<tr><td><b>" + a + '</b></td><td class="n">' + x.miss + '</td><td class="n">' + x.separating + '</td><td class="n">' + fmt(x.span_median_ps, 2) + '</td><td class="n">' + fmt(x.lead_share, 3) +
        ' <span class="ci">[' + fmt(x.lead_share_ci95[0], 3) + ", " + fmt(x.lead_share_ci95[1], 3) + ']</span></td><td class="n">' + x.brief_realised + "/" + x.brief_checkable + "</td></tr>";
    }).join("");
    function fis(h) { return "odds ratio " + fmt(h.odds_ratio, 2) + ", p = " + fmt(h.p, 2) + " (" + (h.alternative === "two-sided" ? "two-sided" : "one-sided") + ")"; }
    function verdict(h) { return h.p < 0.05 ? ": supported" : ": not supported"; }
    box.innerHTML = '<h4>Results (registered)</h4><div class="table-wrap"><table><thead><tr><th>Arm</th><th class="n">Lead meets nobody</th><th class="n">Separating</th><th class="n">Median span (person·s)</th><th class="n">Lead share of close passes</th><th class="n">Brief realised</th></tr></thead><tbody>' + arms +
      "</tbody></table></div><ul class=\"small\"><li><b>H9</b> fewer misses, T1 vs C1: " + fis(s.H9_miss_T1_lt_C1) + verdict(s.H9_miss_T1_lt_C1) + "</li><li><b>H10</b> more separating, T1 vs C1: " + fis(s.H10_separating_T1_gt_C1) + verdict(s.H10_separating_T1_gt_C1) +
      "</li><li><b>H11</b> lead share, T1 − C1: " + sgn(s.H11_lead_share_T1_gt_C1.diff, 3) + ", one-sided lower 95% bound " + fmt(s.H11_lead_share_T1_gt_C1.lower95_one_sided, 3) + (s.H11_lead_share_T1_gt_C1.supported ? ": supported" : ": not supported") +
      "</li><li><b>H12</b> C1 vs C0: misses " + fis(s.H12_C1_vs_C0.miss) + "; separating " + fis(s.H12_C1_vs_C0.separating) + "; lead share " + sgn(s.H12_C1_vs_C0.lead_share.diff, 3) + " [" + fmt(s.H12_C1_vs_C0.lead_share.ci95[0], 3) + ", " + fmt(s.H12_C1_vs_C0.lead_share.ci95[1], 3) + "]</li><li>Standstills C0 / C1 / T1: " + s.C0.standstills + " / " + s.C1.standstills + " / " + s.T1.standstills +
      "; runs with a body contact: " + s.C0.contact_runs + " / " + s.C1.contact_runs + " / " + s.T1.contact_runs + "</li></ul>";
  }).catch(function () {});
})();
