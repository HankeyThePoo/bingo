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
var freeTileIndex = Math.floor(25 / 2);
var fridayId = "its-friday";
var fridayLabel = "It's Friday";
var bingoLines = [
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
		positions: Array.from({ length: 5 }, (_, index) => index * 6)
	},
	{
		id: "diagonal-up",
		positions: Array.from({ length: 5 }, (_, index) => (index + 1) * 4)
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
	if (tiles.filter(({ id }) => id !== "its-friday").length < 24) throw new Error(`The catalog needs at least 24 ordinary tiles.`);
	const friday = tiles.find(({ id }) => id === fridayId);
	if (!friday || friday.label !== "It's Friday") throw new Error(`The catalog needs one ${fridayLabel} free tile.`);
	return tiles;
}
function generateBoard(catalog, random) {
	const ordinary = catalog.filter(({ id }) => id !== fridayId).map(({ id }) => id);
	if (ordinary.length < 24) throw new Error("There are not enough ordinary tiles to create a board.");
	for (let index = ordinary.length - 1; index > 0; index -= 1) {
		const sample = random();
		if (!Number.isFinite(sample) || sample < 0 || sample >= 1) throw new Error("The random source must return a number from 0 up to 1.");
		const swapIndex = Math.floor(sample * (index + 1));
		[ordinary[index], ordinary[swapIndex]] = [ordinary[swapIndex], ordinary[index]];
	}
	const layout = ordinary.slice(0, 24);
	layout.splice(freeTileIndex, 0, fridayId);
	return layout;
}
function createState(layout) {
	const marked = /* @__PURE__ */ new Set([freeTileIndex]);
	return {
		layout: [...layout],
		marked
	};
}
function restoreState(layout, marked) {
	const restoredMarked = new Set(marked);
	restoredMarked.add(freeTileIndex);
	return {
		layout: [...layout],
		marked: restoredMarked
	};
}
function toggleTile(state, index) {
	if (!Number.isInteger(index) || index < 0 || index >= 25 || index === freeTileIndex) throw new Error(`Invalid Bingo tile position: ${index}.`);
	const marked = new Set(state.marked);
	if (marked.has(index)) marked.delete(index);
	else marked.add(index);
	const previousLines = completedLineIds(state.marked);
	const completedLines = completedLineIds(marked);
	return {
		state: {
			layout: state.layout,
			marked
		},
		newlyCompletedLineIds: [...completedLines].filter((lineId) => !previousLines.has(lineId))
	};
}
function completedLineIds(marked) {
	return new Set(bingoLines.filter(({ positions }) => positions.every((position) => marked.has(position))).map(({ id }) => id));
}
function winningOpportunityPositions(marked) {
	const positions = /* @__PURE__ */ new Set();
	for (const line of bingoLines) {
		const missing = line.positions.filter((position) => !marked.has(position));
		if (missing.length === 1) positions.add(missing[0]);
	}
	return positions;
}
function positionsForLines(lineIds) {
	const requested = new Set(lineIds);
	const positions = /* @__PURE__ */ new Set();
	for (const line of bingoLines) {
		if (!requested.has(line.id)) continue;
		for (const position of line.positions) positions.add(position);
	}
	return positions;
}
function isRecord$1(value) {
	return !!value && typeof value === "object" && !Array.isArray(value);
}
function hasExactKeys$1(value, expected) {
	const actual = Object.keys(value).sort();
	const sortedExpected = [...expected].sort();
	return actual.length === sortedExpected.length && sortedExpected.every((key, index) => actual[index] === key);
}
var alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
var fingerprintLength = 2;
var identifierLength = fingerprintLength + 24 + 4;
function encodeState(state, catalog) {
	const ordinaryIds = compactCatalogIds(catalog);
	const seen = /* @__PURE__ */ new Set();
	let layoutIndexes = "";
	let markedMask = 0;
	for (let index = 0; index < 25; index += 1) {
		if (index === freeTileIndex) continue;
		const id = state.layout[index];
		const catalogIndex = id ? ordinaryIds.indexOf(id) : -1;
		if (!id || catalogIndex < 0 || seen.has(id)) throw new Error("The board cannot be encoded with this catalog.");
		seen.add(id);
		layoutIndexes += alphabet.charAt(catalogIndex);
		if (state.marked.has(index)) markedMask |= 1 << (index < freeTileIndex ? index : index - 1);
	}
	const fingerprint = catalogFingerprint(ordinaryIds);
	return alphabet.charAt(fingerprint >> 6) + alphabet.charAt(fingerprint & 63) + layoutIndexes + [
		18,
		12,
		6,
		0
	].map((shift) => alphabet.charAt(markedMask >>> shift & 63)).join("");
}
function decodeState(payload, catalog) {
	const ordinaryIds = compactCatalogIds(catalog);
	if (payload.length !== identifierLength) return null;
	const digits = [...payload].map((character) => alphabet.indexOf(character));
	if (digits.some((digit) => digit < 0)) return null;
	if (digits[0] * 64 + digits[1] !== catalogFingerprint(ordinaryIds)) return null;
	const layout = [];
	const seen = /* @__PURE__ */ new Set();
	for (let index = 0; index < 24; index += 1) {
		const catalogIndex = digits[fingerprintLength + index];
		if (catalogIndex >= ordinaryIds.length || seen.has(catalogIndex)) return null;
		layout.push(ordinaryIds[catalogIndex]);
		seen.add(catalogIndex);
	}
	layout.splice(freeTileIndex, 0, fridayId);
	let markedMask = 0;
	for (const digit of digits.slice(-4)) markedMask = markedMask * 64 + digit;
	const marked = /* @__PURE__ */ new Set();
	for (let index = 0; index < 25; index += 1) {
		if (index === freeTileIndex) continue;
		if ((markedMask & 1 << (index < freeTileIndex ? index : index - 1)) !== 0) marked.add(index);
	}
	return restoreState(layout, marked);
}
function compactCatalogIds(catalog) {
	return catalog.filter(({ id }) => id !== fridayId).map(({ id }) => id).sort();
}
function catalogFingerprint(ids) {
	let hash = 2166136261;
	for (const character of ids.join("\0")) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
	return (hash >>> 0) % 64 ** fingerprintLength;
}
var BingoController = class {
	catalogLoader;
	storage;
	location;
	view;
	copyToClipboard;
	random;
	catalog = [];
	state = null;
	persistenceFailureAnnounced = false;
	shareGeneration = 0;
	constructor(catalogLoader, storage, location, view, copyToClipboard, random = Math.random) {
		this.catalogLoader = catalogLoader;
		this.storage = storage;
		this.location = location;
		this.view = view;
		this.copyToClipboard = copyToClipboard;
		this.random = random;
	}
	bootstrap() {
		this.catalogLoader.load({
			onLoading: () => this.view.showLoading(),
			onLoaded: (catalog) => this.handleCatalogLoaded(catalog),
			onError: (error) => this.view.showFailure(error)
		});
	}
	handleCatalogLoaded(catalog) {
		this.catalog = catalog;
		const saved = this.storage.load(this.catalog);
		const shared = this.location.read(this.catalog);
		let announcement = "";
		if (shared.kind === "valid") {
			this.state = shared.state;
			announcement = this.saveWithAnnouncement("A shared Bingo board was loaded.");
		} else {
			this.state = saved ?? createState(generateBoard(this.catalog, this.random));
			if (shared.kind === "invalid") {
				announcement = saved ? "The shared board link was invalid. Your saved board was restored." : "The shared board link was invalid. A new board was created.";
				this.location.clearBoardHash();
			}
			if (!saved) announcement = this.saveWithAnnouncement(announcement);
		}
		this.view.showReady(this.catalog, this.state);
		if (announcement) this.view.announce(announcement);
	}
	requestShuffle() {
		if (!this.state) return;
		if (this.state.marked.size > 1) this.view.showShuffleConfirmation();
		else this.shuffleBoard();
	}
	markTile(index) {
		if (!this.state) return;
		if (index === freeTileIndex) {
			this.view.announceFreeTile(this.state);
			return;
		}
		const tile = this.catalog.find(({ id }) => id === this.state?.layout[index]);
		if (!tile) throw new Error(`Missing Bingo tile at position ${index}.`);
		const result = toggleTile(this.state, index);
		this.state = result.state;
		this.view.updateState(this.state, result.newlyCompletedLineIds);
		const marked = this.state.marked.has(index);
		const announcement = result.newlyCompletedLineIds.length ? `Bingo! ${result.newlyCompletedLineIds.length === 1 ? "One line" : `${result.newlyCompletedLineIds.length} lines`} completed.` : `${tile.label} ${marked ? "marked" : "unmarked"}.`;
		this.view.announce(this.saveWithAnnouncement(announcement));
	}
	shuffleBoard() {
		if (!this.state) return;
		this.state = createState(generateBoard(this.catalog, this.random));
		this.view.renderBoard(this.state);
		this.view.announce(this.saveWithAnnouncement("A new Bingo board was shuffled."));
	}
	async shareBoard() {
		if (!this.state) return;
		const generation = ++this.shareGeneration;
		const copied = await this.copyToClipboard(encodeState(this.state, this.catalog));
		if (generation !== this.shareGeneration) return;
		if (copied) this.view.showShareCopied();
		this.view.announce(copied ? "The board identifier was copied." : "The board identifier could not be copied.");
	}
	restoreSharedBoard() {
		if (!this.state) return;
		const shared = this.location.read(this.catalog);
		if (shared.kind === "none") return;
		if (shared.kind === "invalid") {
			this.location.clearBoardHash();
			this.view.announce("The shared board link was invalid. Your current board was kept.");
			return;
		}
		this.state = shared.state;
		this.view.renderBoard(this.state);
		this.view.announce(this.saveWithAnnouncement("A shared Bingo board was loaded."));
	}
	saveWithAnnouncement(announcement) {
		if (!this.state) return announcement;
		if (this.storage.save(this.state)) {
			this.location.clearBoardHash();
			return announcement;
		}
		if (this.persistenceFailureAnnounced) return announcement;
		this.persistenceFailureAnnounced = true;
		const failure = "Board changes cannot be saved in this browser.";
		return announcement ? `${announcement} ${failure}` : failure;
	}
};
var retryDelayMs = 5e3;
var loadingGraceMs = 2e3;
var Catalog = class {
	source;
	scheduler;
	constructor(source, scheduler) {
		this.source = source;
		this.scheduler = scheduler;
	}
	load(callbacks) {
		const loadingTimer = this.scheduler.setTimeout(callbacks.onLoading, loadingGraceMs);
		this.source.load().then((tiles) => {
			this.scheduler.clearTimeout(loadingTimer);
			callbacks.onLoaded(tiles);
		}, (error) => {
			this.scheduler.clearTimeout(loadingTimer);
			callbacks.onError(error);
			if (error && typeof error === "object" && "retryable" in error && error.retryable === false) return;
			this.scheduler.setTimeout(() => this.load(callbacks), retryDelayMs);
		});
	}
};
var BoardLocation = class {
	target;
	constructor(target = window) {
		this.target = target;
	}
	read(catalog) {
		const payload = new URLSearchParams(this.target.location.hash.slice(1)).get("board");
		if (payload === null) return { kind: "none" };
		const state = decodeState(payload, catalog);
		return state ? {
			kind: "valid",
			state
		} : { kind: "invalid" };
	}
	clearBoardHash() {
		try {
			const url = new URL(this.target.location.href);
			const params = new URLSearchParams(url.hash.slice(1));
			if (!params.has("board")) return;
			params.delete("board");
			url.hash = params.toString();
			this.target.history.replaceState(null, "", url);
		} catch {}
	}
	subscribe(listener) {
		this.target.addEventListener("hashchange", listener);
	}
};
var storageKey = "bingo:board";
var maxMarkedMask = (1 << 25) - 1;
var BoardStorage = class {
	storage;
	readFailed = false;
	constructor(storage = browserStorage()) {
		this.storage = storage;
	}
	load(catalog) {
		if (!this.storage) {
			this.readFailed = true;
			return null;
		}
		let raw;
		try {
			raw = this.storage.getItem(storageKey);
		} catch {
			this.readFailed = true;
			return null;
		}
		this.readFailed = false;
		if (raw === null) return null;
		try {
			return parseSnapshot(JSON.parse(raw), catalog);
		} catch {
			return null;
		}
	}
	save(state) {
		if (this.readFailed || !this.storage) return false;
		const snapshot = JSON.stringify(stateToSnapshot(state));
		try {
			this.storage.setItem(storageKey, snapshot);
			return true;
		} catch {
			return false;
		}
	}
};
function stateToSnapshot(state) {
	let marked = 0;
	for (const position of state.marked) marked |= 1 << position;
	return {
		layout: [...state.layout],
		marked
	};
}
function parseSnapshot(value, catalog) {
	if (!isRecord(value) || !hasExactKeys(value, ["layout", "marked"])) return null;
	if (!Array.isArray(value.layout) || value.layout.length !== 25 || typeof value.marked !== "number" || !Number.isSafeInteger(value.marked) || value.marked < 0 || value.marked > maxMarkedMask) return null;
	const catalogIds = new Set(catalog.map(({ id }) => id));
	const layout = [];
	const seen = /* @__PURE__ */ new Set();
	for (const id of value.layout) {
		if (typeof id !== "string" || !catalogIds.has(id) || seen.has(id)) return null;
		seen.add(id);
		layout.push(id);
	}
	if (layout[freeTileIndex] !== "its-friday") return null;
	const mask = value.marked;
	if ((mask & 1 << freeTileIndex) === 0) return null;
	const marked = /* @__PURE__ */ new Set();
	for (let index = 0; index < 25; index += 1) if ((mask & 1 << index) !== 0) marked.add(index);
	return restoreState(layout, marked);
}
function browserStorage() {
	try {
		return window.localStorage;
	} catch {
		return null;
	}
}
function isRecord(value) {
	return !!value && typeof value === "object" && !Array.isArray(value);
}
function hasExactKeys(value, expected) {
	const actual = Object.keys(value).sort();
	const sortedExpected = [...expected].sort();
	return actual.length === sortedExpected.length && sortedExpected.every((key, index) => actual[index] === key);
}
var CatalogLoadError = class extends Error {
	retryable;
	constructor(message, retryable, options) {
		super(message, options);
		this.retryable = retryable;
		this.name = "CatalogLoadError";
	}
};
var CatalogSource = class {
	url;
	fetchCatalog;
	constructor(url, fetchCatalog = fetch) {
		this.url = url;
		this.fetchCatalog = fetchCatalog;
	}
	async load() {
		const init = {
			cache: "no-cache",
			headers: { Accept: "application/json" }
		};
		let response;
		try {
			response = await this.fetchCatalog.call(window, this.url, init);
		} catch (cause) {
			throw new CatalogLoadError("The Bingo catalog could not be downloaded.", true, { cause });
		}
		if (!response.ok) throw new CatalogLoadError(`The Bingo catalog returned ${response.status}.`, response.status === 408 || response.status === 429 || response.status >= 500);
		let text;
		try {
			text = await response.text();
		} catch (cause) {
			throw new CatalogLoadError("The Bingo catalog download was interrupted.", true, { cause });
		}
		let value;
		try {
			value = JSON.parse(text);
		} catch (cause) {
			throw new CatalogLoadError("The Bingo catalog is not valid JSON.", false, { cause });
		}
		try {
			return parseCatalog(value);
		} catch (cause) {
			throw new CatalogLoadError(cause instanceof Error ? cause.message : "The Bingo catalog is invalid.", false, { cause });
		}
	}
};
async function copyToClipboard(text, target = navigator) {
	try {
		if (!target.clipboard) return false;
		await target.clipboard.writeText(text);
		return true;
	} catch {
		return false;
	}
}
function isNavigationArrow(key) {
	return key === "ArrowUp" || key === "ArrowDown" || key === "ArrowLeft" || key === "ArrowRight";
}
function nextGridPosition(current, key, size) {
	const row = Math.floor(current / size);
	const column = current % size;
	if (key === "ArrowLeft" && column > 0) return current - 1;
	if (key === "ArrowRight" && column < size - 1) return current + 1;
	if (key === "ArrowUp" && row > 0) return current - size;
	if (key === "ArrowDown" && row < size - 1) return current + size;
	return current;
}
var copy = {
	share: "SHARE",
	copied: "COPIED",
	loadingCatalog: "LOADING TILES...",
	catalogError: "COULD NOT LOAD THE CATALOG.",
	shuffleTitle: "SHUFFLE YOUR BOARD?",
	shuffleWarning: "YOUR CURRENT MARKS WILL BE LOST."
};
var boardCenter = Math.floor(5 / 2);
var blackoutWavePositions = Array.from({ length: 25 }, (_, position) => position).sort((left, right) => {
	return Math.abs(Math.floor(left / 5) - boardCenter) + Math.abs(left % 5 - boardCenter) - (Math.abs(Math.floor(right / 5) - boardCenter) + Math.abs(right % 5 - boardCenter)) || left - right;
});
var BingoView = class {
	root;
	durations;
	reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
	actions;
	shuffleButton;
	shareButton;
	shareLabel;
	boardCard;
	board;
	boardStatus;
	confirmation;
	confirmationScrim;
	confirmationShell;
	confirmationPanel;
	confirmationCancel;
	confirmationConfirm;
	liveRegion;
	tilesById = /* @__PURE__ */ new Map();
	announcementFrame = 0;
	fitFrame = 0;
	shareFeedbackTimer = 0;
	shareFeedbackFade = null;
	confirmationShellMotion = null;
	confirmationScrimMotion = null;
	confirmationClosing = false;
	freeLabelTimer = 0;
	freeLabelTarget = fridayLabel;
	constructor(root) {
		this.root = root;
		root.innerHTML = markup();
		const styles = getComputedStyle(root);
		this.durations = {
			fast: duration(styles, "--duration-fast"),
			standard: duration(styles, "--duration-standard"),
			long: duration(styles, "--duration-long")
		};
		this.actions = this.required(".header-action");
		this.shuffleButton = this.required(".shuffle-button");
		this.shareButton = this.required(".share-button");
		this.shareLabel = this.required(".share-label");
		this.boardCard = this.required(".board-card");
		this.board = this.required(".board");
		this.boardStatus = this.required(".board-status");
		this.confirmation = this.required(".shuffle-confirmation");
		this.confirmationScrim = this.required(".shuffle-scrim");
		this.confirmationShell = this.required(".shuffle-shell");
		this.confirmationPanel = this.required(".confirmation-panel");
		this.confirmationCancel = this.required(".confirmation-cancel");
		this.confirmationConfirm = this.required(".confirmation-confirm");
		this.liveRegion = this.required(".live-region");
		new ResizeObserver(([entry]) => {
			if ((entry?.contentRect.width ?? 0) > 0) this.requestLabelFit();
		}).observe(this.board);
		document.fonts?.ready.then(() => this.requestLabelFit());
	}
	bind(handlers) {
		this.shuffleButton.addEventListener("click", handlers.shuffle);
		this.shareButton.addEventListener("click", () => {
			this.clearShareFeedback();
			handlers.share();
		});
		this.board.addEventListener("click", (event) => {
			const target = event.target instanceof Element ? event.target.closest(".tile") : null;
			if (!target) return;
			handlers.toggleTile(Number(target.dataset.index));
		});
		this.confirmationCancel.addEventListener("click", () => {
			this.hideShuffleConfirmation();
		});
		this.confirmationConfirm.addEventListener("click", () => {
			this.hideShuffleConfirmation(handlers.confirmShuffle);
		});
		this.root.addEventListener("keydown", (event) => this.handleKeydown(event), true);
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
	showReady(catalog, state) {
		for (const tile of catalog) this.tilesById.set(tile.id, tile);
		this.boardStatus.hidden = true;
		this.board.hidden = false;
		this.boardCard.setAttribute("aria-busy", "false");
		this.shuffleButton.disabled = false;
		this.shareButton.disabled = false;
		this.renderBoard(state);
	}
	showLoading() {
		this.board.hidden = true;
		this.boardStatus.hidden = false;
		this.boardStatus.textContent = copy.loadingCatalog;
		this.boardCard.setAttribute("aria-busy", "true");
		this.shuffleButton.disabled = true;
		this.shareButton.disabled = true;
	}
	showFailure(error) {
		this.board.hidden = true;
		this.boardStatus.hidden = false;
		this.boardStatus.textContent = copy.catalogError;
		this.boardCard.setAttribute("aria-busy", "false");
		this.shuffleButton.disabled = true;
		this.shareButton.disabled = true;
		this.announce(error instanceof Error ? error.message : "The Bingo catalog could not be loaded.");
	}
	renderBoard(state) {
		this.dismissShuffleConfirmation();
		this.boardCard.classList.remove("is-celebrating");
		if (this.freeLabelTimer) window.clearTimeout(this.freeLabelTimer);
		this.freeLabelTimer = 0;
		this.freeLabelTarget = this.freeTileLabel(state);
		const fragment = document.createDocumentFragment();
		state.layout.forEach((id, index) => {
			const tile = this.tileById(id);
			const label = index === freeTileIndex ? this.freeLabelTarget : tile.label;
			const button = document.createElement("button");
			button.type = "button";
			button.className = "tile";
			button.dataset.index = String(index);
			button.style.setProperty("--deal-order", String(index));
			button.classList.add("is-dealing");
			if (index === freeTileIndex) {
				button.classList.add("free");
				button.setAttribute("aria-disabled", "true");
			}
			const inner = document.createElement("span");
			inner.className = "tile-inner";
			inner.setAttribute("aria-hidden", "true");
			inner.append(this.createFace("tile-face tile-front", label), this.createFace("tile-face tile-back", label));
			button.append(inner);
			fragment.append(button);
		});
		this.board.replaceChildren(fragment);
		this.updateState(state, []);
		this.requestLabelFit();
	}
	updateState(state, newlyCompletedLineIds) {
		const completedPositions = positionsForLines(completedLineIds(state.marked));
		const winningPositions = winningOpportunityPositions(state.marked);
		this.board.querySelectorAll(".tile").forEach((button, index) => {
			const tile = this.tileById(state.layout[index]);
			const marked = state.marked.has(index);
			const winningOpportunity = winningPositions.has(index);
			button.classList.toggle("marked", marked);
			button.classList.toggle("in-completed-line", completedPositions.has(index));
			button.classList.toggle("winning-opportunity", winningOpportunity);
			button.setAttribute("aria-pressed", String(marked));
			button.setAttribute("aria-label", index === freeTileIndex ? this.freeTileAriaLabel(state) : `${tile.label}, ${marked ? "marked" : "not marked"}${winningOpportunity ? ", completes bingo" : ""}`);
		});
		this.updateFreeTileLabel(state);
		if (newlyCompletedLineIds.length) this.celebrate(newlyCompletedLineIds, state);
	}
	showShuffleConfirmation() {
		if (!this.confirmation.hidden) return;
		this.confirmation.hidden = false;
		this.actions.inert = true;
		this.board.inert = true;
		this.animateConfirmationScrim(1);
		this.confirmationCancel.focus({ preventScroll: true });
		if (this.reducedMotion.matches) {
			this.confirmationShell.style.height = "auto";
			return;
		}
		const targetHeight = this.confirmationPanel.offsetHeight;
		this.confirmationShell.style.height = `${targetHeight}px`;
		const motion = this.confirmationShell.animate({ height: ["0px", `${targetHeight}px`] }, {
			duration: this.durations.standard,
			easing: "ease"
		});
		this.confirmationShellMotion = motion;
		motion.finished.then(() => {
			if (this.confirmationShellMotion !== motion) return;
			this.confirmationShellMotion = null;
			this.confirmationShell.style.height = "auto";
		}, () => {});
	}
	hideShuffleConfirmation(onClosed) {
		if (this.confirmation.hidden || this.confirmationClosing) return;
		this.confirmationClosing = true;
		const currentHeight = this.reducedMotion.matches ? 0 : this.confirmationShell.getBoundingClientRect().height;
		this.confirmationShellMotion?.cancel();
		this.confirmationShellMotion = null;
		this.animateConfirmationScrim(0);
		this.confirmationShell.style.height = "0px";
		if (this.reducedMotion.matches) {
			queueMicrotask(() => {
				if (!this.confirmationClosing) return;
				this.dismissShuffleConfirmation();
				onClosed?.();
			});
			return;
		}
		const motion = this.confirmationShell.animate({ height: [`${currentHeight}px`, "0px"] }, {
			duration: this.durations.standard,
			easing: "ease"
		});
		this.confirmationShellMotion = motion;
		motion.finished.then(() => {
			if (this.confirmationShellMotion !== motion) return;
			this.dismissShuffleConfirmation();
			onClosed?.();
		}, () => {});
	}
	dismissShuffleConfirmation() {
		if (this.confirmation.hidden) return;
		this.confirmationShellMotion?.cancel();
		this.confirmationScrimMotion?.cancel();
		this.confirmationShellMotion = null;
		this.confirmationScrimMotion = null;
		this.confirmationClosing = false;
		this.confirmation.hidden = true;
		this.confirmationScrim.style.opacity = "0";
		this.confirmationShell.style.height = "";
		this.actions.inert = false;
		this.board.inert = false;
		this.shuffleButton.focus({ preventScroll: true });
	}
	animateConfirmationScrim(targetOpacity) {
		const currentOpacity = this.reducedMotion.matches ? targetOpacity : Number.parseFloat(getComputedStyle(this.confirmationScrim).opacity) || 0;
		this.confirmationScrimMotion?.cancel();
		this.confirmationScrimMotion = null;
		this.confirmationScrim.style.opacity = `${targetOpacity}`;
		if (currentOpacity === targetOpacity) return;
		const motion = this.confirmationScrim.animate({ opacity: [`${currentOpacity}`, `${targetOpacity}`] }, {
			duration: this.durations.standard,
			easing: "ease"
		});
		this.confirmationScrimMotion = motion;
		motion.finished.then(() => {
			if (this.confirmationScrimMotion === motion) this.confirmationScrimMotion = null;
		}, () => {});
	}
	showShareCopied() {
		this.cancelShareFeedback();
		this.swapShareLabel(copy.copied, () => {
			this.shareFeedbackTimer = window.setTimeout(() => {
				this.shareFeedbackTimer = 0;
				this.swapShareLabel(copy.share);
			}, this.durations.long);
		});
	}
	announce(message) {
		window.cancelAnimationFrame(this.announcementFrame);
		this.liveRegion.textContent = "";
		if (!message) return;
		this.announcementFrame = window.requestAnimationFrame(() => {
			this.liveRegion.textContent = message;
		});
	}
	announceFreeTile(state) {
		this.announce(`${this.freeTileAriaLabel(state)}.`);
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
	tileById(id) {
		const tile = this.tilesById.get(id);
		if (!tile) throw new Error(`Missing Bingo tile: ${id}`);
		return tile;
	}
	clearShareFeedback() {
		this.cancelShareFeedback();
		this.shareLabel.textContent = copy.share;
	}
	cancelShareFeedback() {
		if (this.shareFeedbackTimer) window.clearTimeout(this.shareFeedbackTimer);
		this.shareFeedbackTimer = 0;
		this.shareFeedbackFade?.cancel();
		this.shareFeedbackFade = null;
	}
	swapShareLabel(text, onVisible) {
		if (this.shareLabel.textContent === text || this.reducedMotion.matches) {
			this.shareLabel.textContent = text;
			onVisible?.();
			return;
		}
		const fadeOut = this.shareLabel.animate({ opacity: [getComputedStyle(this.shareLabel).opacity, "0"] }, {
			duration: this.durations.fast,
			easing: "ease"
		});
		this.shareFeedbackFade = fadeOut;
		fadeOut.finished.then(() => {
			if (this.shareFeedbackFade !== fadeOut) return;
			this.shareLabel.textContent = text;
			const fadeIn = this.shareLabel.animate({ opacity: ["0", "1"] }, {
				duration: this.durations.fast,
				easing: "ease"
			});
			this.shareFeedbackFade = fadeIn;
			fadeIn.finished.then(() => {
				if (this.shareFeedbackFade !== fadeIn) return;
				this.shareFeedbackFade = null;
				onVisible?.();
			}, () => {});
		}, () => {});
	}
	updateFreeTileLabel(state) {
		const text = this.freeTileLabel(state);
		if (text === this.freeLabelTarget) return;
		this.freeLabelTarget = text;
		if (this.freeLabelTimer) window.clearTimeout(this.freeLabelTimer);
		this.freeLabelTimer = 0;
		const labels = this.board.querySelectorAll(".tile.free .tile-label");
		if (this.reducedMotion.matches) {
			labels.forEach((label) => {
				label.textContent = text;
				label.classList.remove("fading");
			});
			this.requestLabelFit();
			return;
		}
		labels.forEach((label) => label.classList.add("fading"));
		this.freeLabelTimer = window.setTimeout(() => {
			this.freeLabelTimer = 0;
			labels.forEach((label) => {
				label.textContent = text;
				label.classList.remove("fading");
			});
			this.requestLabelFit();
		}, this.durations.fast);
	}
	freeTileLabel(state) {
		if (state.marked.size === 25) return "BLACKOUT";
		return completedLineIds(state.marked).size > 0 ? "BINGO" : fridayLabel;
	}
	freeTileAriaLabel(state) {
		if (state.marked.size === 25) return "Blackout, full board, free space";
		const lines = completedLineIds(state.marked).size;
		return lines > 0 ? `Bingo, ${lines} completed ${lines === 1 ? "line" : "lines"}, free space` : `${fridayLabel}, free space`;
	}
	celebrate(lineIds, state) {
		const blackout = state.marked.size === 25;
		const winningPositions = blackout ? blackoutWavePositions : [...positionsForLines(lineIds)].sort((left, right) => left - right);
		const progress = Math.max(0, completedLineIds(state.marked).size - 1) / (bingoLines.length - 1);
		const intensity = Math.sqrt(progress);
		const scaled = (start, end) => Math.round(start + (end - start) * intensity);
		this.boardCard.style.setProperty("--celebration-lift", `${-scaled(26, 60)}px`);
		this.boardCard.style.setProperty("--celebration-cyan-glow", `${scaled(34, 100)}px`);
		this.boardCard.style.setProperty("--celebration-purple-glow", `${scaled(38, 104)}px`);
		this.boardCard.style.setProperty("--celebration-cyan-color", `rgba(73, 241, 250, ${(.34 + intensity * .24).toFixed(2)})`);
		this.boardCard.style.setProperty("--celebration-purple-color", `rgba(141, 100, 245, ${(.36 + intensity * .24).toFixed(2)})`);
		this.boardCard.style.setProperty("--celebration-tile-duration", `${scaled(900, 1350)}ms`);
		this.boardCard.style.setProperty("--celebration-card-duration", `${scaled(1700, 2600)}ms`);
		this.boardCard.classList.remove("is-celebrating");
		this.board.querySelectorAll(".tile.is-celebrating").forEach((tile) => {
			tile.classList.remove("is-celebrating");
		});
		this.boardCard.offsetWidth;
		winningPositions.forEach((position, order) => {
			const tile = this.board.querySelector(`[data-index="${position}"]`);
			if (!tile) throw new Error(`Missing Bingo tile at position ${position}.`);
			tile.style.setProperty("--win-delay", `${order * (blackout ? 35 : 80)}ms`);
			tile.classList.add("is-celebrating");
		});
		this.boardCard.classList.add("is-celebrating");
	}
	handleKeydown(event) {
		if (isNavigationArrow(event.key)) {
			event.preventDefault();
			this.moveBoardFocus(event.key);
		}
		if (this.confirmation.hidden) return;
		if (event.key === "Escape") {
			event.preventDefault();
			this.hideShuffleConfirmation();
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
		window.cancelAnimationFrame(this.fitFrame);
		this.fitFrame = window.requestAnimationFrame(() => {
			this.fitLabels();
		});
	}
	moveBoardFocus(key) {
		const active = document.activeElement instanceof HTMLElement ? document.activeElement.closest(".tile") : null;
		if (!active || !this.board.contains(active)) return;
		const next = nextGridPosition(Number(active.dataset.index), key, 5);
		const tile = this.board.querySelector(`[data-index="${next}"]`);
		if (!tile) throw new Error(`Missing Bingo tile at position ${next}.`);
		tile.focus({ preventScroll: true });
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
function duration(styles, name) {
	const value = styles.getPropertyValue(name).trim();
	if (value.endsWith("ms")) return Number.parseFloat(value) || 0;
	if (value.endsWith("s")) return (Number.parseFloat(value) || 0) * 1e3;
	return 0;
}
function markup() {
	return `
    <main class="wrap">
      <h1>RELEASE RADAR&#10022;</h1>
      <div class="header-action actions" aria-label="Bingo actions">
        <button class="button shuffle-button glass" type="button" disabled>SHUFFLE</button>
        <button class="button share-button glass" type="button" disabled><span class="share-label">${copy.share}</span></button>
      </div>
      <div class="board-stage">
        <section class="board-card glass" aria-busy="true">
          <p class="board-status" role="status">${copy.loadingCatalog}</p>
          <div class="board" role="group" aria-label="Bingo board" hidden></div>
          <div class="shuffle-confirmation" role="dialog" aria-modal="true" aria-labelledby="bingo-shuffle-title" aria-describedby="bingo-shuffle-warning" hidden>
            <div class="shuffle-scrim" aria-hidden="true"></div>
            <div class="shuffle-shell">
              <div class="confirmation-panel glass">
                <strong id="bingo-shuffle-title">${copy.shuffleTitle}</strong>
                <span id="bingo-shuffle-warning">${copy.shuffleWarning}</span>
                <div class="actions">
                  <button class="button confirmation-cancel" type="button">CANCEL</button>
                  <button class="button confirmation-confirm" type="button">SHUFFLE</button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
      <p class="sr-only live-region" aria-live="polite" aria-atomic="true"></p>
    </main>
  `;
}
var root = document.querySelector("#bingo");
if (root) {
	const moduleUrl = new URL(import.meta.url);
	const catalogUrl = new URL("tiles.json", moduleUrl);
	catalogUrl.search = moduleUrl.search;
	const view = new BingoView(root);
	const location = new BoardLocation();
	const controller = new BingoController(new Catalog(new CatalogSource(catalogUrl), window), new BoardStorage(), location, view, copyToClipboard);
	view.bind({
		shuffle: () => controller.requestShuffle(),
		confirmShuffle: () => controller.shuffleBoard(),
		share: () => void controller.shareBoard(),
		toggleTile: (index) => controller.markTile(index)
	});
	location.subscribe(() => controller.restoreSharedBoard());
	controller.bootstrap();
}
