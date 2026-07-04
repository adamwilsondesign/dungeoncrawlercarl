/**
 * The admin room editor (P18): a hidden, placement-only authoring overlay.
 * Opened with Shift+E inside a room when the per-browser admin flag is on
 * (title-screen bottom-left corner / CMS button). Pushed on top of the
 * RoomScene, which freezes underneath (scripts, autosave, radial, hover and
 * world clicks all pause because only the top scene updates).
 *
 * The editor moves/scales/re-z-orders props and can add registry props or
 * hide authored ones. It NEVER touches verbs, names, art paths, or blocker
 * geometry - those are code-authored content. Edits build a RoomLayout
 * override object (layouts/<roomId>.json in Blob storage, same admin token
 * as the CMS) applied on top of RoomDefs at room load for every player.
 */

import { propDesigns } from '../data/propArt';
import type {
  EditorAddedProp,
  PropDef,
  PropPlacementOverride,
  Rect,
  RoomLayout,
} from '../data/types';
import { drawPixelText } from './assets';
import type { Game, Scene } from './game';
import {
  ADMIN_TOKEN_KEY,
  addedPropToDef,
  getRoomLayout,
  mergePropDef,
  probeLayoutsApi,
  saveRoomLayout,
} from './layouts';
import type { RuntimeProp } from './props';
import { LOGICAL_H, LOGICAL_W } from './renderer';
import type { Room } from './room';

type Tool = 'move' | 'scale' | 'z' | 'add';

interface WorkingLayout {
  overrides: Record<string, PropPlacementOverride>;
  added: EditorAddedProp[];
}

const cloneWorking = (w: WorkingLayout): WorkingLayout => ({
  overrides: Object.fromEntries(Object.entries(w.overrides).map(([k, v]) => [k, { ...v }])),
  added: w.added.map((a) => ({ ...a })),
});

/** Scale-handle hit slop around the art's top-left corner, in logical px. */
const HANDLE_R = 5;

export class EditorScene implements Scene {
  private readonly game: Game;
  private readonly room: Room;
  private readonly roomId: string;

  private working: WorkingLayout = { overrides: {}, added: [] };
  private lastSaved: WorkingLayout = { overrides: {}, added: [] };
  private dirty = false;
  private api: 'checking' | 'ok' | 'offline' = 'checking';

  private tool: Tool = 'move';
  private selectedId: string | null = null;
  private drag: { kind: 'move'; dx: number; dy: number } | { kind: 'scale' } | null = null;
  private showBands = false;
  private showGrid = false;
  private closed = false;

  // DOM panel (CMS-style overlay chrome; left side, collapsible)
  private readonly root: HTMLDivElement;
  private readonly banner: HTMLDivElement;
  private readonly listEl: HTMLDivElement;
  private readonly hudEl: HTMLDivElement;
  private readonly addForm: HTMLDivElement;
  private readonly addIdInput: HTMLInputElement;
  private readonly addArtSelect: HTMLSelectElement;
  private readonly toolButtons = new Map<Tool, HTMLButtonElement>();
  private readonly body: HTMLDivElement;

  constructor(game: Game, room: Room) {
    this.game = game;
    this.room = room;
    this.roomId = room.def.id;

    this.root = document.createElement('div');
    this.root.className = 'dcc-ui';
    this.root.style.cssText = [
      'position:fixed', 'left:0', 'top:0', 'bottom:0', 'width:280px', 'z-index:40',
      'background:rgba(6,10,20,0.92)', 'color:var(--dcc-text-primary)', 'font-size:13px',
      'display:flex', 'flex-direction:column', 'gap:8px', 'padding:12px',
      'box-sizing:border-box', 'border-right:2px solid var(--dcc-border)', 'cursor:auto',
    ].join(';');

    const header = document.createElement('div');
    header.style.cssText = 'display:flex;gap:6px;align-items:center;flex-wrap:wrap';
    const title = document.createElement('strong');
    title.textContent = `ROOM EDITOR - ${this.roomId}`;
    title.style.color = '#ff8ab4';
    header.append(
      title,
      this.button('SAVE', () => void this.save(), 'editor-save'),
      this.button('RESET', () => this.reset()),
      this.button('TOKEN', () => {
        const t = window.prompt('Admin token:', localStorage.getItem(ADMIN_TOKEN_KEY) ?? '');
        if (t !== null) localStorage.setItem(ADMIN_TOKEN_KEY, t);
      }),
      this.button('HIDE PANEL', () => {
        this.body.style.display = this.body.style.display === 'none' ? 'flex' : 'none';
      }),
      this.button('CLOSE (ESC)', () => this.requestClose()),
    );

    this.banner = document.createElement('div');
    this.banner.style.cssText = 'padding:4px 8px;border:1px solid #39465e;background:#101826;min-height:16px';

    // Collapsible body: toolbar + add form + list + HUD.
    this.body = document.createElement('div');
    this.body.style.cssText = 'display:flex;flex-direction:column;gap:6px;flex:1;min-height:0';

    const tools = document.createElement('div');
    tools.style.cssText = 'display:flex;gap:4px;flex-wrap:wrap';
    const toolBtn = (t: Tool, label: string): HTMLButtonElement => {
      const b = this.button(label, () => this.setTool(t));
      this.toolButtons.set(t, b);
      return b;
    };
    tools.append(
      toolBtn('move', 'MOVE'),
      toolBtn('scale', 'SCALE'),
      toolBtn('z', 'Z-ADJUST'),
      toolBtn('add', 'ADD PROP'),
    );
    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:4px;flex-wrap:wrap';
    actions.append(
      this.button('DELETE OVERRIDE', () => this.deleteOverride()),
      this.button('HIDE PROP', () => this.toggleRemoved()),
      this.button('ENABLED ON/OFF', () => this.toggleEnabled()),
      this.button('CLEAR Z', () => this.clearZ()),
      this.button('BANDS (B)', () => (this.showBands = !this.showBands)),
      this.button('GRID (G)', () => (this.showGrid = !this.showGrid)),
    );

    // Add-from-registry form (visible in ADD tool).
    this.addForm = document.createElement('div');
    this.addForm.style.cssText = 'display:none;gap:4px;flex-direction:column;border:1px solid #39465e;padding:6px;background:#0c1220';
    this.addArtSelect = document.createElement('select');
    this.addArtSelect.style.cssText = 'background:#101826;color:#d8ecff;border:1px solid #39465e;padding:3px';
    for (const key of Object.keys(propDesigns).filter((k) => k !== '__empty__').sort()) {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = key;
      this.addArtSelect.appendChild(opt);
    }
    const custom = document.createElement('option');
    custom.value = '';
    custom.textContent = '(custom asset id below)';
    this.addArtSelect.appendChild(custom);
    const customArt = document.createElement('input');
    customArt.placeholder = 'custom art: props/<name>.png';
    customArt.style.cssText = 'background:#101826;color:#d8ecff;border:1px solid #39465e;padding:3px';
    this.addIdInput = document.createElement('input');
    this.addIdInput.placeholder = 'new prop id (a-z0-9_)';
    this.addIdInput.style.cssText = 'background:#101826;color:#d8ecff;border:1px solid #39465e;padding:3px';
    const placeBtn = this.button('PLACE AT CURSOR / CENTER', () => {
      const art = this.addArtSelect.value || customArt.value.trim();
      void this.placeNewProp(this.addIdInput.value.trim(), art);
    });
    this.addForm.append(this.addArtSelect, customArt, this.addIdInput, placeBtn);

    this.listEl = document.createElement('div');
    this.listEl.style.cssText = 'overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:3px;min-height:60px';

    this.hudEl = document.createElement('div');
    this.hudEl.style.cssText = 'border:1px solid #39465e;background:#0c1220;padding:6px;white-space:pre-wrap;color:#a8bad4';

    this.body.append(tools, actions, this.addForm, this.listEl, this.hudEl);
    this.root.append(header, this.banner, this.body);
    document.body.appendChild(this.root);

    this.setTool('move');
    this.setBanner('Loading layout...');
    void this.init();
  }

  private async init(): Promise<void> {
    const saved = await getRoomLayout(this.roomId);
    if (saved) {
      this.working = cloneWorking({ overrides: saved.overrides, added: saved.added });
      this.lastSaved = cloneWorking(this.working);
    }
    this.api = (await probeLayoutsApi()) === 'ok' ? 'ok' : 'offline';
    this.setBanner(
      this.api === 'ok'
        ? `Connected. ${saved ? 'Saved layout loaded.' : 'No saved layout yet.'} Placement-only: verbs/name/art stay code-authored.`
        : 'Layouts API unreachable (plain `npm run dev` / offline). Editing works; SAVE is disabled.',
    );
    this.refreshList();
    this.refreshHud();
  }

  // --- model -----------------------------------------------------------------

  private baseDef(id: string): PropDef | undefined {
    return this.room.def.props?.find((p) => p.id === id);
  }

  private addedEntry(id: string): EditorAddedProp | undefined {
    return this.working.added.find((a) => a.id === id);
  }

  private listIds(): string[] {
    const ids = (this.room.def.props ?? []).map((p) => p.id);
    for (const a of this.working.added) if (!ids.includes(a.id)) ids.push(a.id);
    return ids;
  }

  /** The def the room should currently build for this id (null = hidden). */
  private effectiveDef(id: string): PropDef | null {
    const base = this.baseDef(id);
    if (base) {
      const o = this.working.overrides[id];
      if (o?.removed) return null;
      return mergePropDef(base, o);
    }
    const a = this.addedEntry(id);
    return a ? addedPropToDef(a) : null;
  }

  /** Current numbers shown in the HUD / used as nudge baselines. */
  private placementOf(id: string): { x: number; y: number; scale: number; z: number; zOverride?: number } | null {
    const def = this.effectiveDef(id) ?? this.baseDef(id) ?? null;
    if (!def) {
      const a = this.addedEntry(id);
      if (!a) return null;
      return { x: a.x, y: a.y, scale: a.scale ?? 1, z: a.zOverride ?? a.y, zOverride: a.zOverride };
    }
    return {
      x: def.x,
      y: def.y,
      scale: def.scale ?? 1,
      z: def.zOverride ?? def.y,
      zOverride: def.zOverride,
    };
  }

  private patch(id: string, patch: PropPlacementOverride): void {
    const added = this.addedEntry(id);
    if (added) {
      if (patch.x !== undefined) added.x = patch.x;
      if (patch.y !== undefined) added.y = patch.y;
      if (patch.scale !== undefined) added.scale = patch.scale;
      if (patch.zOverride !== undefined) {
        if (patch.zOverride === null) delete added.zOverride;
        else added.zOverride = patch.zOverride;
      }
    } else {
      if (!this.baseDef(id)) return;
      const o = (this.working.overrides[id] ??= {});
      if (patch.x !== undefined) o.x = patch.x;
      if (patch.y !== undefined) o.y = patch.y;
      if (patch.scale !== undefined) o.scale = patch.scale;
      if (patch.enabled !== undefined) o.enabled = patch.enabled;
      if (patch.zOverride !== undefined) {
        // null = "explicitly clear the author's zOverride"; if the author
        // never set one, clearing just drops the field entirely.
        if (patch.zOverride === null && this.baseDef(id)?.zOverride === undefined) {
          delete o.zOverride;
        } else o.zOverride = patch.zOverride;
      }
      this.pruneOverride(id);
    }
    this.dirty = true;
    this.rebuild(id);
  }

  /** Drop override entries that no longer override anything. */
  private pruneOverride(id: string): void {
    const o = this.working.overrides[id];
    const base = this.baseDef(id);
    if (!o || !base) return;
    if (o.x === base.x) delete o.x;
    if (o.y === base.y) delete o.y;
    if (o.scale === (base.scale ?? 1) || (o.scale === 1 && base.scale === undefined)) delete o.scale;
    if (o.zOverride === base.zOverride) delete o.zOverride;
    if (o.enabled === (base.enabled !== false)) delete o.enabled;
    if (Object.keys(o).length === 0) delete this.working.overrides[id];
  }

  /** Re-apply one prop's effective def to the live room. */
  private rebuild(id: string): void {
    const def = this.effectiveDef(id);
    const live = this.room.findProp(id);
    if (!def) {
      if (live) this.room.removePropLive(id);
    } else if (live) {
      const wasEnabled = live.enabled;
      const next = this.room.rebuildPropSync(def);
      // Keep the flag-driven live state unless the editor overrode enabled.
      const o = this.working.overrides[id];
      if (next) next.enabled = o?.enabled !== undefined ? o.enabled : wasEnabled;
    } else {
      void this.room.addPropLive(def).then(() => {
        this.refreshList();
        this.refreshHud();
      });
    }
    this.refreshList();
    this.refreshHud();
  }

  /** Sync every prop to the working layout (reset / discard paths). */
  private reapplyAll(): void {
    const valid = new Set(this.listIds().filter((id) => this.effectiveDef(id) !== null));
    for (const p of [...this.room.props]) {
      if (p.sourceDef && !valid.has(p.id)) this.room.removePropLive(p.id);
    }
    for (const id of this.listIds()) {
      const def = this.effectiveDef(id);
      if (!def) continue;
      if (this.room.findProp(id)) this.room.rebuildPropSync(def);
      else void this.room.addPropLive(def);
    }
    this.refreshList();
    this.refreshHud();
  }

  // --- toolbar actions ---------------------------------------------------------

  private setTool(t: Tool): void {
    this.tool = t;
    this.drag = null;
    this.addForm.style.display = t === 'add' ? 'flex' : 'none';
    for (const [tool, btn] of this.toolButtons) {
      btn.style.background = tool === t ? '#2d4a6b' : '#16283c';
      btn.style.borderColor = tool === t ? '#ff8ab4' : '#3fd9ff';
    }
  }

  private async placeNewProp(id: string, artDesign: string): Promise<void> {
    if (!/^[a-z0-9_]{1,40}$/.test(id)) {
      this.flash('New prop id must be a-z, 0-9, _ (1-40 chars).');
      return;
    }
    if (!artDesign) {
      this.flash('Pick a registered design or type a custom art id.');
      return;
    }
    if (this.listIds().includes(id) || this.room.findProp(id)) {
      this.flash(`Id "${id}" already exists in this room.`);
      return;
    }
    const m = this.game.input.mouse;
    const inRoom = m.x >= 0 && m.x < LOGICAL_W && m.y >= 0 && m.y < LOGICAL_H;
    const entry: EditorAddedProp = {
      id,
      artDesign,
      x: inRoom ? Math.round(m.x) : Math.round(LOGICAL_W / 2),
      y: inRoom ? Math.round(m.y) : 120,
    };
    this.working.added.push(entry);
    this.dirty = true;
    await this.room.addPropLive(addedPropToDef(entry));
    this.selectedId = id;
    this.setTool('move');
    this.flash(`Added "${id}" (decoration; make it interactive in code later).`);
    this.refreshList();
    this.refreshHud();
  }

  /** Revert an authored prop to its RoomDef default / remove an added prop. */
  private deleteOverride(): void {
    const id = this.selectedId;
    if (!id) return this.flash('Select a prop first.');
    if (this.addedEntry(id)) {
      this.working.added = this.working.added.filter((a) => a.id !== id);
      this.room.removePropLive(id);
      this.selectedId = null;
      this.flash(`Removed editor-added prop "${id}".`);
    } else if (this.working.overrides[id]) {
      delete this.working.overrides[id];
      this.rebuild(id);
      this.flash(`"${id}" reverted to its authored placement.`);
    } else {
      this.flash(`"${id}" has no override - already as authored.`);
      return;
    }
    this.dirty = true;
    this.refreshList();
    this.refreshHud();
  }

  /** removed:true - hide an authored prop entirely (editor's soft delete). */
  private toggleRemoved(): void {
    const id = this.selectedId;
    if (!id) return this.flash('Select a prop first.');
    if (this.addedEntry(id)) return this.flash('Added props: use DELETE OVERRIDE to remove.');
    if (!this.baseDef(id)) return;
    const o = (this.working.overrides[id] ??= {});
    if (o.removed) {
      delete o.removed;
      this.pruneOverride(id);
      this.flash(`"${id}" restored.`);
    } else {
      o.removed = true;
      this.flash(`"${id}" hidden (removed:true).`);
    }
    this.dirty = true;
    this.rebuild(id);
  }

  private toggleEnabled(): void {
    const id = this.selectedId;
    if (!id) return this.flash('Select a prop first.');
    if (this.addedEntry(id)) return this.flash('Added props have no enabled override.');
    const def = this.effectiveDef(id);
    if (!def) return this.flash('Prop is hidden - restore it first.');
    this.patch(id, { enabled: !(def.enabled !== false) });
    this.flash(`"${id}" initial-enabled override: ${def.enabled !== false ? 'OFF' : 'ON'}.`);
  }

  private clearZ(): void {
    const id = this.selectedId;
    if (!id) return this.flash('Select a prop first.');
    this.patch(id, { zOverride: null });
    this.flash(`"${id}" z returns to baseline sort.`);
  }

  private reset(): void {
    this.working = cloneWorking(this.lastSaved);
    this.dirty = false;
    this.reapplyAll();
    this.flash('Unsaved changes discarded (back to last saved layout).');
  }

  private async save(): Promise<void> {
    if (this.api !== 'ok') {
      this.flash('SAVE disabled: layouts API unreachable (deploy / vercel dev).');
      return;
    }
    for (const id of Object.keys(this.working.overrides)) this.pruneOverride(id);
    const layout: RoomLayout = {
      version: 1,
      roomId: this.roomId,
      updatedAt: Date.now(),
      overrides: cloneWorking(this.working).overrides,
      added: cloneWorking(this.working).added,
    };
    this.setBanner('Saving layout...');
    const res = await saveRoomLayout(layout);
    if (res.ok) {
      this.lastSaved = cloneWorking(this.working);
      this.dirty = false;
      this.setBanner(`Saved layouts/${this.roomId}.json - live for everyone on next room load.`);
    } else {
      this.flash(`Save failed: ${res.error ?? 'unknown error'}`);
    }
    this.refreshList();
  }

  private requestClose(): void {
    if (this.closed) return;
    if (this.dirty) {
      if (!window.confirm('Discard unsaved layout changes?')) return;
      this.working = cloneWorking(this.lastSaved);
      this.reapplyAll();
    }
    this.closed = true;
    this.root.remove();
    this.game.popScene();
  }

  // --- selection & canvas input --------------------------------------------------

  /** Editable props under the point, topmost (highest z) first. */
  private editableAt(p: { x: number; y: number }): RuntimeProp | null {
    const hits = this.room.props
      .filter((rp) => rp.sourceDef !== null)
      .filter((rp) => {
        const r = rp.artBounds ?? rp.bounds;
        return p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
      })
      .sort((a, b) => b.z - a.z);
    return hits[0] ?? null;
  }

  update(): void {
    const input = this.game.input;
    const typing =
      document.activeElement instanceof HTMLInputElement ||
      document.activeElement instanceof HTMLSelectElement;

    if (!typing && input.consumePress('Escape')) {
      this.requestClose();
      return;
    }
    if (typing) {
      input.clearClicks();
      return;
    }
    input.clearRightClicks();

    if (input.consumePress('KeyB')) this.showBands = !this.showBands;
    if (input.consumePress('KeyG')) this.showGrid = !this.showGrid;

    const mouse = input.mouse;
    const click = input.consumeClick();
    if (click) {
      const hit = this.editableAt(click);
      const sel = this.selectedId ? this.placementOf(this.selectedId) : null;
      // Scale tool: grabbing the top-left handle of the selected prop wins.
      const selProp = this.selectedId ? this.room.findProp(this.selectedId) : null;
      const handle = selProp?.artBounds;
      if (
        this.tool === 'scale' &&
        sel &&
        handle &&
        Math.abs(click.x - handle.x) <= HANDLE_R &&
        Math.abs(click.y - handle.y) <= HANDLE_R
      ) {
        this.drag = { kind: 'scale' };
      } else if (hit) {
        this.selectedId = hit.id;
        this.refreshList();
        this.refreshHud();
        const placement = this.placementOf(hit.id);
        if (this.tool === 'move' && placement) {
          this.drag = { kind: 'move', dx: click.x - placement.x, dy: click.y - placement.y };
        }
      } else {
        this.drag = null;
      }
    }

    // Drags follow the held button.
    if (this.drag && input.mouseDown && this.selectedId) {
      const id = this.selectedId;
      if (this.drag.kind === 'move') {
        this.patch(id, {
          x: Math.round(Math.max(0, Math.min(LOGICAL_W - 1, mouse.x - this.drag.dx))),
          y: Math.round(Math.max(0, Math.min(LOGICAL_H - 1, mouse.y - this.drag.dy))),
        });
      } else {
        // Uniform scale from the top-left handle, baseline anchored: the
        // feet stay at (x, y); scale follows the cursor's height above them.
        const prop = this.room.findProp(id);
        const placement = this.placementOf(id);
        const img = prop?.imageRef;
        if (prop && placement && img && img.height > 0) {
          const depth = this.room.scaleAt(placement.y);
          const raw = img.height * depth;
          const next = Math.max(0.1, Math.min(8, (placement.y - mouse.y) / raw));
          this.patch(id, { scale: Math.round(next * 100) / 100 });
        }
      }
    } else if (!input.mouseDown) {
      this.drag = null;
    }

    // Keyboard nudges on the selection.
    const id = this.selectedId;
    if (!id) return;
    const placement = this.placementOf(id);
    if (!placement) return;
    const shift = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
    const step = shift ? 8 : 1;
    if (input.consumePress('ArrowLeft')) this.patch(id, { x: placement.x - step });
    if (input.consumePress('ArrowRight')) this.patch(id, { x: placement.x + step });
    if (input.consumePress('ArrowUp')) this.patch(id, { y: placement.y - step });
    if (input.consumePress('ArrowDown')) this.patch(id, { y: placement.y + step });
    if (input.consumePress('Equal') || input.consumePress('NumpadAdd')) {
      this.patch(id, { scale: Math.round((placement.scale + 0.05) * 100) / 100 });
    }
    if (input.consumePress('Minus') || input.consumePress('NumpadSubtract')) {
      this.patch(id, { scale: Math.max(0.1, Math.round((placement.scale - 0.05) * 100) / 100) });
    }
    if (input.consumePress('BracketLeft')) this.patch(id, { zOverride: Math.round(placement.z - step) });
    if (input.consumePress('BracketRight')) this.patch(id, { zOverride: Math.round(placement.z + step) });
  }

  // --- DOM panel refresh ---------------------------------------------------------

  private refreshList(): void {
    this.listEl.replaceChildren();
    for (const id of this.listIds()) {
      const row = document.createElement('div');
      const selected = id === this.selectedId;
      row.style.cssText =
        `display:flex;gap:6px;align-items:center;padding:2px 6px;cursor:pointer;` +
        `border:1px solid ${selected ? '#ff8ab4' : '#233045'};background:${selected ? '#22314a' : '#0c1220'}`;
      const thumb = document.createElement('canvas');
      thumb.width = 26;
      thumb.height = 20;
      thumb.style.cssText = 'width:26px;height:20px;background:#060a12;image-rendering:pixelated;flex:none';
      const img = this.room.findProp(id)?.imageRef;
      const tctx = thumb.getContext('2d');
      if (img && tctx) {
        tctx.imageSmoothingEnabled = false;
        const s = Math.min(26 / img.width, 20 / img.height, 2);
        tctx.drawImage(img, (26 - img.width * s) / 2, (20 - img.height * s) / 2, img.width * s, img.height * s);
      }
      const label = document.createElement('span');
      label.style.cssText = 'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
      label.textContent = id;
      const badge = document.createElement('span');
      badge.style.cssText = 'flex:none;font-size:10px';
      if (this.addedEntry(id)) {
        badge.textContent = 'ADDED';
        badge.style.color = '#7de08a';
      } else if (this.working.overrides[id]?.removed) {
        badge.textContent = 'HIDDEN';
        badge.style.color = '#ff6e6e';
      } else if (this.working.overrides[id]) {
        badge.textContent = 'OVERRIDE';
        badge.style.color = '#ffd166';
      }
      row.append(thumb, label, badge);
      row.addEventListener('click', () => {
        this.selectedId = id;
        this.refreshList();
        this.refreshHud();
      });
      this.listEl.appendChild(row);
    }
  }

  private refreshHud(): void {
    const id = this.selectedId;
    if (!id) {
      this.hudEl.textContent =
        'No selection. Click a prop or pick from the list.\n' +
        'Arrows: nudge (Shift=8px) | +/-: scale | [ ]: z | B/G: overlays';
      return;
    }
    const placement = this.placementOf(id);
    const base = this.baseDef(id);
    const added = this.addedEntry(id);
    const def = this.effectiveDef(id);
    const src = base ?? (added ? addedPropToDef(added) : null);
    const verbs = src && !src.decoration && src.verbs ? Object.keys(src.verbs).join('/') : '-';
    const art =
      src?.art.kind === 'procedural' ? `drawFn:${src.art.drawFn}` : src?.art.kind === 'image' ? src.art.path : '?';
    const lines = [
      `id: ${id}${added ? ' (editor-added)' : ''}${this.working.overrides[id]?.removed ? ' [HIDDEN]' : ''}`,
      placement
        ? `x:${placement.x} y:${placement.y} scale:${placement.scale.toFixed(2)}`
        : 'placement: -',
      placement
        ? `z:${Math.round(placement.z)}${placement.zOverride !== undefined ? ' (zOverride)' : ' (baseline)'}`
        : '',
      `enabled: ${def ? String(def.enabled !== false) : 'n/a (hidden)'}`,
      `-- read-only content --`,
      `name: ${src?.name ?? '-'}  decoration: ${src?.decoration === true}`,
      `art: ${art}`,
      `verbs: ${verbs}`,
      `blocker: ${src?.blocker ? `{${src.blocker.x},${src.blocker.y} ${src.blocker.w}x${src.blocker.h}} (follows baseline)` : 'none'}`,
    ];
    this.hudEl.textContent = lines.filter(Boolean).join('\n');
  }

  // --- canvas render ---------------------------------------------------------------

  render(ctx: CanvasRenderingContext2D): void {
    // Depth bands overlay
    if (this.showBands) {
      const palette = ['rgba(63,217,255,0.16)', 'rgba(255,209,102,0.16)', 'rgba(125,224,138,0.16)'];
      this.room.def.scaleBands.forEach((b, i) => {
        ctx.fillStyle = palette[i % palette.length];
        ctx.fillRect(0, b.yTop, LOGICAL_W, b.yBottom - b.yTop);
        drawPixelText(ctx, `x${b.scale.toFixed(2)}`, 4, b.yTop + 2, '#bdeeff');
      });
    }
    // Walk grid overlay (blocked cells shaded)
    if (this.showGrid) {
      ctx.fillStyle = 'rgba(255,80,80,0.28)';
      for (let cy = 0; cy < 50; cy++) {
        for (let cx = 0; cx < 80; cx++) {
          if (!this.room.grid.isWalkableCell(cx, cy)) ctx.fillRect(cx * 4, cy * 4, 4, 4);
        }
      }
    }

    const mouse = this.game.input.mouse;

    // Hover outline (editable props only)
    const hover = this.editableAt(mouse);
    if (hover && hover.id !== this.selectedId) {
      const r = hover.artBounds ?? hover.bounds;
      ctx.strokeStyle = '#3fd9ff';
      ctx.lineWidth = 1;
      ctx.strokeRect(r.x + 0.5, r.y + 0.5, Math.max(1, r.w - 1), Math.max(1, r.h - 1));
    }

    // Selection: ring + baseline + hit shape + blocker + handles
    const sel = this.selectedId ? this.room.findProp(this.selectedId) : null;
    const placement = this.selectedId ? this.placementOf(this.selectedId) : null;
    if (sel && placement) {
      const r = sel.artBounds ?? sel.bounds;
      ctx.strokeStyle = '#ffffff';
      ctx.setLineDash([3, 2]);
      ctx.strokeRect(r.x + 0.5, r.y + 0.5, Math.max(1, r.w - 1), Math.max(1, r.h - 1));
      ctx.setLineDash([]);
      // Baseline marker: cross + tick line at the anchor point
      ctx.strokeStyle = '#ffd166';
      ctx.beginPath();
      ctx.moveTo(placement.x - 5, placement.y + 0.5);
      ctx.lineTo(placement.x + 5, placement.y + 0.5);
      ctx.moveTo(placement.x + 0.5, placement.y - 4);
      ctx.lineTo(placement.x + 0.5, placement.y + 4);
      ctx.stroke();
      // Hit shape preview
      const shape = sel.outline;
      ctx.strokeStyle = '#ff8ab4';
      if (shape.polygon && shape.polygon.length >= 3) {
        ctx.beginPath();
        shape.polygon.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x + 0.5, p.y + 0.5) : ctx.lineTo(p.x + 0.5, p.y + 0.5)));
        ctx.closePath();
        ctx.stroke();
      } else if (shape.rect) {
        ctx.strokeRect(shape.rect.x + 0.5, shape.rect.y + 0.5, shape.rect.w - 1, shape.rect.h - 1);
      }
      // Blocker (read-only; follows the baseline)
      if (sel.blocker) {
        ctx.fillStyle = 'rgba(255,80,80,0.35)';
        const b: Rect = sel.blocker;
        ctx.fillRect(b.x, b.y, b.w, b.h);
      }
      // Scale handle at the art's top-left
      if (this.tool === 'scale' && sel.artBounds) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(sel.artBounds.x - 2, sel.artBounds.y - 2, 5, 5);
      }
    }

    // Top status line + crosshair cursor
    const status = `EDITOR ${this.tool.toUpperCase()}${this.dirty ? ' *' : ''}  ${
      this.selectedId ?? '(none)'
    }${placement ? `  x${placement.x} y${placement.y} s${placement.scale.toFixed(2)} z${Math.round(placement.z)}` : ''}`;
    ctx.fillStyle = 'rgba(6,10,20,0.85)';
    ctx.fillRect(0, 0, LOGICAL_W, 10);
    drawPixelText(ctx, status.slice(0, 76), 3, 2, '#ff8ab4');

    ctx.strokeStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(mouse.x - 4, mouse.y + 0.5);
    ctx.lineTo(mouse.x + 4, mouse.y + 0.5);
    ctx.moveTo(mouse.x + 0.5, mouse.y - 4);
    ctx.lineTo(mouse.x + 0.5, mouse.y + 4);
    ctx.stroke();
  }

  // --- chrome ------------------------------------------------------------------

  private button(label: string, onClick: () => void, cls?: string): HTMLButtonElement {
    const b = document.createElement('button');
    b.className = 'dcc-btn' + (cls ? ` ${cls}` : '');
    b.textContent = label;
    b.style.cssText += ';font-size:12px;padding:3px 8px';
    b.addEventListener('click', onClick);
    return b;
  }

  private setBanner(text: string): void {
    this.banner.textContent = text;
    this.banner.style.color = '#d8ecff';
    this.banner.style.borderColor = '#39465e';
  }

  private flash(text: string): void {
    this.setBanner(text);
    this.banner.style.borderColor = '#ffb46a';
    this.banner.style.color = '#ffb46a';
    window.setTimeout(() => {
      this.banner.style.borderColor = '#39465e';
      this.banner.style.color = '#d8ecff';
    }, 1400);
  }
}
