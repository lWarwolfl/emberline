import { element } from "./dom";
import {
  donationNetworks,
  donationNetwork,
  formatDonation,
  type DonationNetworkId,
  supporterCharacters,
} from "./donation-config";
import { connectDonationWallet, signDonationMessage } from "./donation-wallet";
import { drawQr } from "./qr";
import Engine from "./engine";
import Sprites from "./sprites";
import Loadout from "./loadout";
interface Options {
  beforeOpen(): void;
  login(): void;
  refresh(): Promise<string | null>;
  equip(id: string): void;
}
interface DonationRow {
  network: string;
  txId: string;
  asset: string;
  amountUnits: string;
  decimals: number;
  verifiedAt: string;
}
export function create(doc: Document, options: Options) {
  const dialog = element(doc, "donation-dialog", "dialog");
  const get = <T extends HTMLElement>(id: string) => element(doc, id) as T;
  const select = get<HTMLSelectElement>("donation-network"),
    address = get<HTMLInputElement>("donation-address"),
    tx = get<HTMLInputElement>("donation-tx"),
    sender = get<HTMLInputElement>("donation-sender"),
    signature = get<HTMLTextAreaElement>("donation-signature"),
    message = get<HTMLTextAreaElement>("donation-message"),
    status = get("donation-status");
  const form = get<HTMLFormElement>("donation-form"),
    claim = get<HTMLButtonElement>("donation-claim"),
    sign = get<HTMLButtonElement>("donation-sign"),
    prepare = get<HTMLButtonElement>("donation-prepare");
  let nonce = "",
    busy = false,
    supporter = false,
    selected = 0,
    accountId: string | null = null,
    revision = 0;
  for (const n of donationNetworks) {
    const option = doc.createElement("option");
    option.value = n.id;
    option.textContent = n.symbol + " / " + n.name;
    select.append(option);
  }
  const preview = Engine.create("supporter-preview");
  preview.loadout.character = supporterCharacters[0];
  const canvas = get<HTMLCanvasElement>("donation-preview"),
    ctx = canvas.getContext("2d")!;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const sprites = Sprites.create(ctx, reduced);
  ctx.imageSmoothingEnabled = false;
  function report(text: string) {
    status.textContent = text;
  }
  async function request<T>(action: string, body?: unknown): Promise<T> {
    if (location.protocol === "file:")
      throw new Error("Donate and claim on the hosted game. Offline play keeps working.");
    const response = await fetch("/api/account/" + action, {
      method: body ? "POST" : "GET",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", "X-Emberline-Request": "1" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = (await response.json()) as { message?: string };
    if (!response.ok)
      throw new Error(data.message || "Donation verification is unavailable. Please retry later.");
    return data as T;
  }
  function resetClaim() {
    nonce = "";
    message.value = "";
    signature.value = "";
    get("donation-proof").hidden = true;
  }
  function renderReward() {
    get("donation-lock").textContent = supporter
      ? "UNLOCKED / FLAMEBOUND COLLECTION"
      : "LOCKED / FLAMEBOUND COLLECTION";
    get<HTMLButtonElement>("donation-equip").hidden = !supporter;
    const p = Loadout.find(Loadout.characters, supporterCharacters[selected]);
    get("donation-skin-name").textContent = p.name.toUpperCase();
    get("donation-skin-copy").textContent = p.description;
    preview.loadout.character = p.id;
    for (const [i, id] of ["donation-cinder", "donation-solar"].entries())
      get(id).setAttribute("aria-pressed", String(i === selected));
  }
  function networkChange() {
    revision++;
    resetClaim();
    const n = donationNetwork(select.value)!;
    address.value = n.address;
    get("donation-asset").textContent = `${n.symbol} ONLY / ${n.name.toUpperCase()} MAINNET`;
    get("donation-confirmations").textContent =
      n.id === "tron"
        ? "Wait for a solidified TRON transaction."
        : n.id === "solana"
          ? "Wait for Solana finalization."
          : `Wait for ${n.confirmations} confirmations before claiming.`;
    get("donation-signature-help").textContent =
      n.id === "bitcoin"
        ? "Bitcoin: Base64 BIP-322 simple or legacy signature from the sending address. Mixed-sender and exchange withdrawals cannot claim."
        : n.id === "solana"
          ? "Solana: sign the exact UTF-8 message. Paste the 64-byte Ed25519 signature as Base64."
          : n.id === "tron"
            ? "TRON: sign the exact message with signMessageV2 (TIP-191). Paste the hex signature."
            : "Ethereum / BNB: sign the exact message with personal_sign. Paste the hex signature.";
    sender.value = "";
    tx.value = "";
    try {
      drawQr(get<HTMLCanvasElement>("donation-qr"), n.address);
    } catch {
      get("donation-qr").hidden = true;
    }
  }
  function setBusy(value: boolean) {
    busy = value;
    for (const button of dialog.querySelectorAll<HTMLButtonElement>("button"))
      button.disabled = value && !button.classList.contains("close-button");
    select.disabled = value;
    tx.disabled = value;
    sender.disabled = value;
  }
  async function perform(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try {
      await work();
    } catch (e) {
      report(e instanceof Error ? e.message : "Unable to verify. Please retry later.");
    } finally {
      setBusy(false);
    }
  }
  async function load() {
    supporter = false;
    renderReward();
    get("donation-history").replaceChildren();
    get("donation-history-section").hidden = true;
    get("donation-login").hidden = false;
    accountId = await options.refresh();
    if (!accountId) {
      renderReward();
      report("Log in or create an account before claiming your skins.");
      get("donation-login").hidden = false;
      return;
    }
    get("donation-login").hidden = true;
    const data = await request<{ supporter: boolean; donations: DonationRow[] }>("donations");
    supporter = data.supporter;
    renderReward();
    const history = get("donation-history");
    history.replaceChildren();
    for (const row of data.donations) {
      const item = doc.createElement("li"),
        link = doc.createElement("a");
      const n = donationNetwork(row.network);
      item.append(
        formatDonation(row.amountUnits, row.decimals) +
          " " +
          row.asset +
          " / " +
          new Date(row.verifiedAt).toLocaleDateString() +
          " ",
      );
      if (n) {
        link.textContent = "VIEW TRANSACTION";
        link.href = n.explorer + encodeURIComponent(row.txId);
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        item.append(link);
      }
      history.append(item);
    }
    get("donation-history-section").hidden = !data.donations.length;
    report(
      supporter
        ? "Your full Flamebound collection is unlocked. Thank you for keeping the signal alive."
        : "Any confirmed positive donation unlocks both skins. Network fees are separate.",
    );
  }
  dialog.addEventListener("close", () => {
    resetClaim();
    get<HTMLInputElement>("donation-name").value = "";
    get<HTMLInputElement>("donation-email").value = "";
  });
  get("donation-close").addEventListener("click", () => dialog.close());
  get("donation-login").addEventListener("click", () => {
    dialog.close();
    options.login();
  });
  get("donation-copy").addEventListener("click", () => {
    void perform(async () => {
      try {
        await navigator.clipboard.writeText(address.value);
        report("Address copied. Check the selected network in your wallet before sending.");
      } catch {
        address.focus();
        address.select();
        report("Select and copy the address manually.");
      }
    });
  });
  select.addEventListener("change", networkChange);
  for (const input of [tx, sender])
    input.addEventListener("input", () => {
      revision++;
      resetClaim();
    });
  get("donation-connect").addEventListener("click", () => {
    void perform(async () => {
      sender.value = await connectDonationWallet(select.value as DonationNetworkId);
      resetClaim();
      report("Sending wallet selected. Paste your transaction ID, then prepare the claim message.");
    });
  });
  prepare.addEventListener("click", () => {
    void perform(async () => {
      if (!form.reportValidity()) return;
      const current = revision;
      if (!(await options.refresh())) throw new Error("Log in before claiming.");
      const data = await request<{ nonce: string; message: string }>("donation-challenge", {
        network: select.value,
        txId: tx.value,
        sender: sender.value,
      });
      if (current !== revision) return;
      nonce = data.nonce;
      message.value = data.message;
      get("donation-proof").hidden = false;
      report(
        "Review the message and sign it with the wallet that sent the donation. Signing this message costs no gas.",
      );
    });
  });
  sign.addEventListener("click", () => {
    void perform(async () => {
      if (!nonce) throw new Error("Prepare your claim message first.");
      signature.value = await signDonationMessage(
        select.value as DonationNetworkId,
        sender.value,
        message.value,
      );
      report("Message signed. Select VERIFY & UNLOCK to check the on-chain payment.");
    });
  });
  claim.addEventListener("click", () => {
    void perform(async () => {
      if (!nonce || !signature.value.trim())
        throw new Error("Prepare the claim message and sign it first.");
      await request("donation-claim", {
        nonce,
        signature: signature.value,
        name: get<HTMLInputElement>("donation-name").value,
        email: get<HTMLInputElement>("donation-email").value,
      });
      resetClaim();
      await load();
    });
  });
  for (const [i, id] of ["donation-cinder", "donation-solar"].entries())
    get(id).addEventListener("click", () => {
      selected = i;
      renderReward();
    });
  get("donation-equip").addEventListener("click", () => {
    void perform(async () => {
      await load();
      if (!supporter) throw new Error("Log in with the account that owns these skins.");
      options.equip(supporterCharacters[selected]);
      report("Supporter skin equipped. It will sync with your account save.");
    });
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    prepare.click();
  });
  networkChange();
  renderReward();
  return {
    open() {
      options.beforeOpen();
      resetClaim();
      if (!dialog.open) dialog.showModal();
      void perform(load);
    },
    draw(time: number) {
      if (!dialog.open) return;
      ctx.fillStyle = "#141c19";
      ctx.fillRect(0, 0, 160, 110);
      ctx.fillStyle = "#59694d";
      ctx.fillRect(14, 94, 132, 2);
      ctx.save();
      ctx.translate(87, 46);
      ctx.scale(2.4, 2.4);
      sprites.courier(0, 0, reduced ? 0 : time, false, preview);
      ctx.restore();
    },
  };
}
