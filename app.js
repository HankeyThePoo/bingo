//#region \0vite/modulepreload-polyfill.js
(function polyfill() {
	const relList = document.createElement("link").relList;
	if (relList && relList.supports && relList.supports("modulepreload")) return;
	for (const link of document.querySelectorAll("link[rel=\"modulepreload\"]")) processPreload(link);
	new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			if (mutation.type !== "childList") continue;
			for (const node of mutation.addedNodes) if (node.tagName === "LINK" && node.rel === "modulepreload") processPreload(node);
		}
	}).observe(document, {
		childList: true,
		subtree: true
	});
	function getFetchOpts(link) {
		const fetchOpts = {};
		if (link.integrity) fetchOpts.integrity = link.integrity;
		if (link.referrerPolicy) fetchOpts.referrerPolicy = link.referrerPolicy;
		if (link.crossOrigin === "use-credentials") fetchOpts.credentials = "include";
		else if (link.crossOrigin === "anonymous") fetchOpts.credentials = "omit";
		else fetchOpts.credentials = "same-origin";
		return fetchOpts;
	}
	function processPreload(link) {
		if (link.ep) return;
		link.ep = true;
		const fetchOpts = getFetchOpts(link);
		fetch(link.href, fetchOpts);
	}
})();
var FRIDAY_ID = "its-friday";
var BINGO_LINES = [
	...Array.from({ length: 5 }, (_, row) => ({
		id: `row-${row}`,
		positions: Array.from({ length: 5 }, (_, column) => row * 5 + column)
	})),
	...Array.from({ length: 5 }, (_, column) => ({
		id: `column-${column}`,
		positions: Array.from({ length: 5 }, (_, row) => row * 5 + column)
	})),
	{
		id: "diagonal-down",
		positions: [
			0,
			6,
			12,
			18,
			24
		]
	},
	{
		id: "diagonal-up",
		positions: [
			4,
			8,
			12,
			16,
			20
		]
	}
];
function parseCatalog(value) {
	if (!Array.isArray(value)) throw new Error("The tile catalog must be an array.");
	const tiles = [];
	const ids = /* @__PURE__ */ new Set();
	for (const candidate of value) {
		if (!isRecord$1(candidate) || !hasExactKeys$1(candidate, ["id", "label"])) throw new Error("Every tile must contain exactly an id and label.");
		const { id, label } = candidate;
		if (typeof id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) || ids.has(id)) throw new Error("Tile IDs must be unique, lowercase slugs.");
		if (typeof label !== "string" || label.trim() !== label || label.length === 0 || label.length > 60) throw new Error("Tile labels must contain between 1 and 60 characters.");
		ids.add(id);
		tiles.push({
			id,
			label
		});
	}
	if (tiles.filter(({ id }) => id !== "its-friday").length < 24) throw new Error("The catalog needs at least 24 ordinary tiles.");
	const friday = tiles.find(({ id }) => id === FRIDAY_ID);
	if (!friday || friday.label !== "It's Friday") throw new Error("The catalog needs one It's Friday free tile.");
	return tiles;
}
function generateBoard(catalog, random = Math.random) {
	const ordinary = catalog.filter(({ id }) => id !== FRIDAY_ID).map(({ id }) => id);
	if (ordinary.length < 24) throw new Error("There are not enough ordinary tiles to create a board.");
	for (let index = ordinary.length - 1; index > 0; index -= 1) {
		const sample = random();
		if (!Number.isFinite(sample) || sample < 0 || sample >= 1) throw new Error("The random source must return a number from 0 up to 1.");
		const swapIndex = Math.floor(sample * (index + 1));
		[ordinary[index], ordinary[swapIndex]] = [ordinary[swapIndex], ordinary[index]];
	}
	const layout = ordinary.slice(0, 24);
	layout.splice(12, 0, FRIDAY_ID);
	return layout;
}
function createState(layout) {
	const marked = /* @__PURE__ */ new Set([12]);
	return {
		layout: [...layout],
		marked,
		completedLines: completedLineIds(marked)
	};
}
function restoreState(layout, marked) {
	const restoredMarked = new Set(marked);
	restoredMarked.add(12);
	return {
		layout: [...layout],
		marked: restoredMarked,
		completedLines: completedLineIds(restoredMarked)
	};
}
function toggleTile(state, index) {
	if (!Number.isInteger(index) || index < 0 || index >= 25 || index === 12) return {
		state,
		newlyCompletedLineIds: []
	};
	const marked = new Set(state.marked);
	if (marked.has(index)) marked.delete(index);
	else marked.add(index);
	marked.add(12);
	const completedLines = completedLineIds(marked);
	const newlyCompletedLineIds = [...completedLines].filter((lineId) => !state.completedLines.has(lineId));
	return {
		state: {
			layout: state.layout,
			marked,
			completedLines
		},
		newlyCompletedLineIds
	};
}
function completedLineIds(marked) {
	return new Set(BINGO_LINES.filter(({ positions }) => positions.every((position) => marked.has(position))).map(({ id }) => id));
}
function positionsForLines(lineIds) {
	const requested = new Set(lineIds);
	const positions = /* @__PURE__ */ new Set();
	for (const line of BINGO_LINES) {
		if (!requested.has(line.id)) continue;
		for (const position of line.positions) positions.add(position);
	}
	return positions;
}
function hasManualMarks(state) {
	return [...state.marked].some((index) => index !== 12);
}
function isRecord$1(value) {
	return !!value && typeof value === "object" && !Array.isArray(value);
}
function hasExactKeys$1(value, expected) {
	const actual = Object.keys(value).sort();
	const sortedExpected = [...expected].sort();
	return actual.length === sortedExpected.length && sortedExpected.every((key, index) => actual[index] === key);
}
//#endregion
//#region src/catalog-source.ts
async function loadCatalog(url, request = fetch) {
	const response = await request(url, { cache: "no-cache" });
	if (!response.ok) throw new Error(`Tile catalog request failed: ${response.status}`);
	return parseCatalog(await response.json());
}
//#endregion
//#region src/snapshot.ts
var SNAPSHOT_VERSION = 1;
var MAX_MARKED_MASK = 2 ** 25 - 1;
var MAX_PAYLOAD_LENGTH = 4096;
var COMPACT_PREFIX = "R1";
var COMPACT_LAYOUT_CELLS = 24;
var COMPACT_MARK_BITS = BigInt(COMPACT_LAYOUT_CELLS);
var COMPACT_MARK_MASK = (1n << COMPACT_MARK_BITS) - 1n;
var CATALOG_FINGERPRINT_MODULUS = 4096;
function stateToSnapshot(state) {
	let marked = 0;
	for (const position of state.marked) marked += 2 ** position;
	return {
		version: SNAPSHOT_VERSION,
		layout: [...state.layout],
		marked
	};
}
function parseSnapshot(value, catalog) {
	if (!isRecord(value) || !hasExactKeys(value, [
		"version",
		"layout",
		"marked"
	])) return null;
	if (value.version !== SNAPSHOT_VERSION || !Array.isArray(value.layout) || value.layout.length !== 25 || !Number.isSafeInteger(value.marked) || Number(value.marked) < 0 || Number(value.marked) > MAX_MARKED_MASK) return null;
	const catalogIds = new Set(catalog.map(({ id }) => id));
	const layout = [];
	const seen = /* @__PURE__ */ new Set();
	for (const id of value.layout) {
		if (typeof id !== "string" || !catalogIds.has(id) || seen.has(id)) return null;
		seen.add(id);
		layout.push(id);
	}
	if (layout[12] !== "its-friday" || layout.filter((id) => id === "its-friday").length !== 1) return null;
	const mask = Number(value.marked);
	if (Math.floor(mask / 2 ** 12) % 2 !== 1) return null;
	const marked = /* @__PURE__ */ new Set();
	for (let index = 0; index < 25; index += 1) if (Math.floor(mask / 2 ** index) % 2 === 1) marked.add(index);
	return restoreState(layout, marked);
}
function encodeState(state, catalog) {
	const ordinaryIds = compactCatalogIds(catalog);
	const available = [...ordinaryIds];
	let layoutRank = 0n;
	for (let index = 0; index < 25; index += 1) {
		if (index === 12) continue;
		const id = state.layout[index];
		const digit = id ? available.indexOf(id) : -1;
		if (digit < 0) throw new Error("The board cannot be encoded with this catalog.");
		layoutRank = layoutRank * BigInt(available.length) + BigInt(digit);
		available.splice(digit, 1);
	}
	let marked = 0n;
	let markedBit = 0n;
	for (let index = 0; index < 25; index += 1) {
		if (index === 12) continue;
		if (state.marked.has(index)) marked |= 1n << markedBit;
		markedBit += 1n;
	}
	const permutations = permutationCount(ordinaryIds.length, COMPACT_LAYOUT_CELLS);
	return `${COMPACT_PREFIX}${encodeBigInt(BigInt(catalogFingerprint(ordinaryIds)) * permutations + layoutRank << COMPACT_MARK_BITS | marked)}`;
}
function decodeState(payload, catalog) {
	if (payload.startsWith(COMPACT_PREFIX)) return decodeCompactState(payload.slice(2), catalog);
	return decodeLegacyState(payload, catalog);
}
function decodeLegacyState(payload, catalog) {
	try {
		if (payload.length === 0 || payload.length > MAX_PAYLOAD_LENGTH || !/^[A-Za-z0-9_-]+$/u.test(payload)) return null;
		const base64 = payload.replaceAll("-", "+").replaceAll("_", "/");
		const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
		const binary = atob(padded);
		const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
		return parseSnapshot(JSON.parse(new TextDecoder().decode(bytes)), catalog);
	} catch {
		return null;
	}
}
function decodeCompactState(payload, catalog) {
	try {
		const ordinaryIds = compactCatalogIds(catalog);
		const permutations = permutationCount(ordinaryIds.length, COMPACT_LAYOUT_CELLS);
		const packed = decodeBigInt(payload);
		if (packed === null) return null;
		const markedMask = packed & COMPACT_MARK_MASK;
		const catalogAndLayout = packed >> COMPACT_MARK_BITS;
		if (Number(catalogAndLayout / permutations) !== catalogFingerprint(ordinaryIds)) return null;
		let layoutRank = catalogAndLayout % permutations;
		const digits = new Array(COMPACT_LAYOUT_CELLS);
		for (let index = COMPACT_LAYOUT_CELLS - 1; index >= 0; index -= 1) {
			const radix = BigInt(ordinaryIds.length - index);
			digits[index] = Number(layoutRank % radix);
			layoutRank /= radix;
		}
		if (layoutRank !== 0n) return null;
		const available = [...ordinaryIds];
		const layout = digits.map((digit) => available.splice(digit, 1)[0]);
		layout.splice(12, 0, FRIDAY_ID);
		const marked = /* @__PURE__ */ new Set();
		let markedBit = 0n;
		for (let index = 0; index < 25; index += 1) {
			if (index === 12) {
				marked.add(index);
				continue;
			}
			if ((markedMask & 1n << markedBit) !== 0n) marked.add(index);
			markedBit += 1n;
		}
		return restoreState(layout, marked);
	} catch {
		return null;
	}
}
function compactCatalogIds(catalog) {
	const ids = catalog.filter(({ id }) => id !== FRIDAY_ID).map(({ id }) => id).sort();
	if (ids.length < COMPACT_LAYOUT_CELLS || new Set(ids).size !== ids.length) throw new Error("The catalog cannot be used for compact board identifiers.");
	return ids;
}
function permutationCount(size, count) {
	let result = 1n;
	for (let index = 0; index < count; index += 1) result *= BigInt(size - index);
	return result;
}
function catalogFingerprint(ids) {
	let hash = 2166136261;
	for (const character of ids.join("\0")) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
	return (hash >>> 0) % CATALOG_FINGERPRINT_MODULUS;
}
function encodeBigInt(value) {
	const bytes = [];
	do {
		bytes.unshift(Number(value & 255n));
		value >>= 8n;
	} while (value > 0n);
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}
function decodeBigInt(payload) {
	if (payload.length === 0 || payload.length > 64 || !/^[A-Za-z0-9_-]+$/u.test(payload)) return null;
	const base64 = payload.replaceAll("-", "+").replaceAll("_", "/");
	const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
	let value = 0n;
	for (const character of atob(padded)) value = value << 8n | BigInt(character.charCodeAt(0));
	return value;
}
function readBoardHash(hash, catalog) {
	const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
	if (!params.has("board")) return { kind: "none" };
	const state = decodeState(params.get("board") ?? "", catalog);
	return state ? {
		kind: "valid",
		state
	} : { kind: "invalid" };
}
function isRecord(value) {
	return !!value && typeof value === "object" && !Array.isArray(value);
}
function hasExactKeys(value, expected) {
	const actual = Object.keys(value).sort();
	const sortedExpected = [...expected].sort();
	return actual.length === sortedExpected.length && sortedExpected.every((key, index) => actual[index] === key);
}
//#endregion
//#region src/storage.ts
var STORAGE_KEY = "release-radar-bingo:board:v1";
function browserStorage() {
	try {
		return window.localStorage;
	} catch {
		return null;
	}
}
var BoardStorage = class {
	storage;
	constructor(storage = browserStorage()) {
		this.storage = storage;
	}
	load(catalog) {
		try {
			if (!this.storage) return null;
			const stored = this.storage.getItem(STORAGE_KEY);
			if (stored === null) return null;
			return parseSnapshot(JSON.parse(stored), catalog);
		} catch {
			return null;
		}
	}
	save(state) {
		try {
			if (!this.storage) return false;
			this.storage.setItem(STORAGE_KEY, JSON.stringify(stateToSnapshot(state)));
			return true;
		} catch {
			return false;
		}
	}
};
//#endregion
//#region src/view.ts
var BingoView = class {
	root;
	actions;
	shuffleButton;
	shareButton;
	shareLabel;
	boardCard;
	board;
	boardStatus;
	confirmation;
	confirmationCancel;
	confirmationConfirm;
	liveRegion;
	tilesById = /* @__PURE__ */ new Map();
	announcementFrame = 0;
	fitFrame = 0;
	shareFeedbackTimer = 0;
	shareFeedbackGeneration = 0;
	lastBoardWidth = 0;
	confirmationOpen = false;
	constructor(root) {
		this.root = root;
		root.innerHTML = markup();
		this.actions = this.required(".actions");
		this.shuffleButton = this.required(".shuffle-button");
		this.shareButton = this.required(".share-button");
		this.shareLabel = this.required(".share-label");
		this.boardCard = this.required(".board-card");
		this.board = this.required(".board");
		this.boardStatus = this.required(".board-status");
		this.confirmation = this.required(".shuffle-confirmation");
		this.confirmationCancel = this.required(".confirmation-cancel");
		this.confirmationConfirm = this.required(".confirmation-confirm");
		this.liveRegion = this.required(".live-region");
		if (typeof ResizeObserver !== "undefined") new ResizeObserver(([entry]) => {
			const width = entry?.contentRect.width ?? 0;
			if (width <= 0 || Math.abs(width - this.lastBoardWidth) < .5) return;
			this.lastBoardWidth = width;
			this.requestLabelFit();
		}).observe(this.board);
		else window.addEventListener("resize", () => this.requestLabelFit());
		document.fonts?.ready.then(() => this.requestLabelFit());
	}
	bind(handlers) {
		this.shuffleButton.addEventListener("click", handlers.shuffle);
		this.shareButton.addEventListener("click", handlers.share);
		this.board.addEventListener("click", (event) => {
			const target = event.target instanceof Element ? event.target.closest(".tile") : null;
			if (!target) return;
			handlers.toggleTile(Number(target.dataset.index));
		});
		this.confirmationCancel.addEventListener("click", () => {
			this.hideShuffleConfirmation(true);
		});
		this.confirmationConfirm.addEventListener("click", () => {
			this.hideShuffleConfirmation(true);
			handlers.confirmShuffle();
		});
		this.root.addEventListener("keydown", (event) => this.handleKeydown(event), true);
		this.root.addEventListener("pointerdown", () => {
			this.root.classList.remove("keyboard-input");
		});
		this.board.addEventListener("animationend", (event) => {
			if (!(event instanceof AnimationEvent)) return;
			const tile = event.target instanceof Element ? event.target.closest(".tile") : null;
			if (event.animationName === "bingo-deal" && tile?.dataset.index === String(24)) this.board.querySelectorAll(".is-dealing").forEach((element) => {
				element.classList.remove("is-dealing");
			});
			if (event.animationName === "bingo-winning-tile") tile?.classList.remove("is-celebrating");
		});
		this.boardCard.addEventListener("animationend", (event) => {
			if (event instanceof AnimationEvent && event.animationName === "bingo-card-glow") this.boardCard.classList.remove("is-celebrating");
		});
	}
	showReady(catalog, state, deal = true) {
		this.tilesById.clear();
		for (const tile of catalog) this.tilesById.set(tile.id, tile);
		this.boardStatus.hidden = true;
		this.board.hidden = false;
		this.boardCard.setAttribute("aria-busy", "false");
		this.shuffleButton.disabled = false;
		this.shareButton.disabled = false;
		this.renderBoard(state, deal);
	}
	showFailure() {
		this.board.hidden = true;
		this.boardStatus.hidden = false;
		this.boardStatus.textContent = "COULD NOT LOAD THE TILE CATALOG";
		this.boardCard.setAttribute("aria-busy", "false");
		this.shuffleButton.disabled = true;
		this.shareButton.disabled = true;
		this.announce("The tile catalog could not be loaded.");
	}
	renderBoard(state, deal) {
		const fragment = document.createDocumentFragment();
		state.layout.forEach((id, index) => {
			const tile = this.tilesById.get(id);
			if (!tile) return;
			const button = document.createElement("button");
			button.type = "button";
			button.className = "tile";
			button.dataset.index = String(index);
			button.style.setProperty("--deal-order", String(index));
			if (deal) button.classList.add("is-dealing");
			if (index === 12) {
				button.classList.add("free");
				button.setAttribute("aria-disabled", "true");
			}
			const inner = document.createElement("span");
			inner.className = "tile-inner";
			inner.setAttribute("aria-hidden", "true");
			inner.append(this.createFace("tile-face tile-front", tile.label), this.createFace("tile-face tile-back", tile.label));
			button.append(inner);
			fragment.append(button);
		});
		this.board.replaceChildren(fragment);
		this.updateState(state, []);
		this.requestLabelFit();
	}
	updateState(state, newlyCompletedLineIds) {
		const completedPositions = positionsForLines(state.completedLines);
		this.board.querySelectorAll(".tile").forEach((button, index) => {
			const tile = this.tilesById.get(state.layout[index] ?? "");
			if (!tile) return;
			const marked = state.marked.has(index);
			button.classList.toggle("marked", marked);
			button.classList.toggle("in-completed-line", completedPositions.has(index));
			button.setAttribute("aria-pressed", String(marked));
			button.setAttribute("aria-label", index === 12 ? "It's Friday, free space" : `${tile.label}, ${marked ? "marked" : "not marked"}`);
		});
		if (newlyCompletedLineIds.length) this.celebrate(newlyCompletedLineIds);
	}
	showShuffleConfirmation() {
		if (this.confirmationOpen) return;
		this.confirmationOpen = true;
		this.confirmation.hidden = false;
		this.confirmation.setAttribute("aria-hidden", "false");
		this.actions.inert = true;
		this.board.inert = true;
		this.confirmationCancel.focus({ preventScroll: true });
	}
	hideShuffleConfirmation(returnFocus) {
		if (!this.confirmationOpen) return;
		this.confirmationOpen = false;
		this.confirmation.hidden = true;
		this.confirmation.setAttribute("aria-hidden", "true");
		this.actions.inert = false;
		this.board.inert = false;
		if (returnFocus) this.shuffleButton.focus({ preventScroll: true });
	}
	showShareCopied() {
		if (this.shareFeedbackTimer) window.clearTimeout(this.shareFeedbackTimer);
		const generation = ++this.shareFeedbackGeneration;
		this.shareLabel.classList.remove("fading");
		this.shareLabel.textContent = "COPIED";
		this.shareFeedbackTimer = window.setTimeout(() => {
			this.shareFeedbackTimer = 0;
			this.swapShareLabel("SHARE", generation);
		}, 680);
	}
	announce(message) {
		cancelAnimationFrame(this.announcementFrame);
		this.announcementFrame = 0;
		this.liveRegion.textContent = "";
		if (!message) return;
		this.announcementFrame = requestAnimationFrame(() => {
			this.announcementFrame = 0;
			this.liveRegion.textContent = message;
		});
	}
	createFace(className, label) {
		const face = document.createElement("span");
		face.className = className;
		const text = document.createElement("span");
		text.className = "tile-label";
		text.textContent = label;
		face.append(text);
		return face;
	}
	swapShareLabel(text, generation) {
		if (this.shareLabel.textContent === text || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
			this.shareLabel.textContent = text;
			return;
		}
		this.shareLabel.classList.remove("fading");
		this.shareLabel.offsetWidth;
		this.shareLabel.classList.add("fading");
		window.setTimeout(() => {
			if (generation !== this.shareFeedbackGeneration) return;
			this.shareLabel.textContent = text;
			this.shareLabel.classList.remove("fading");
		}, 200);
	}
	celebrate(lineIds) {
		const winningPositions = [...positionsForLines(lineIds)].sort((left, right) => left - right);
		this.boardCard.classList.remove("is-celebrating");
		this.board.querySelectorAll(".tile.is-celebrating").forEach((tile) => {
			tile.classList.remove("is-celebrating");
		});
		this.boardCard.offsetWidth;
		winningPositions.forEach((position, order) => {
			const tile = this.board.querySelector(`[data-index="${position}"]`);
			if (!tile) return;
			tile.style.setProperty("--win-order", String(order));
			tile.classList.add("is-celebrating");
		});
		this.boardCard.classList.add("is-celebrating");
	}
	handleKeydown(event) {
		if (event.key === "Tab" || event.key.startsWith("Arrow")) this.root.classList.add("keyboard-input");
		if (!this.confirmationOpen) return;
		if (event.key === "Escape") {
			event.preventDefault();
			this.hideShuffleConfirmation(true);
			return;
		}
		if (event.key !== "Tab") return;
		const first = this.confirmationCancel;
		const last = this.confirmationConfirm;
		if (event.shiftKey && document.activeElement === first) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && document.activeElement === last) {
			event.preventDefault();
			first.focus();
		}
	}
	requestLabelFit() {
		cancelAnimationFrame(this.fitFrame);
		this.fitFrame = requestAnimationFrame(() => {
			this.fitFrame = 0;
			this.fitLabels();
		});
	}
	fitLabels() {
		const buttons = this.board.querySelectorAll(".tile");
		for (const button of buttons) {
			const face = button.querySelector(".tile-front");
			const labels = button.querySelectorAll(".tile-label");
			const measure = labels[0];
			if (!face || !measure || face.clientWidth <= 0 || face.clientHeight <= 0) continue;
			const styles = getComputedStyle(face);
			const availableWidth = face.clientWidth - (Number.parseFloat(styles.paddingLeft) || 0) - (Number.parseFloat(styles.paddingRight) || 0);
			const availableHeight = face.clientHeight - (Number.parseFloat(styles.paddingTop) || 0) - (Number.parseFloat(styles.paddingBottom) || 0);
			let low = 6;
			let high = Math.min(availableWidth, availableHeight);
			labels.forEach((label) => {
				label.style.width = `${availableWidth}px`;
			});
			for (let attempt = 0; attempt < 10; attempt += 1) {
				const candidate = (low + high) / 2;
				measure.style.fontSize = `${candidate}px`;
				if (measure.scrollWidth <= availableWidth + .5 && measure.scrollHeight <= availableHeight + .5) low = candidate;
				else high = candidate;
			}
			const fitted = `${Math.floor(low * 10) / 10}px`;
			labels.forEach((label) => {
				label.style.fontSize = fitted;
			});
		}
	}
	required(selector) {
		const element = this.root.querySelector(selector);
		if (!element) throw new Error(`Missing Bingo element: ${selector}`);
		return element;
	}
};
function markup() {
	return `
    <main class="bingo-shell">
      <h1>RELEASE RADAR&#10022;</h1>
      <div class="actions" aria-label="Board actions">
        <button class="button shuffle-button" type="button" disabled>SHUFFLE</button>
        <button class="button share-button" type="button" disabled><span class="share-label">SHARE</span></button>
      </div>
      <section class="board-card glass" aria-busy="true">
        <p class="board-status" role="status">LOADING TILES&hellip;</p>
        <div class="board" role="group" aria-label="Release Radar bingo board" hidden></div>
        <div class="shuffle-confirmation" role="dialog" aria-modal="true" aria-labelledby="bingo-shuffle-title" aria-describedby="bingo-shuffle-warning" aria-hidden="true" hidden>
          <div class="confirmation-panel glass">
            <strong id="bingo-shuffle-title">SHUFFLE YOUR BOARD?</strong>
            <span id="bingo-shuffle-warning">YOUR CURRENT MARKS WILL BE LOST.</span>
            <div class="confirmation-actions">
              <button class="button confirmation-cancel" type="button">CANCEL</button>
              <button class="button confirmation-confirm" type="button">SHUFFLE</button>
            </div>
          </div>
        </div>
      </section>
      <p class="sr-only live-region" aria-live="polite" aria-atomic="true"></p>
    </main>
  `;
}
//#endregion
//#region src/main.ts
var root = document.querySelector("#release-radar-bingo");
if (root && !root.dataset.bingoReady) {
	root.dataset.bingoReady = "true";
	const view = new BingoView(root);
	const storage = new BoardStorage();
	let catalog = [];
	let state = null;
	let persistenceFailureAnnounced = false;
	view.bind({
		shuffle: () => {
			if (!state) return;
			if (hasManualMarks(state)) view.showShuffleConfirmation();
			else shuffleBoard();
		},
		confirmShuffle: () => shuffleBoard(),
		share: () => void shareBoard(),
		toggleTile: (index) => markTile(index)
	});
	window.addEventListener("hashchange", restoreSharedBoard);
	bootstrap();
	async function bootstrap() {
		try {
			const moduleUrl = new URL(import.meta.url);
			const catalogUrl = new URL("tiles.json", moduleUrl);
			catalogUrl.search = moduleUrl.search;
			catalog = await loadCatalog(catalogUrl);
			const shared = readBoardHash(window.location.hash, catalog);
			let announcement = "";
			if (shared.kind === "valid") {
				state = shared.state;
				announcement = "A shared Release Radar board was loaded.";
			} else {
				const saved = storage.load(catalog);
				state = saved ?? createState(generateBoard(catalog));
				if (shared.kind === "invalid") {
					announcement = saved ? "The shared board link was invalid. Your saved board was restored." : "The shared board link was invalid. A new board was created.";
					clearInvalidBoardHash();
				}
			}
			if (!storage.save(state)) {
				persistenceFailureAnnounced = true;
				announcement = [announcement, "Board changes cannot be saved in this browser."].filter(Boolean).join(" ");
			}
			view.showReady(catalog, state);
			if (announcement) view.announce(announcement);
		} catch {
			view.showFailure();
		}
	}
	function markTile(index) {
		if (!state) return;
		if (index === 12) {
			view.announce("It's Friday is the free space.");
			return;
		}
		const tile = catalog.find(({ id }) => id === state?.layout[index]);
		if (!tile) return;
		const result = toggleTile(state, index);
		state = result.state;
		view.updateState(state, result.newlyCompletedLineIds);
		const saved = storage.save(state);
		const marked = state.marked.has(index);
		let announcement = result.newlyCompletedLineIds.length ? `Bingo! ${result.newlyCompletedLineIds.length === 1 ? "One line" : `${result.newlyCompletedLineIds.length} lines`} completed.` : `${tile.label} ${marked ? "marked" : "unmarked"}.`;
		if (!saved && !persistenceFailureAnnounced) {
			persistenceFailureAnnounced = true;
			announcement += " Board changes cannot be saved in this browser.";
		}
		view.announce(announcement);
	}
	function shuffleBoard() {
		if (!state) return;
		const previous = state.layout;
		const previousIds = new Set(previous);
		const canChangeTileSet = catalog.length - 1 > previous.length - 1;
		let layout = generateBoard(catalog);
		for (let attempt = 0; attempt < 12; attempt += 1) {
			const layoutChanged = layout.some((id, index) => id !== previous[index]);
			const tileSetChanged = layout.some((id) => !previousIds.has(id));
			if (layoutChanged && (!canChangeTileSet || tileSetChanged)) break;
			layout = generateBoard(catalog);
		}
		state = createState(layout);
		view.renderBoard(state, true);
		const saved = storage.save(state);
		let announcement = "A new Release Radar board was shuffled.";
		if (!saved && !persistenceFailureAnnounced) {
			persistenceFailureAnnounced = true;
			announcement += " Board changes cannot be saved in this browser.";
		}
		view.announce(announcement);
	}
	async function shareBoard() {
		if (!state) return;
		const copied = await copyText(encodeState(state, catalog));
		if (copied) view.showShareCopied();
		view.announce(copied ? "The board identifier was copied." : "The board identifier could not be copied.");
	}
	function restoreSharedBoard() {
		if (!state || catalog.length === 0) return;
		const shared = readBoardHash(window.location.hash, catalog);
		if (shared.kind === "none") return;
		if (shared.kind === "invalid") {
			clearInvalidBoardHash();
			view.announce("The shared board link was invalid. Your current board was kept.");
			return;
		}
		state = shared.state;
		view.renderBoard(state, true);
		const saved = storage.save(state);
		let announcement = "A shared Release Radar board was loaded.";
		if (!saved && !persistenceFailureAnnounced) {
			persistenceFailureAnnounced = true;
			announcement += " Board changes cannot be saved in this browser.";
		}
		view.announce(announcement);
	}
}
async function copyText(text) {
	try {
		if (!navigator.clipboard) return false;
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		return false;
	}
}
function clearInvalidBoardHash() {
	try {
		const url = new URL(window.location.href);
		const params = new URLSearchParams(url.hash.slice(1));
		params.delete("board");
		url.hash = params.toString();
		window.history.replaceState(null, "", url);
	} catch {}
}
//#endregion
