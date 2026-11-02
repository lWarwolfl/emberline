import { sameSave, type CloudSave, type SavePayload } from "./cloud-save";

interface Options {
  capture(): SavePayload;
  apply(data: SavePayload): void;
  beforeOpen?(): void;
  onStatus?(message: string, user: User | null): void;
}
interface User {
  id: string;
  username: string;
}
class RequestError extends Error {
  constructor(
    public status: number,
    public result: Record<string, unknown>,
  ) {
    super(String(result.message || "Unable to reach your account. Try again."));
  }
}

export function create(doc: Document, options: Options) {
  const dialog = doc.createElement("dialog");
  dialog.id = "account-dialog";
  dialog.setAttribute("aria-labelledby", "account-heading");
  dialog.innerHTML = `<header class="setup-header"><div><span class="label">COURIER ACCOUNT</span><h2 id="account-heading">KEEP YOUR SIGNAL.</h2></div><button type="button" class="close-button" aria-label="Close account">✕</button></header>
    <div class="account-body">
      <p class="account-copy">Save your progress across devices. Log in or create an account to keep your coins, equipment, upgrades, best score and settings, then log in on another device to continue. Progress syncs every 30 seconds while signed in.</p>
      <p class="account-message" role="status" aria-live="polite"></p>
      <form class="account-form">
        <label for="account-username">USERNAME</label><input id="account-username" name="username" autocomplete="username" required minlength="3" maxlength="24" pattern="[A-Za-z0-9_]{3,24}" placeholder="courier_name">
        <label for="account-password">PASSWORD</label><input id="account-password" name="password" type="password" autocomplete="current-password" required minlength="10" maxlength="128">
        <div class="account-recovery-input" hidden><label for="account-recovery-input">BACKUP CODE</label><input id="account-recovery-input" name="recoveryCode" autocomplete="off" spellcheck="false"></div>
        <div class="account-actions"><button type="submit" class="primary">LOG IN</button><button type="button" data-mode="register">CREATE ACCOUNT</button><button type="button" data-mode="recover">FORGOT PASSWORD</button></div>
      </form>
      <section class="account-signed-in" hidden><h3 class="account-name"></h3><p>Continue on any device by logging in with this username and password.</p><div class="account-actions"><button type="button" class="primary" data-sync>SYNC NOW</button><button type="button" data-logout>LOG OUT</button></div>
      <details><summary>Replace backup code</summary><p>Enter your current password to replace your previous backup code.</p><label for="account-current-password">CURRENT PASSWORD</label><input id="account-current-password" type="password" autocomplete="current-password" maxlength="128"><button type="button" data-replace>GENERATE NEW CODE</button></details></section>
      <section class="account-conflict" hidden><h3>CHOOSE YOUR SAVE</h3><p>Your cloud and device saves are different. Choose the one to continue with. The other save will be replaced.</p><div class="account-actions"><button type="button" data-cloud class="primary">USE CLOUD SAVE</button><button type="button" data-device>KEEP THIS DEVICE SAVE</button></div></section>
      <section class="account-recovery" hidden><h3>DOWNLOAD YOUR BACKUP CODE</h3><p>Keep this file somewhere safe. It replaces your password if you forget it. Each recovery replaces the code and logs out every device.</p><code class="account-code"></code><button type="button" data-download class="primary">DOWNLOAD BACKUP CODE</button></section>
    </div>`;
  doc.body.append(dialog);
  const el = <T extends HTMLElement>(selector: string) => dialog.querySelector<T>(selector)!;
  const form = el<HTMLFormElement>(".account-form");
  const usernameInput = el<HTMLInputElement>("#account-username");
  const passwordInput = el<HTMLInputElement>("#account-password");
  const recoveryInput = el<HTMLInputElement>("#account-recovery-input");
  const currentPassword = el<HTMLInputElement>("#account-current-password");
  const conflictSection = el(".account-conflict");
  const recoverySection = el(".account-recovery");
  let user: User | null = null;
  let mode: "login" | "register" | "recover" = "login";
  let version = 0;
  let busy = false;
  let syncing = false;
  let syncTask: Promise<void> | null = null;
  let sessionChecked = false;
  let initialized = false;
  let conflict: CloudSave | null = null;
  let recoveryCode = "";
  let recoveryUsername = "";
  let status = "Guest · progress stays on this device";

  function report(message: string) {
    status = message;
    el(".account-message").textContent = message;
    options.onStatus?.(message, user);
  }
  function render() {
    form.hidden = !!user;
    el(".account-signed-in").hidden = !user;
    el(".account-name").textContent = user ? "SIGNED IN / " + user.username : "";
    conflictSection.hidden = !conflict;
    el(".account-recovery-input").hidden = mode !== "recover";
    recoveryInput.required = mode === "recover";
    el<HTMLButtonElement>("button[type=submit]").textContent =
      mode === "register" ? "CREATE ACCOUNT" : mode === "recover" ? "RESET PASSWORD" : "LOG IN";
    passwordInput.autocomplete = mode === "login" ? "current-password" : "new-password";
    passwordInput.labels![0].textContent = mode === "recover" ? "NEW PASSWORD" : "PASSWORD";
    el<HTMLButtonElement>('[data-mode="register"]').textContent =
      mode === "register" ? "BACK TO LOG IN" : "CREATE ACCOUNT";
    el<HTMLButtonElement>('[data-mode="recover"]').textContent =
      mode === "recover" ? "BACK TO LOG IN" : "FORGOT PASSWORD";
    dialog.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
      button.disabled = busy && !button.classList.contains("close-button");
    });
    el<HTMLButtonElement>("[data-sync]").disabled = busy || !!conflict;
    el<HTMLButtonElement>("[data-cloud]").disabled = busy || !conflict?.data;
  }
  async function request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
    if (location.protocol === "file:")
      throw new Error(
        "Cloud accounts need the hosted game or npm run host. Your save stays on this device.",
      );
    const response = await fetch("/api/account/" + path, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json", "X-Emberline-Request": "1" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
    let result: Record<string, unknown>;
    try {
      result = (await response.json()) as Record<string, unknown>;
    } catch {
      throw new Error("Accounts are unavailable on this host. Your device save is safe.");
    }
    if (!response.ok) throw new RequestError(response.status, result);
    return result as T;
  }
  function showRecovery(code: string, name: string) {
    recoveryCode = code;
    recoveryUsername = name;
    recoverySection.hidden = false;
    el(".account-code").textContent = code;
  }
  function setConflict(save: CloudSave) {
    conflict = save;
    initialized = false;
    report("Choose your cloud save or this device save before syncing.");
    render();
  }
  async function hydrate() {
    const cloud = await request<CloudSave>("save");
    if (cloud.userId !== user?.id)
      throw new RequestError(401, {
        message: "This account changed in another tab. Log in again.",
      });
    version = cloud.version;
    if (cloud.data && sameSave(options.capture(), cloud.data)) {
      initialized = true;
      report(user!.username + " · Cloud save up to date");
    } else setConflict(cloud);
  }
  async function restoreSession() {
    const result = await request<{ user: User | null }>("session");
    user = result.user;
    sessionChecked = true;
    if (user) await hydrate();
  }
  async function syncOnce(force = false) {
    if (location.protocol === "file:" || syncing || (conflict && !force)) return;
    syncing = true;
    try {
      if (!sessionChecked) await restoreSession();
      if (!user) return;
      if (conflict && !force) return;
      if (!initialized && !force) {
        await hydrate();
        if (!initialized) return;
      }
      const data = options.capture();
      const saved = await request<CloudSave>("save", "PUT", { data, version, userId: user.id });
      version = saved.version;
      initialized = true;
      conflict = null;
      report(
        user.username +
          " · Saved " +
          new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
      );
    } catch (error) {
      if (error instanceof RequestError && error.status === 409)
        setConflict(error.result as unknown as CloudSave);
      else if (error instanceof RequestError && error.status === 401) {
        user = null;
        initialized = false;
        report("Session expired · Log in to resume cloud backup");
      } else
        report(
          (user?.username ?? "Account") +
            " · Sync pending; local save kept. " +
            (error instanceof Error ? error.message : "Try again."),
        );
    } finally {
      syncing = false;
      render();
    }
  }
  function sync(force = false): Promise<void> {
    if (syncTask) return syncTask.then(() => sync(force));
    const task = syncOnce(force);
    syncTask = task;
    return task.finally(() => {
      if (syncTask === task) syncTask = null;
    });
  }
  async function perform(action: () => Promise<void>) {
    if (busy) return;
    busy = true;
    render();
    try {
      await action();
    } catch (error) {
      report(error instanceof Error ? error.message : "Please try again.");
    } finally {
      busy = false;
      render();
    }
  }
  el(".close-button").addEventListener("click", () => dialog.close());
  dialog.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((button) =>
    button.addEventListener("click", () => {
      const next = button.dataset.mode as "register" | "recover";
      mode = mode === next ? "login" : next;
      passwordInput.value = "";
      recoveryInput.value = "";
      report(
        mode === "recover"
          ? "Use your downloaded backup code and choose a new password."
          : "Use a username and a password of at least 10 characters.",
      );
      render();
    }),
  );
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void perform(async () => {
      const result = await request<{ user?: User; recoveryCode?: string }>(
        mode === "login" ? "login" : mode === "register" ? "register" : "recover",
        "POST",
        {
          username: usernameInput.value,
          password: passwordInput.value,
          ...(mode === "recover" ? { recoveryCode: recoveryInput.value } : {}),
        },
      );
      passwordInput.value = "";
      recoveryInput.value = "";
      if (result.recoveryCode)
        showRecovery(result.recoveryCode, usernameInput.value.trim().toLowerCase());
      if (mode === "recover") {
        mode = "login";
        user = null;
        initialized = false;
        report("Password reset. Download your replacement backup code, then log in.");
      } else {
        user = result.user!;
        sessionChecked = true;
        if (mode === "register") {
          version = 0;
          initialized = true;
          await sync();
        } else await hydrate();
      }
    });
  });
  el("[data-sync]").addEventListener("click", () => {
    void perform(() => sync());
  });
  el("[data-device]").addEventListener("click", () => {
    void perform(async () => {
      if (!conflict) return;
      version = conflict.version;
      await sync(true);
    });
  });
  el("[data-cloud]").addEventListener("click", () => {
    void perform(async () => {
      if (!conflict?.data) return;
      const data = conflict.data;
      options.apply(data);
      version = conflict.version;
      conflict = null;
      initialized = true;
      report(user!.username + " · Cloud save restored");
    });
  });
  el("[data-logout]").addEventListener("click", () => {
    void perform(async () => {
      if (initialized) await sync();
      // A failed or conflicted upload remains local; require an explicit second click to leave it.
      if (conflict) {
        report("Choose a save before logging out so no progress is lost.");
        return;
      }
      await request("logout", "POST", {});
      user = null;
      initialized = false;
      conflict = null;
      version = 0;
      recoveryCode = "";
      recoverySection.hidden = true;
      report("Logged out · This device keeps its local save");
    });
  });
  el("[data-replace]").addEventListener("click", () => {
    void perform(async () => {
      const result = await request<{ recoveryCode: string }>("recovery-code", "POST", {
        password: currentPassword.value,
      });
      currentPassword.value = "";
      showRecovery(result.recoveryCode, user!.username);
      report("Download this replacement code. Your previous backup code no longer works.");
    });
  });
  el("[data-download]").addEventListener("click", () => {
    if (!recoveryCode) return;
    const blob = new Blob(
      [
        "EMBERLINE ACCOUNT BACKUP\n\nUsername: " +
          recoveryUsername +
          "\nBackup code: " +
          recoveryCode +
          "\n\nKeep this file private. Use FORGOT PASSWORD to recover your account.\nRecovery replaces this code and logs out every device.\n",
      ],
      { type: "text/plain;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const link = doc.createElement("a");
    link.href = url;
    link.download = "emberline-" + recoveryUsername + "-backup.txt";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    report("Backup downloaded. Keep it somewhere safe.");
  });
  const timer = setInterval(() => {
    void sync();
  }, 30000);
  doc.addEventListener("visibilitychange", () => {
    if (doc.visibilityState === "hidden") void sync();
  });
  window.addEventListener("online", () => {
    void sync();
  });
  render();
  report(status);
  if (location.protocol !== "file:") void perform(restoreSession);
  return {
    open() {
      options.beforeOpen?.();
      if (!dialog.open) dialog.showModal();
      if (!sessionChecked || (user && !initialized && !conflict)) void sync();
    },
    sync,
    get status() {
      return status;
    },
    destroy() {
      clearInterval(timer);
      dialog.remove();
    },
  };
}
