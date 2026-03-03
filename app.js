(() => {
  // ---- Supabase 設定 ----
  const SUPABASE_URL = "https://cetcrkpvaajhlcqzsdlc.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNldGNya3B2YWFqaGxjcXpzZGxjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1MTg5NjIsImV4cCI6MjA4ODA5NDk2Mn0.409gPMwaibFureIG1JCYppL5e_h4m--0boOIeaB5MZU";
  const LAST_KEY = "vacuumEventLastReservation_v1";
  const SLOT_TIMES = [12, 13, 14, 15, 16, 17];
  const SLOT_CAPACITY = 3;

  const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // ---- ローカルストレージ（サンクスページ表示用のみ） ----

  function getLastReservation() {
    try {
      const raw = window.localStorage.getItem(LAST_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && Number.isFinite(Number(parsed.slot_time)) ? parsed : null;
    } catch {
      return null;
    }
  }

  function setLastReservation(item) {
    window.localStorage.setItem(LAST_KEY, JSON.stringify(item));
  }

  // ---- ユーティリティ ----

  function slotLabel(hour) {
    return `${String(hour).padStart(2, "0")}:00`;
  }

  function setText(selector, value) {
    const element = document.querySelector(selector);
    if (element) element.textContent = value;
  }

  // ---- モバイルメニュー ----

  function initMobileMenu() {
    const topbars = document.querySelectorAll(".topbar");
    if (!topbars.length) return;

    const mobileQuery = window.matchMedia("(max-width: 640px)");

    topbars.forEach((topbar, index) => {
      const button = topbar.querySelector("[data-menu-toggle]");
      const nav = topbar.querySelector(".topnav");
      if (!button || !nav) return;

      if (!nav.id) nav.id = `site-nav-${index + 1}`;

      topbar.setAttribute("data-menu-open", "false");
      button.setAttribute("aria-controls", nav.id);

      const setOpen = (open) => {
        topbar.setAttribute("data-menu-open", open ? "true" : "false");
        button.setAttribute("aria-expanded", open ? "true" : "false");
        button.setAttribute(
          "aria-label",
          open ? "メニューを閉じる" : "メニューを開く"
        );
      };

      button.addEventListener("click", () => {
        const isOpen = topbar.getAttribute("data-menu-open") === "true";
        setOpen(!isOpen);
      });

      nav.querySelectorAll("a").forEach((link) => {
        link.addEventListener("click", () => {
          if (mobileQuery.matches) setOpen(false);
        });
      });

      mobileQuery.addEventListener("change", (event) => {
        if (!event.matches) setOpen(false);
      });

      setOpen(false);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      topbars.forEach((topbar) => {
        const button = topbar.querySelector("[data-menu-toggle]");
        if (!button) return;
        topbar.setAttribute("data-menu-open", "false");
        button.setAttribute("aria-expanded", "false");
        button.setAttribute("aria-label", "メニューを開く");
      });
    });
  }

  // ---- Supabase: スロットデータ取得 ----

  async function getSlotSummary() {
    const { data, error } = await db
      .from("slots")
      .select("slot_time, capacity, reserved_count")
      .order("slot_time");

    if (error) {
      console.error("slots fetch error:", error.message);
      return SLOT_TIMES.map((slotTime) => ({
        slotTime,
        reserved: 0,
        remaining: SLOT_CAPACITY,
        full: false,
      }));
    }

    const map = {};
    (data || []).forEach((row) => {
      map[row.slot_time] = {
        reserved: row.reserved_count,
        capacity: row.capacity,
      };
    });

    return SLOT_TIMES.map((slotTime) => {
      const info = map[slotTime] || { reserved: 0, capacity: SLOT_CAPACITY };
      const remaining = Math.max(0, info.capacity - info.reserved);
      return { slotTime, reserved: info.reserved, remaining, full: remaining === 0 };
    });
  }

  async function getSlotData(slotTime) {
    const summary = await getSlotSummary();
    return summary.find((item) => item.slotTime === slotTime) || null;
  }

  // ---- スロットカード ----

  function createButton(stats) {
    const link = document.createElement("a");
    link.className = "button-secondary";
    if (stats.full) {
      link.setAttribute("aria-disabled", "true");
      link.href = "#";
      link.textContent = "満席";
      link.addEventListener("click", (event) => event.preventDefault());
    } else {
      const isReservePage =
        /\/reserve\/?$/.test(window.location.pathname) ||
        /\/reserve\/index\.html$/.test(window.location.pathname);
      link.href = isReservePage
        ? `?slot=${stats.slotTime}`
        : `./reserve/?slot=${stats.slotTime}`;
      link.textContent = "この枠を予約";
    }
    return link;
  }

  async function renderSlotCards() {
    const containers = document.querySelectorAll("[data-slot-list]");
    if (!containers.length) return;

    containers.forEach((container) => {
      container.innerHTML =
        '<p style="opacity:0.5;padding:8px 0">枠を確認しています...</p>';
    });

    const summary = await getSlotSummary();

    containers.forEach((container) => {
      container.innerHTML = "";
      summary.forEach((stats) => {
        const card = document.createElement("article");
        card.className = `slot-card${stats.full ? " is-full" : ""}`;

        const heading = document.createElement("div");
        heading.className = "slot-time";
        heading.textContent = slotLabel(stats.slotTime);

        const copy = document.createElement("p");
        copy.textContent = `事前予約 ${stats.reserved} / ${SLOT_CAPACITY}名。予約が埋まらない場合は当日枠1名を開放します。`;

        const state = document.createElement("div");
        state.className = "slot-state";

        const remaining = document.createElement("span");
        remaining.textContent = `残り ${stats.remaining} 名`;

        const pill = document.createElement("span");
        pill.className = `pill${stats.full ? " is-full" : ""}`;
        pill.textContent = stats.full ? "受付終了" : "受付中";

        state.append(remaining, pill);
        card.append(heading, copy, state, createButton(stats));
        container.appendChild(card);
      });
    });
  }

  // ---- 予約フォーム ----

  async function updateReserveHint(slotTime) {
    const slot = Number(slotTime);
    if (!slot) {
      setText("[data-slot-hint]", "空き枠を選択すると残数を表示します。");
      return;
    }
    const data = await getSlotData(slot);
    if (!data) {
      setText("[data-slot-hint]", "選択した枠を確認できませんでした。");
      return;
    }
    setText(
      "[data-slot-hint]",
      data.full
        ? `${slotLabel(slot)} は満席です。別の枠を選択してください。`
        : `${slotLabel(slot)} は残り ${data.remaining} 名です。`
    );
  }

  async function populateSlotSelect(select) {
    select.disabled = true;
    const summary = await getSlotSummary();
    select.innerHTML = "";
    select.disabled = false;

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "時間枠を選択してください";
    placeholder.disabled = true;
    placeholder.selected = true;
    select.appendChild(placeholder);

    summary.forEach((stats) => {
      const option = document.createElement("option");
      option.value = String(stats.slotTime);
      option.disabled = stats.full;
      option.textContent = `${slotLabel(stats.slotTime)} | 残り ${stats.remaining} 名`;
      if (stats.full) option.textContent += " | 満席";
      select.appendChild(option);
    });
  }

  async function initReserveForm() {
    const form = document.querySelector("[data-reserve-form]");
    if (!form) return;

    const slotSelect = form.querySelector('select[name="slot_time"]');
    const message = form.querySelector("[data-form-message]");

    await populateSlotSelect(slotSelect);

    const params = new URLSearchParams(window.location.search);
    const requestedSlot = Number(params.get("slot"));
    const slotData = await getSlotData(requestedSlot);
    if (slotData && !slotData.full) {
      slotSelect.value = String(requestedSlot);
    }
    await updateReserveHint(slotSelect.value);

    slotSelect.addEventListener("change", () => {
      updateReserveHint(slotSelect.value);
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      message.hidden = true;
      message.textContent = "";
      message.classList.remove("is-error");

      if (!form.reportValidity()) return;

      const submitBtn = form.querySelector('[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = "送信中...";

      const formData = new FormData(form);
      const name = String(formData.get("name") || "").trim();
      const email = String(formData.get("email") || "").trim().toLowerCase();
      const slotTime = Number(formData.get("slot_time"));
      const experience = formData.get("experience") === "yes";
      const xAccount = String(formData.get("x_account") || "").trim() || null;

      // クライアント側の事前チェック（満席確認）
      const liveSlot = await getSlotData(slotTime);
      if (!liveSlot || liveSlot.full) {
        message.hidden = false;
        message.classList.add("is-error");
        message.textContent =
          "選択した時間枠は埋まりました。別の枠を選択してください。";
        await populateSlotSelect(slotSelect);
        await updateReserveHint(slotSelect.value);
        await renderSlotCards();
        submitBtn.disabled = false;
        submitBtn.textContent = "この内容で予約する";
        return;
      }

      // Supabase に INSERT
      const { error } = await db.from("reservations").insert({
        name,
        email,
        slot_time: slotTime,
        experience,
        x_account: xAccount,
      });

      if (error) {
        let msg = "予約に失敗しました。もう一度お試しください。";
        if (error.code === "23505") {
          msg = "同じメールアドレスで同じ時間枠の重複予約はできません。";
        } else if (error.message && error.message.includes("slot_full")) {
          msg = "選択した時間枠は埋まりました。別の枠を選択してください。";
          await populateSlotSelect(slotSelect);
          await renderSlotCards();
        }
        message.hidden = false;
        message.classList.add("is-error");
        message.textContent = msg;
        submitBtn.disabled = false;
        submitBtn.textContent = "この内容で予約する";
        return;
      }

      // 送信成功：thanks ページへ
      setLastReservation({
        name,
        email,
        slot_time: slotTime,
        experience,
        x_account: xAccount,
        created_at: new Date().toISOString(),
      });
      window.location.href = "../thanks/";
    });
  }

  // ---- サンクスページ ----

  async function initThanks() {
    const card = document.querySelector("[data-thanks-card]");
    if (!card) return;

    const last = getLastReservation();
    if (!last) {
      setText("[data-thanks-title]", "直近の予約情報がありません");
      setText(
        "[data-thanks-copy]",
        "このブラウザには予約履歴が保存されていません。予約フォームから申込を行ってください。"
      );
      return;
    }

    setText("[data-name]", last.name);
    setText("[data-email]", last.email);
    setText("[data-slot]", slotLabel(Number(last.slot_time)));
    setText("[data-experience]", last.experience ? "体験希望あり" : "見学のみ");
    setText("[data-x-account]", last.x_account || "—");
    setText(
      "[data-created-at]",
      new Date(last.created_at).toLocaleString("ja-JP", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    );

    const slot = await getSlotData(Number(last.slot_time));
    if (slot) setText("[data-remaining]", `${slot.remaining} 名`);
  }

  // ---- 管理者エクスポート ----

  function toCsv(data) {
    const header = [
      "id",
      "name",
      "email",
      "x_account",
      "slot_time",
      "experience",
      "created_at",
    ];
    const rows = data.map((item) =>
      [
        item.id,
        item.name,
        item.email,
        item.x_account ?? "",
        item.slot_time,
        item.experience ? "yes" : "no",
        item.created_at,
      ]
        .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
        .join(",")
    );
    return [header.join(","), ...rows].join("\n");
  }

  function triggerDownload(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function renderAdminTable(body, reservations) {
    body.innerHTML = "";
    if (!reservations.length) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 6;
      cell.textContent = "まだ予約データはありません。";
      row.appendChild(cell);
      body.appendChild(row);
      return;
    }

    reservations.forEach((item) => {
      const row = document.createElement("tr");
      [
        item.name,
        item.email,
        item.x_account ?? "—",
        slotLabel(Number(item.slot_time)),
        item.experience ? "あり" : "なし",
        new Date(item.created_at).toLocaleString("ja-JP"),
        item.id,
      ].forEach((value) => {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.appendChild(cell);
      });
      body.appendChild(row);
    });
  }

  function renderAdminLogin(page) {
    page.innerHTML = `
      <div class="section-head">
        <div>
          <p class="eyebrow">Admin Auth</p>
          <h1 class="section-title display-title">管理者ログイン</h1>
        </div>
        <p>予約データを表示するには管理者ログインが必要です。</p>
      </div>
      <form class="form-grid" id="admin-login-form" style="max-width:400px">
        <div class="field">
          <label for="admin-email">メールアドレス</label>
          <input id="admin-email" type="email" required />
        </div>
        <div class="field">
          <label for="admin-password">パスワード</label>
          <input id="admin-password" type="password" required />
        </div>
        <div class="message is-error" id="admin-login-error" hidden></div>
        <div class="stack-actions">
          <button class="button" type="submit">ログイン</button>
        </div>
      </form>
    `;

    const form = document.getElementById("admin-login-form");
    const errorEl = document.getElementById("admin-login-error");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = form.querySelector('[type="submit"]');
      btn.disabled = true;
      btn.textContent = "ログイン中...";
      errorEl.hidden = true;

      const email = document.getElementById("admin-email").value;
      const password = document.getElementById("admin-password").value;

      const { error } = await db.auth.signInWithPassword({ email, password });

      if (error) {
        errorEl.hidden = false;
        errorEl.textContent = "ログインに失敗しました: " + error.message;
        btn.disabled = false;
        btn.textContent = "ログイン";
        return;
      }

      window.location.reload();
    });
  }

  async function loadAdminData(page) {
    const { data: reservations, error } = await db
      .from("reservations")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      const errEl = document.createElement("p");
      errEl.className = "message is-error";
      errEl.textContent = "データ取得エラー: " + error.message;
      page.prepend(errEl);
      return;
    }

    const tableBody = page.querySelector("tbody");
    const output = page.querySelector("[data-export-output]");
    const format = page.getAttribute("data-admin-view");
    const baseName = "vacuum-event-20260418-reservations";

    setText("[data-admin-count]", String(reservations.length));
    renderAdminTable(tableBody, reservations);

    if (format === "csv") {
      const csv = toCsv(reservations);
      output.textContent = csv || "id,name,email,x_account,slot_time,experience,created_at";
      page.querySelector("[data-download]").addEventListener("click", () => {
        triggerDownload(`${baseName}.csv`, csv, "text/csv;charset=utf-8");
      });
    }

    if (format === "json") {
      const json = JSON.stringify(reservations, null, 2);
      output.textContent = json || "[]";
      page.querySelector("[data-download]").addEventListener("click", () => {
        triggerDownload(
          `${baseName}.json`,
          json,
          "application/json;charset=utf-8"
        );
      });
    }

    const clearBtn = page.querySelector("[data-clear]");
    if (clearBtn) {
      clearBtn.textContent = "ログアウト";
      clearBtn.addEventListener("click", async () => {
        await db.auth.signOut();
        window.location.reload();
      });
    }
  }

  async function initAdminView() {
    const page = document.querySelector("[data-admin-view]");
    if (!page) return;

    const {
      data: { session },
    } = await db.auth.getSession();

    if (!session) {
      renderAdminLogin(page);
      return;
    }

    await loadAdminData(page);
  }

  // ---- エントリーポイント ----

  document.addEventListener("DOMContentLoaded", () => {
    initMobileMenu();
    renderSlotCards();
    initReserveForm();
    initThanks();
    initAdminView();
  });
})();
