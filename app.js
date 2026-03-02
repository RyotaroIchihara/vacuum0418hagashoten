(() => {
  const STORAGE_KEY = "vacuumEventReservations_v1";
  const LAST_KEY = "vacuumEventLastReservation_v1";
  const SLOT_TIMES = [12, 13, 14, 15, 16, 17];
  const SLOT_CAPACITY = 3;

  function readStorage(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) {
        return fallback;
      }
      const parsed = JSON.parse(raw);
      return parsed ?? fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeStorage(key, value) {
    window.localStorage.setItem(key, JSON.stringify(value));
  }

  function getReservations() {
    const data = readStorage(STORAGE_KEY, []);
    if (!Array.isArray(data)) {
      return [];
    }
    return data.filter((item) => item && Number.isFinite(Number(item.slot_time)));
  }

  function setReservations(items) {
    writeStorage(STORAGE_KEY, items);
  }

  function getLastReservation() {
    const data = readStorage(LAST_KEY, null);
    return data && Number.isFinite(Number(data.slot_time)) ? data : null;
  }

  function setLastReservation(item) {
    writeStorage(LAST_KEY, item);
  }

  function slotLabel(hour) {
    return `${String(hour).padStart(2, "0")}:00`;
  }

  function getSlotSummary() {
    const reservations = getReservations();
    return SLOT_TIMES.map((slotTime) => {
      const reserved = reservations.filter(
        (item) => Number(item.slot_time) === slotTime
      ).length;
      const remaining = Math.max(0, SLOT_CAPACITY - reserved);
      return {
        slotTime,
        reserved,
        remaining,
        full: remaining === 0,
      };
    });
  }

  function getSlotData(slotTime) {
    return getSlotSummary().find((item) => item.slotTime === slotTime);
  }

  function setText(selector, value) {
    const element = document.querySelector(selector);
    if (element) {
      element.textContent = value;
    }
  }

  function initMobileMenu() {
    const topbars = document.querySelectorAll(".topbar");
    if (!topbars.length) {
      return;
    }

    const mobileQuery = window.matchMedia("(max-width: 640px)");

    topbars.forEach((topbar, index) => {
      const button = topbar.querySelector("[data-menu-toggle]");
      const nav = topbar.querySelector(".topnav");
      if (!button || !nav) {
        return;
      }

      if (!nav.id) {
        nav.id = `site-nav-${index + 1}`;
      }

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
          if (mobileQuery.matches) {
            setOpen(false);
          }
        });
      });

      mobileQuery.addEventListener("change", (event) => {
        if (!event.matches) {
          setOpen(false);
        }
      });

      setOpen(false);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") {
        return;
      }

      topbars.forEach((topbar) => {
        const button = topbar.querySelector("[data-menu-toggle]");
        if (!button) {
          return;
        }
        topbar.setAttribute("data-menu-open", "false");
        button.setAttribute("aria-expanded", "false");
        button.setAttribute("aria-label", "メニューを開く");
      });
    });
  }

  function createId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

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

  function renderSlotCards() {
    const containers = document.querySelectorAll("[data-slot-list]");
    if (!containers.length) {
      return;
    }

    const summary = getSlotSummary();

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

  function updateReserveHint(slotTime) {
    const slot = Number(slotTime);
    if (!slot) {
      setText("[data-slot-hint]", "空き枠を選択すると残数を表示します。");
      return;
    }
    const data = getSlotData(slot);
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

  function populateSlotSelect(select) {
    const summary = getSlotSummary();
    select.innerHTML = "";

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
      if (stats.full) {
        option.textContent += " | 満席";
      }
      select.appendChild(option);
    });
  }

  function initReserveForm() {
    const form = document.querySelector("[data-reserve-form]");
    if (!form) {
      return;
    }

    const slotSelect = form.querySelector('select[name="slot_time"]');
    const message = form.querySelector("[data-form-message]");
    populateSlotSelect(slotSelect);

    const params = new URLSearchParams(window.location.search);
    const requestedSlot = Number(params.get("slot"));
    const slotData = getSlotData(requestedSlot);
    if (slotData && !slotData.full) {
      slotSelect.value = String(requestedSlot);
    }
    updateReserveHint(slotSelect.value);

    slotSelect.addEventListener("change", () => {
      updateReserveHint(slotSelect.value);
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      message.hidden = true;
      message.textContent = "";
      message.classList.remove("is-error");

      if (!form.reportValidity()) {
        return;
      }

      const formData = new FormData(form);
      const name = String(formData.get("name") || "").trim();
      const email = String(formData.get("email") || "").trim().toLowerCase();
      const slotTime = Number(formData.get("slot_time"));
      const experience = formData.get("experience") === "yes";

      const liveSlot = getSlotData(slotTime);
      if (!liveSlot || liveSlot.full) {
        message.hidden = false;
        message.classList.add("is-error");
        message.textContent = "選択した時間枠は埋まりました。別の枠を選択してください。";
        populateSlotSelect(slotSelect);
        updateReserveHint(slotSelect.value);
        renderSlotCards();
        return;
      }

      const reservations = getReservations();
      const duplicate = reservations.some(
        (item) =>
          String(item.email || "").toLowerCase() === email &&
          Number(item.slot_time) === slotTime
      );

      if (duplicate) {
        message.hidden = false;
        message.classList.add("is-error");
        message.textContent =
          "同じメールアドレスで同じ時間枠の重複予約はできません。";
        return;
      }

      const entry = {
        id: createId(),
        name,
        email,
        slot_time: slotTime,
        experience,
        created_at: new Date().toISOString(),
      };

      reservations.push(entry);
      setReservations(reservations);
      setLastReservation(entry);
      window.location.href = "../thanks/";
    });
  }

  function initThanks() {
    const card = document.querySelector("[data-thanks-card]");
    if (!card) {
      return;
    }

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
    setText(
      "[data-created-at]",
      new Date(last.created_at).toLocaleString("ja-JP", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    );

    const slot = getSlotData(Number(last.slot_time));
    if (slot) {
      setText("[data-remaining]", `${slot.remaining} 名`);
    }
  }

  function toCsv(data) {
    const header = [
      "id",
      "name",
      "email",
      "slot_time",
      "experience",
      "created_at",
    ];
    const rows = data.map((item) =>
      [
        item.id,
        item.name,
        item.email,
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
      const values = [
        item.name,
        item.email,
        slotLabel(Number(item.slot_time)),
        item.experience ? "あり" : "なし",
        new Date(item.created_at).toLocaleString("ja-JP"),
        item.id,
      ];
      values.forEach((value) => {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.appendChild(cell);
      });
      body.appendChild(row);
    });
  }

  function initAdminView() {
    const page = document.querySelector("[data-admin-view]");
    if (!page) {
      return;
    }

    const reservations = getReservations();
    const count = reservations.length;
    const tableBody = page.querySelector("tbody");
    const output = page.querySelector("[data-export-output]");
    const format = page.getAttribute("data-admin-view");
    const baseName = "vacuum-event-20260418-reservations";

    setText("[data-admin-count]", String(count));
    renderAdminTable(tableBody, reservations);

    if (format === "csv") {
      const csv = toCsv(reservations);
      output.textContent = csv || "id,name,email,slot_time,experience,created_at";
      const button = page.querySelector("[data-download]");
      button.addEventListener("click", () => {
        triggerDownload(`${baseName}.csv`, csv, "text/csv;charset=utf-8");
      });
    }

    if (format === "json") {
      const json = JSON.stringify(reservations, null, 2);
      output.textContent = json || "[]";
      const button = page.querySelector("[data-download]");
      button.addEventListener("click", () => {
        triggerDownload(
          `${baseName}.json`,
          json,
          "application/json;charset=utf-8"
        );
      });
    }

    const clear = page.querySelector("[data-clear]");
    if (clear) {
      clear.addEventListener("click", () => {
        window.localStorage.removeItem(STORAGE_KEY);
        window.localStorage.removeItem(LAST_KEY);
        window.location.reload();
      });
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    initMobileMenu();
    renderSlotCards();
    initReserveForm();
    initThanks();
    initAdminView();
  });
})();
