/**
 * The asset CMS: a hidden scene reachable from an unlabeled title-screen
 * hotspot. It renders as a DOM overlay (real file pickers, drag-drop and a
 * scrollable list beat canvas widgets for a meta tool) above the paused
 * game canvas, and talks to the /api asset routes backed by Vercel Blob.
 *
 * Graceful degradation: with no reachable API (plain `npm run dev`, offline)
 * every slot still shows its current LOCAL source and thumbnail; uploads and
 * reverts are disabled with a clear banner.
 */

import type { CatalogEntry } from '../data/assetCatalog';
import { assetSource, invalidateAsset, loadImage, setAssetOverride } from './assets';
import type { Game, Scene } from './game';
import { LOGICAL_H, LOGICAL_W } from './renderer';

const TOKEN_KEY = 'dcc_admin_token';

type ApiState = 'checking' | 'ok' | 'offline' | 'unauthorized' | 'unconfigured';

interface RemoteAsset {
  id: string;
  url: string;
  size: number;
  uploadedAt: string;
}

export class CmsScene implements Scene {
  private readonly game: Game;
  private readonly catalog: CatalogEntry[];
  private readonly root: HTMLDivElement;
  private readonly rows = new Map<string, HTMLDivElement>();
  private readonly banner: HTMLDivElement;
  private readonly counts: HTMLSpanElement;
  private readonly listEl: HTMLDivElement;
  private apiState: ApiState = 'checking';
  private remote = new Map<string, RemoteAsset>();
  private filterText = '';
  private filterCategory = 'all';
  private closed = false;

  constructor(game: Game, catalog: CatalogEntry[]) {
    this.game = game;
    this.catalog = catalog;
    this.root = document.createElement('div');
    this.root.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:40', 'background:rgba(4,8,16,0.92)',
      'color:#d8ecff', 'font:13px/1.5 monospace', 'display:flex', 'flex-direction:column',
      'padding:16px', 'gap:10px', 'box-sizing:border-box',
    ].join(';');

    const header = document.createElement('div');
    header.style.cssText = 'display:flex;gap:10px;align-items:center;flex-wrap:wrap';
    const title = document.createElement('strong');
    title.textContent = 'ASSET CMS';
    title.style.color = '#3fd9ff';
    this.counts = document.createElement('span');
    const search = document.createElement('input');
    search.placeholder = 'filter ids...';
    search.style.cssText = 'background:#101826;color:#d8ecff;border:1px solid #39465e;padding:4px 8px';
    search.addEventListener('input', () => {
      this.filterText = search.value.toLowerCase();
      this.applyFilter();
    });
    const catSel = document.createElement('select');
    catSel.style.cssText = 'background:#101826;color:#d8ecff;border:1px solid #39465e;padding:4px';
    for (const c of ['all', 'backgrounds', 'masks', 'sprites', 'portraits', 'items', 'ui']) {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      catSel.appendChild(opt);
    }
    catSel.addEventListener('change', () => {
      this.filterCategory = catSel.value;
      this.applyFilter();
    });
    const tokenBtn = this.button('SET TOKEN', () => {
      const t = window.prompt('Admin token:', localStorage.getItem(TOKEN_KEY) ?? '');
      if (t !== null) {
        localStorage.setItem(TOKEN_KEY, t);
        void this.connect();
      }
    });
    const closeBtn = this.button('CLOSE (ESC)', () => this.close());
    header.append(title, this.counts, search, catSel, tokenBtn, closeBtn);

    this.banner = document.createElement('div');
    this.banner.style.cssText = 'padding:6px 10px;border:1px solid #39465e;background:#101826';

    this.listEl = document.createElement('div');
    this.listEl.style.cssText = 'overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:6px';

    this.root.append(header, this.banner, this.listEl);
    document.body.appendChild(this.root);

    for (const entry of this.catalog) this.listEl.appendChild(this.buildRow(entry));
    this.refreshCounts();
    void this.connect();
  }

  // --- API client ----------------------------------------------------------

  private token(): string {
    return localStorage.getItem(TOKEN_KEY) ?? '';
  }

  private async connect(): Promise<void> {
    this.apiState = 'checking';
    this.renderBanner('Connecting to /api/assets...');
    try {
      const res = await fetch('/api/assets', { headers: { 'x-admin-token': this.token() } });
      if (res.status === 401) {
        this.apiState = 'unauthorized';
        this.renderBanner('API reachable, but the admin token was rejected. Use SET TOKEN.');
      } else if (res.status === 503) {
        const body = (await res.json()) as { error?: string };
        this.apiState = 'unconfigured';
        this.renderBanner(`API reachable, but not fully configured: ${body.error ?? 'storage unavailable'}`);
      } else if (res.ok) {
        const body = (await res.json()) as { assets?: RemoteAsset[] };
        this.remote = new Map((body.assets ?? []).map((a) => [a.id, a]));
        // Sync the live override map with the server's truth. (?v= busts the
        // browser cache on overwritten blob URLs; data: URLs need none.)
        for (const [id, a] of this.remote) {
          const busted = a.url.startsWith('data:') ? a.url : `${a.url}?v=${Date.parse(a.uploadedAt)}`;
          setAssetOverride(id, busted);
        }
        this.apiState = 'ok';
        this.renderBanner(`Connected. ${this.remote.size} override(s) in Blob storage.`);
      } else {
        this.apiState = 'offline';
        this.renderBanner(`API answered ${res.status}. Uploads disabled; showing local sources.`);
      }
    } catch {
      this.apiState = 'offline';
      this.renderBanner('API unreachable (plain `npm run dev` / offline). Uploads disabled; local sources shown.');
    }
    for (const entry of this.catalog) this.refreshRow(entry);
    this.refreshCounts();
  }

  private async upload(entry: CatalogEntry, file: File): Promise<void> {
    const warn = await this.dimensionWarning(entry, file);
    if (warn && !window.confirm(`${warn}\nUpload anyway?`)) return;
    const form = new FormData();
    form.set('id', entry.id);
    form.set('file', file);
    const res = await fetch('/api/assets/upload', {
      method: 'POST',
      headers: { 'x-admin-token': this.token() },
      body: form,
    });
    const body = (await res.json()) as { url?: string; error?: string };
    if (!res.ok || !body.url) {
      this.renderBanner(`Upload of ${entry.id} failed: ${body.error ?? res.status}`);
      return;
    }
    setAssetOverride(entry.id, body.url);
    this.remote.set(entry.id, { id: entry.id, url: body.url, size: file.size, uploadedAt: new Date().toISOString() });
    this.renderBanner(`Uploaded ${entry.id}. Live for scenes loaded from now on (re-enter a room / relaunch from title to see it in-game).`);
    this.refreshRow(entry);
    this.refreshCounts();
  }

  private async revert(entry: CatalogEntry): Promise<void> {
    const res = await fetch(`/api/assets?id=${encodeURIComponent(entry.id)}`, {
      method: 'DELETE',
      headers: { 'x-admin-token': this.token() },
    });
    const body = (await res.json()) as { error?: string };
    if (!res.ok) {
      this.renderBanner(`Revert of ${entry.id} failed: ${body.error ?? res.status}`);
      return;
    }
    setAssetOverride(entry.id, null);
    this.remote.delete(entry.id);
    this.renderBanner(`Reverted ${entry.id} to its ${entry.placeholder ? 'bundled/procedural' : 'local'} source.`);
    this.refreshRow(entry);
    this.refreshCounts();
  }

  private async dimensionWarning(entry: CatalogEntry, file: File): Promise<string | null> {
    if (!entry.expectW || !entry.expectH) return null;
    try {
      const bmp = await createImageBitmap(file);
      const { width, height } = bmp;
      bmp.close();
      if (width !== entry.expectW || height !== entry.expectH) {
        return `Expected ${entry.expectW}x${entry.expectH}, file is ${width}x${height}.`;
      }
      return null;
    } catch {
      return 'File does not decode as an image in this browser.';
    }
  }

  // --- Rows -----------------------------------------------------------------

  private buildRow(entry: CatalogEntry): HTMLDivElement {
    const row = document.createElement('div');
    row.style.cssText =
      'display:flex;gap:12px;align-items:center;border:1px solid #39465e;background:#0c1220;padding:6px 10px';
    row.dataset.id = entry.id;
    row.dataset.category = entry.category;

    const thumb = document.createElement('canvas');
    thumb.width = 96;
    thumb.height = 60;
    thumb.style.cssText = 'background:#060a12;border:1px solid #1c2534;image-rendering:pixelated;flex:none';

    const info = document.createElement('div');
    info.style.cssText = 'flex:1;min-width:0';
    const idLine = document.createElement('div');
    idLine.innerHTML = `<b style="color:#ffe9a8">${entry.id}</b> <span style="color:#8fa3c4">- ${entry.label}</span>`;
    const specLine = document.createElement('div');
    specLine.style.color = '#7d90b0';
    specLine.textContent = entry.spec;
    const srcLine = document.createElement('div');
    srcLine.className = 'cms-src';
    info.append(idLine, specLine, srcLine);

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:6px;flex:none';
    const uploadBtn = this.button('UPLOAD', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.addEventListener('change', () => {
        const f = input.files?.[0];
        if (f) void this.upload(entry, f);
      });
      input.click();
    });
    uploadBtn.className = 'cms-upload';
    const dlBtn = this.button('DOWNLOAD', () => void this.download(entry));
    const revertBtn = this.button('REVERT', () => void this.revert(entry));
    revertBtn.className = 'cms-revert';
    actions.append(uploadBtn, dlBtn, revertBtn);

    row.addEventListener('dragover', (e) => {
      e.preventDefault();
      row.style.borderColor = '#3fd9ff';
    });
    row.addEventListener('dragleave', () => {
      row.style.borderColor = '#39465e';
    });
    row.addEventListener('drop', (e) => {
      e.preventDefault();
      row.style.borderColor = '#39465e';
      const f = e.dataTransfer?.files?.[0];
      if (f) void this.upload(entry, f);
    });

    row.append(thumb, info, actions);
    this.rows.set(entry.id, row);
    this.refreshRow(entry);
    return row;
  }

  private refreshRow(entry: CatalogEntry): void {
    const row = this.rows.get(entry.id);
    if (!row) return;
    const source = assetSource(entry.id);
    const srcLine = row.querySelector('.cms-src');
    if (srcLine instanceof HTMLElement) {
      const remote = this.remote.get(entry.id);
      const badge =
        source === 'override'
          ? `<b style="color:#7de08a">BLOB OVERRIDE</b>${remote ? ` (${(remote.size / 1024).toFixed(1)}kb, ${remote.uploadedAt.slice(0, 19)})` : ''}`
          : source === 'bundled'
            ? '<b style="color:#ffd166">BUNDLED FILE</b>'
            : '<b style="color:#8fa3c4">PROCEDURAL</b>';
      srcLine.innerHTML = `source: ${badge}`;
    }
    const canUpload = this.apiState === 'ok';
    for (const sel of ['.cms-upload', '.cms-revert'] as const) {
      const btn = row.querySelector(sel);
      if (btn instanceof HTMLButtonElement) {
        btn.disabled = sel === '.cms-revert' ? !(canUpload && source === 'override') : !canUpload;
        btn.style.opacity = btn.disabled ? '0.35' : '1';
      }
    }
    void this.drawThumb(entry, row);
  }

  /** Render whatever the game would currently use into the row thumbnail. */
  private async drawThumb(entry: CatalogEntry, row: HTMLDivElement): Promise<void> {
    const thumb = row.querySelector('canvas');
    if (!(thumb instanceof HTMLCanvasElement)) return;
    const ctx = thumb.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, thumb.width, thumb.height);
    if (entry.category === 'masks' && assetSource(entry.id) === 'procedural') {
      ctx.fillStyle = '#7d90b0';
      ctx.font = '10px monospace';
      ctx.fillText('generated from', 6, 26);
      ctx.fillText('room blockers', 6, 38);
      return;
    }
    invalidateAsset(entry.id); // always show the CURRENT resolution
    const img = await loadImage(entry.id, entry.placeholder);
    const scale = Math.min(thumb.width / img.width, thumb.height / img.height, 3);
    const w = Math.max(1, Math.floor(img.width * scale));
    const h = Math.max(1, Math.floor(img.height * scale));
    try {
      ctx.drawImage(img, (thumb.width - w) / 2, (thumb.height - h) / 2, w, h);
    } catch {
      ctx.fillStyle = '#7d90b0';
      ctx.fillText('preview unavailable', 4, 30);
    }
  }

  /** Download the asset currently in use (procedural art rendered to PNG). */
  private async download(entry: CatalogEntry): Promise<void> {
    invalidateAsset(entry.id);
    const img = await loadImage(entry.id, entry.placeholder);
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    try {
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = entry.id.split('/').pop() ?? 'asset.png';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      }, 'image/png');
    } catch {
      this.renderBanner(`Could not export ${entry.id} (cross-origin image without CORS).`);
    }
  }

  // --- chrome ----------------------------------------------------------------

  private button(label: string, onClick: () => void): HTMLButtonElement {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText =
      'background:#16283c;color:#d8ecff;border:1px solid #3fd9ff;padding:4px 10px;cursor:pointer;font:12px monospace';
    b.addEventListener('click', onClick);
    return b;
  }

  private renderBanner(text: string): void {
    this.banner.textContent = text;
  }

  private refreshCounts(): void {
    const total = this.catalog.length;
    const overridden = this.catalog.filter((e) => assetSource(e.id) === 'override').length;
    this.counts.textContent = ` ${overridden}/${total} overridden`;
    this.counts.style.color = overridden > 0 ? '#7de08a' : '#8fa3c4';
  }

  private applyFilter(): void {
    for (const entry of this.catalog) {
      const row = this.rows.get(entry.id);
      if (!row) continue;
      const matchText =
        !this.filterText ||
        entry.id.toLowerCase().includes(this.filterText) ||
        entry.label.toLowerCase().includes(this.filterText);
      const matchCat = this.filterCategory === 'all' || entry.category === this.filterCategory;
      row.style.display = matchText && matchCat ? 'flex' : 'none';
    }
  }

  private close(): void {
    if (this.closed) return;
    this.closed = true;
    this.root.remove();
    this.game.popScene();
  }

  // --- Scene ------------------------------------------------------------------

  update(): void {
    const active = document.activeElement;
    const typing = active instanceof HTMLInputElement || active instanceof HTMLSelectElement;
    if (!typing && this.game.input.consumePress('Escape')) this.close();
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#04080f';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  }
}
