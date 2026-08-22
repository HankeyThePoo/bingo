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
var COMPACT_LAYOUT_CELLS = 24;
var COMPACT_MARK_BITS = BigInt(COMPACT_LAYOUT_CELLS);
var COMPACT_MARK_MASK = (1n << COMPACT_MARK_BITS) - 1n;
var CATALOG_FINGERPRINT_MODULUS = 4096;
function parseTileCatalog(value) {
	if (!Array.isArray(value)) throw new Error("The tile catalog must be an array.");
	const tiles = [];
	const ids = /* @__PURE__ */ new Set();
	for (const candidate of value) {
		if (!isRecord$4(candidate) || !hasExactKeys$3(candidate, ["id", "label"])) throw new Error("Every tile must contain exactly an id and label.");
		const { id, label } = candidate;
		if (typeof id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) || ids.has(id)) throw new Error("Tile IDs must be unique, lowercase slugs.");
		if (typeof label !== "string" || label.trim() !== label || label.length === 0 || label.length > 60) throw new Error("Tile labels must contain between 1 and 60 characters.");
		ids.add(id);
		tiles.push({
			id,
			label
		});
	}
	if (tiles.filter(({ id }) => id !== "its-friday").length < COMPACT_LAYOUT_CELLS) throw new Error("The catalog needs at least 24 ordinary tiles.");
	const friday = tiles.find(({ id }) => id === FRIDAY_ID);
	if (!friday || friday.label !== "It's Friday") throw new Error("The catalog needs one It's Friday free tile.");
	return tiles;
}
function encodeBoardIdentifier(board, catalog) {
	const ordinaryIds = compactCatalogIds(catalog);
	const available = [...ordinaryIds];
	let layoutRank = 0n;
	for (let index = 0; index < 25; index += 1) {
		if (index === 12) continue;
		const id = board.layout[index];
		const digit = id ? available.indexOf(id) : -1;
		if (digit < 0) throw new Error("The board cannot be encoded with this catalog.");
		layoutRank = layoutRank * BigInt(available.length) + BigInt(digit);
		available.splice(digit, 1);
	}
	let marked = 0n;
	let markedBit = 0n;
	for (let index = 0; index < 25; index += 1) {
		if (index === 12) continue;
		if (board.marked.has(index)) marked |= 1n << markedBit;
		markedBit += 1n;
	}
	const permutations = permutationCount(ordinaryIds.length, COMPACT_LAYOUT_CELLS);
	return encodeBigInt(BigInt(catalogFingerprint(ordinaryIds)) * permutations + layoutRank << COMPACT_MARK_BITS | marked);
}
function decodeBoardIdentifier(payload, catalog) {
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
			if (index === 12 || (markedMask & 1n << markedBit) !== 0n) marked.add(index);
			if (index !== 12) markedBit += 1n;
		}
		return {
			layout,
			marked
		};
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
function isRecord$4(value) {
	return !!value && typeof value === "object" && !Array.isArray(value);
}
function hasExactKeys$3(value, expected) {
	const actual = Object.keys(value).sort();
	const sortedExpected = [...expected].sort();
	return actual.length === sortedExpected.length && sortedExpected.every((key, index) => actual[index] === key);
}
//#endregion
//#region src/game.ts
function parseCatalog(value) {
	return parseTileCatalog(value);
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
	return {
		state: {
			layout: state.layout,
			marked,
			completedLines
		},
		newlyCompletedLineIds: [...completedLines].filter((lineId) => !state.completedLines.has(lineId))
	};
}
function completedLineIds(marked) {
	return new Set(BINGO_LINES.filter(({ positions }) => positions.every((position) => marked.has(position))).map(({ id }) => id));
}
function winningOpportunityPositions(marked) {
	const positions = /* @__PURE__ */ new Set();
	for (const line of BINGO_LINES) {
		const missing = line.positions.filter((position) => !marked.has(position));
		if (missing.length === 1) positions.add(missing[0]);
	}
	return positions;
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
//#endregion
//#region src/catalog-source.ts
async function loadCatalog(url, request = fetch) {
	const response = await request(url, { cache: "no-cache" });
	if (!response.ok) throw new Error(`Tile catalog request failed: ${response.status}`);
	return parseCatalog(await response.json());
}
function catalogUrl(moduleUrl, pageOrigin = window.location.origin, development = false) {
	const url = development ? new URL("/tiles.json", pageOrigin) : new URL("tiles.json", moduleUrl);
	url.search = moduleUrl.search;
	return url;
}
//#endregion
//#region src/gm/catalog.ts
function callsFromCatalog(catalog) {
	return catalog.filter(({ id }) => id !== FRIDAY_ID);
}
function searchCalls(calls, query) {
	const term = query.trim().toLocaleLowerCase();
	return term ? calls.filter(({ label }) => label.toLocaleLowerCase().includes(term)) : calls;
}
//#endregion
//#region src/gm/persistence.ts
var SESSION_KEY = "release-radar-gm:session";
var GmPersistence = class {
	storage;
	constructor(storage = localStorage) {
		this.storage = storage;
	}
	load() {
		try {
			const raw = this.storage.getItem(SESSION_KEY);
			return raw ? parseStoredSession(JSON.parse(raw)) : null;
		} catch {
			return null;
		}
	}
	save(state) {
		try {
			this.storage.setItem(SESSION_KEY, JSON.stringify({
				format: 1,
				...state
			}));
			return true;
		} catch {
			return false;
		}
	}
};
function parseStoredSession(value) {
	if (!isRecord$3(value) || !hasExactKeys$2(value, [
		"format",
		"tracking",
		"entries",
		"selectedEntryId",
		"lastSeenTrackId",
		"suppressedTrackId",
		"nextEntryId"
	])) return null;
	if (value.format !== 1 || typeof value.tracking !== "boolean" || !Array.isArray(value.entries) || !nullableInteger(value.selectedEntryId) || !nullableString(value.lastSeenTrackId) || !nullableString(value.suppressedTrackId) || !positiveInteger(value.nextEntryId)) return null;
	const entries = value.entries.map(parseEntry);
	if (entries.some((entry) => entry === null)) return null;
	const validEntries = entries;
	if (new Set(validEntries.map(({ id }) => id)).size !== validEntries.length) return null;
	if (value.selectedEntryId !== null && !validEntries.some(({ id }) => id === value.selectedEntryId)) return null;
	if (validEntries.some(({ id }) => id >= Number(value.nextEntryId))) return null;
	return {
		tracking: value.tracking,
		entries: validEntries,
		selectedEntryId: value.selectedEntryId,
		lastSeenTrackId: value.lastSeenTrackId,
		suppressedTrackId: value.suppressedTrackId,
		nextEntryId: Number(value.nextEntryId)
	};
}
function parseEntry(value) {
	if (!isRecord$3(value) || !hasExactKeys$2(value, [
		"id",
		"spotifyTrackId",
		"title",
		"artists",
		"callIds",
		"occurredAt"
	])) return null;
	if (!positiveInteger(value.id) || typeof value.spotifyTrackId !== "string" || value.spotifyTrackId.length === 0 || typeof value.title !== "string" || !stringArray(value.artists) || !stringArray(value.callIds) || new Set(value.callIds).size !== value.callIds.length || typeof value.occurredAt !== "string" || Number.isNaN(Date.parse(value.occurredAt))) return null;
	return {
		id: Number(value.id),
		spotifyTrackId: value.spotifyTrackId,
		title: value.title,
		artists: value.artists,
		callIds: value.callIds,
		occurredAt: value.occurredAt
	};
}
function isRecord$3(value) {
	return !!value && typeof value === "object" && !Array.isArray(value);
}
function hasExactKeys$2(value, expected) {
	const actual = Object.keys(value).sort();
	const sorted = [...expected].sort();
	return actual.length === sorted.length && sorted.every((key, index) => actual[index] === key);
}
function positiveInteger(value) {
	return Number.isSafeInteger(value) && Number(value) > 0;
}
function nullableInteger(value) {
	return value === null || positiveInteger(value);
}
function nullableString(value) {
	return value === null || typeof value === "string";
}
function stringArray(value) {
	return Array.isArray(value) && value.every((item) => typeof item === "string" && item.length > 0);
}
//#endregion
//#region src/gm/session.ts
function createSessionState() {
	return {
		tracking: false,
		entries: [],
		selectedEntryId: null,
		lastSeenTrackId: null,
		suppressedTrackId: null,
		nextEntryId: 1
	};
}
var GmSession = class {
	current;
	constructor(current = createSessionState()) {
		this.current = current;
	}
	get state() {
		return this.current;
	}
	startTracking(track) {
		this.current = {
			...this.current,
			tracking: true
		};
		this.observeTrack(track);
	}
	stopTracking() {
		this.current = {
			...this.current,
			tracking: false
		};
	}
	observeTrack(track) {
		if (!this.current.tracking || !track) return;
		if (track.id === this.current.suppressedTrackId) return;
		const suppressedTrackId = track.id === this.current.suppressedTrackId ? this.current.suppressedTrackId : null;
		if (track.id === this.current.lastSeenTrackId) {
			if (suppressedTrackId !== this.current.suppressedTrackId) this.current = {
				...this.current,
				suppressedTrackId
			};
			return;
		}
		const entry = {
			id: this.current.nextEntryId,
			spotifyTrackId: track.id,
			title: track.title,
			artists: [...track.artists],
			callIds: [],
			occurredAt: (/* @__PURE__ */ new Date()).toISOString()
		};
		this.current = {
			...this.current,
			entries: [...this.current.entries, entry],
			selectedEntryId: entry.id,
			lastSeenTrackId: track.id,
			suppressedTrackId,
			nextEntryId: entry.id + 1
		};
	}
	selectEntry(id) {
		if (this.current.entries.some((entry) => entry.id === id)) this.current = {
			...this.current,
			selectedEntryId: id
		};
	}
	returnToLive() {
		this.current = {
			...this.current,
			selectedEntryId: this.current.entries.at(-1)?.id ?? null
		};
	}
	toggleCall(callId) {
		const selectedId = this.current.selectedEntryId;
		if (selectedId === null) return;
		this.current = {
			...this.current,
			entries: this.current.entries.map((entry) => {
				if (entry.id !== selectedId) return entry;
				const callIds = entry.callIds.includes(callId) ? entry.callIds.filter((id) => id !== callId) : [...entry.callIds, callId];
				return {
					...entry,
					callIds
				};
			})
		};
	}
	deleteEntry(id, currentlyPlayingId) {
		const target = this.current.entries.find((entry) => entry.id === id);
		if (!target) return;
		const entries = this.current.entries.filter((entry) => entry.id !== id);
		const suppress = target.id === this.current.entries.at(-1)?.id && target.spotifyTrackId === currentlyPlayingId;
		this.current = {
			...this.current,
			entries,
			selectedEntryId: this.current.selectedEntryId === id ? entries.at(-1)?.id ?? null : this.current.selectedEntryId,
			lastSeenTrackId: suppress ? currentlyPlayingId : this.current.lastSeenTrackId,
			suppressedTrackId: suppress ? currentlyPlayingId : this.current.suppressedTrackId
		};
	}
	clear() {
		this.current = createSessionState();
	}
};
//#endregion
//#region src/gm/spotify-api.ts
var CURRENTLY_PLAYING_URL = "https://api.spotify.com/v1/me/player/currently-playing";
var SpotifyApi = class {
	request;
	constructor(request = fetch) {
		this.request = request;
	}
	async currentlyPlaying(accessToken) {
		try {
			const response = await this.request(CURRENTLY_PLAYING_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
			if (response.status === 204) return { kind: "idle" };
			if (response.status === 401) return { kind: "unauthorized" };
			if (response.status === 429) {
				const seconds = Number(response.headers.get("Retry-After"));
				return {
					kind: "rate-limited",
					retryAfterMs: Number.isFinite(seconds) ? Math.max(1, seconds) * 1e3 : 3e3
				};
			}
			if (!response.ok) return { kind: "error" };
			const track = parseCurrentlyPlaying(await response.json());
			return track ? {
				kind: "track",
				track
			} : { kind: "idle" };
		} catch {
			return { kind: "error" };
		}
	}
};
function parseCurrentlyPlaying(value) {
	if (!isRecord$2(value) || !isRecord$2(value.item) || typeof value.item.id !== "string" || typeof value.item.name !== "string" || !Number.isFinite(value.item.duration_ms) || !isRecord$2(value.item.external_urls) || typeof value.item.external_urls.spotify !== "string" || !Array.isArray(value.item.artists) || !isRecord$2(value.item.album) || typeof value.item.album.name !== "string") return null;
	const artists = value.item.artists.map((artist) => isRecord$2(artist) && typeof artist.name === "string" ? artist.name : null).filter((artist) => artist !== null);
	if (!artists.length) return null;
	const artwork = (Array.isArray(value.item.album.images) ? value.item.album.images : []).find((image) => isRecord$2(image) && typeof image.url === "string");
	return {
		id: value.item.id,
		title: value.item.name,
		artists,
		album: value.item.album.name,
		artworkUrl: isRecord$2(artwork) ? String(artwork.url) : null,
		spotifyUrl: value.item.external_urls.spotify,
		explicit: value.item.explicit === true,
		durationMs: Math.max(0, Number(value.item.duration_ms)),
		progressMs: Number.isFinite(value.progress_ms) ? Math.max(0, Number(value.progress_ms)) : 0,
		isPlaying: value.is_playing === true
	};
}
function isRecord$2(value) {
	return !!value && typeof value === "object" && !Array.isArray(value);
}
//#endregion
//#region src/gm/spotify-auth.ts
var AUTHORIZE_URL = "https://accounts.spotify.com/authorize";
var TOKEN_URL = "https://accounts.spotify.com/api/token";
var SCOPE = "user-read-currently-playing";
var CLIENT_KEY = "release-radar-gm:spotify-client";
var TOKENS_KEY = "release-radar-gm:spotify-tokens";
var TRANSACTION_KEY = "release-radar-gm:spotify-transaction";
var REFRESH_LIFETIME_MS = 4320 * 60 * 60 * 1e3;
var SpotifyAuth = class {
	persistent;
	temporary;
	request;
	now;
	constructor(persistent = localStorage, temporary = sessionStorage, request = fetch, now = Date.now) {
		this.persistent = persistent;
		this.temporary = temporary;
		this.request = request;
		this.now = now;
	}
	get client() {
		return parseClient(readJson(this.persistent, CLIENT_KEY));
	}
	get connected() {
		return parseTokens(readJson(this.persistent, TOKENS_KEY)) !== null;
	}
	configure(clientId, redirectUri) {
		const normalized = clientId.trim();
		if (!/^[A-Za-z0-9]{16,64}$/u.test(normalized)) throw new Error("Enter a valid Spotify Client ID.");
		const record = {
			clientId: normalized,
			redirectUri
		};
		this.persistent.setItem(CLIENT_KEY, JSON.stringify(record));
		this.persistent.removeItem(TOKENS_KEY);
	}
	async beginAuthorization() {
		const client = this.client;
		if (!client) throw new Error("Spotify must be configured first.");
		const verifier = randomUrlSafe(64);
		const state = randomUrlSafe(18);
		const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
		const challenge = bytesToUrlSafe(new Uint8Array(digest));
		const transaction = {
			verifier,
			state,
			redirectUri: client.redirectUri
		};
		this.temporary.setItem(TRANSACTION_KEY, JSON.stringify(transaction));
		const url = new URL(AUTHORIZE_URL);
		url.search = new URLSearchParams({
			client_id: client.clientId,
			response_type: "code",
			redirect_uri: client.redirectUri,
			scope: SCOPE,
			state,
			code_challenge_method: "S256",
			code_challenge: challenge
		}).toString();
		window.location.assign(url);
	}
	async completeCallback(url = new URL(window.location.href)) {
		const code = url.searchParams.get("code");
		const returnedState = url.searchParams.get("state");
		const error = url.searchParams.get("error");
		if (!code && !error) return false;
		const transaction = parseTransaction(readJson(this.temporary, TRANSACTION_KEY));
		this.temporary.removeItem(TRANSACTION_KEY);
		cleanCallbackUrl(url);
		if (error) throw new Error(`Spotify authorization failed: ${error}.`);
		if (!transaction || !returnedState || returnedState !== transaction.state || !code) throw new Error("Spotify authorization could not be verified. Please connect again.");
		const client = this.client;
		if (!client || client.redirectUri !== transaction.redirectUri) throw new Error("Spotify setup changed during authorization. Please connect again.");
		const response = await this.request(TOKEN_URL, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				client_id: client.clientId,
				grant_type: "authorization_code",
				code,
				redirect_uri: transaction.redirectUri,
				code_verifier: transaction.verifier
			})
		});
		if (!response.ok) throw new Error("Spotify did not accept the authorization code.");
		const token = parseTokenResponse(await response.json(), null, this.now());
		if (!token) throw new Error("Spotify returned an invalid token response.");
		this.saveTokens(token);
		return true;
	}
	async accessToken(forceRefresh = false) {
		const tokens = parseTokens(readJson(this.persistent, TOKENS_KEY));
		if (!tokens) return null;
		if (!forceRefresh && tokens.expiresAt > this.now() + 3e4) return tokens.accessToken;
		if (this.now() - tokens.refreshIssuedAt >= REFRESH_LIFETIME_MS) {
			this.disconnect();
			return null;
		}
		const client = this.client;
		if (!client) return null;
		const response = await this.request(TOKEN_URL, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				grant_type: "refresh_token",
				refresh_token: tokens.refreshToken,
				client_id: client.clientId
			})
		});
		if (!response.ok) {
			if (response.status === 400 || response.status === 401) this.disconnect();
			return null;
		}
		const refreshed = parseTokenResponse(await response.json(), tokens, this.now());
		if (!refreshed) return null;
		this.saveTokens(refreshed);
		return refreshed.accessToken;
	}
	disconnect() {
		this.persistent.removeItem(TOKENS_KEY);
	}
	saveTokens(tokens) {
		this.persistent.setItem(TOKENS_KEY, JSON.stringify(tokens));
	}
};
function currentRedirectUri(location = window.location) {
	const url = new URL(location.href);
	url.search = url.searchParams.get("mode") === "gm" ? "?mode=gm" : "";
	url.hash = "";
	return url.href;
}
function parseTokenResponse(value, previous, now) {
	if (!isRecord$1(value) || typeof value.access_token !== "string" || value.access_token.length === 0 || !Number.isFinite(value.expires_in) || Number(value.expires_in) <= 0) return null;
	const refreshToken = typeof value.refresh_token === "string" && value.refresh_token.length > 0 ? value.refresh_token : previous?.refreshToken;
	if (!refreshToken) return null;
	return {
		accessToken: value.access_token,
		refreshToken,
		expiresAt: now + Number(value.expires_in) * 1e3,
		refreshIssuedAt: typeof value.refresh_token === "string" ? now : previous?.refreshIssuedAt ?? now
	};
}
function parseClient(value) {
	if (!isRecord$1(value) || !hasExactKeys$1(value, ["clientId", "redirectUri"]) || typeof value.clientId !== "string" || typeof value.redirectUri !== "string") return null;
	return {
		clientId: value.clientId,
		redirectUri: value.redirectUri
	};
}
function parseTokens(value) {
	if (!isRecord$1(value) || !hasExactKeys$1(value, [
		"accessToken",
		"refreshToken",
		"expiresAt",
		"refreshIssuedAt"
	]) || typeof value.accessToken !== "string" || typeof value.refreshToken !== "string" || !Number.isFinite(value.expiresAt) || !Number.isFinite(value.refreshIssuedAt)) return null;
	return {
		accessToken: value.accessToken,
		refreshToken: value.refreshToken,
		expiresAt: Number(value.expiresAt),
		refreshIssuedAt: Number(value.refreshIssuedAt)
	};
}
function parseTransaction(value) {
	if (!isRecord$1(value) || !hasExactKeys$1(value, [
		"verifier",
		"state",
		"redirectUri"
	]) || typeof value.verifier !== "string" || typeof value.state !== "string" || typeof value.redirectUri !== "string") return null;
	return {
		verifier: value.verifier,
		state: value.state,
		redirectUri: value.redirectUri
	};
}
function cleanCallbackUrl(url) {
	url.searchParams.delete("code");
	url.searchParams.delete("state");
	url.searchParams.delete("error");
	window.history.replaceState(null, "", url);
}
function randomUrlSafe(bytes) {
	const values = new Uint8Array(bytes);
	crypto.getRandomValues(values);
	return bytesToUrlSafe(values);
}
function bytesToUrlSafe(bytes) {
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}
function readJson(storage, key) {
	try {
		const raw = storage.getItem(key);
		return raw ? JSON.parse(raw) : null;
	} catch {
		return null;
	}
}
function isRecord$1(value) {
	return !!value && typeof value === "object" && !Array.isArray(value);
}
function hasExactKeys$1(value, expected) {
	const actual = Object.keys(value).sort();
	const sorted = [...expected].sort();
	return actual.length === sorted.length && sorted.every((key, index) => actual[index] === key);
}
//#endregion
//#region src/gm/spotify-monitor.ts
var POLL_INTERVAL_MS = 3e3;
var SpotifyMonitor = class {
	poll;
	documentRef;
	timeout = null;
	active = false;
	polling = false;
	constructor(poll, documentRef = document) {
		this.poll = poll;
		this.documentRef = documentRef;
		this.visibilityChanged = this.visibilityChanged.bind(this);
	}
	start() {
		if (this.active) return;
		this.active = true;
		this.documentRef.addEventListener("visibilitychange", this.visibilityChanged);
		if (this.documentRef.visibilityState === "visible") this.run();
	}
	stop() {
		this.active = false;
		this.documentRef.removeEventListener("visibilitychange", this.visibilityChanged);
		if (this.timeout !== null) window.clearTimeout(this.timeout);
		this.timeout = null;
	}
	async run() {
		if (!this.active || this.polling || this.documentRef.visibilityState !== "visible") return;
		this.polling = true;
		try {
			const delay = await this.poll();
			if (!this.active || this.documentRef.visibilityState !== "visible") return;
			this.timeout = window.setTimeout(() => void this.run(), delay ?? POLL_INTERVAL_MS);
		} finally {
			this.polling = false;
		}
	}
	visibilityChanged() {
		if (!this.active) return;
		if (this.documentRef.visibilityState === "visible") {
			if (this.timeout !== null) window.clearTimeout(this.timeout);
			this.timeout = null;
			this.run();
		} else if (this.timeout !== null) {
			window.clearTimeout(this.timeout);
			this.timeout = null;
		}
	}
};
//#endregion
//#region src/gm/verifier.ts
function verifyBoard(input, catalog, entries) {
	const identifier = extractIdentifier(input);
	const board = identifier ? decodeBoardIdentifier(identifier, catalog) : null;
	if (!board) return {
		kind: "invalid-identifier",
		message: "That board identifier is invalid for the current catalog."
	};
	const labels = new Map(catalog.map((tile) => [tile.id, tile.label]));
	const markedPositions = [...board.marked].filter((position) => position !== 12);
	const matching = matchPositions(markedPositions, board.layout, entries);
	const details = [];
	const uncalled = markedPositions.filter((position) => !entries.some((entry) => entry.callIds.includes(board.layout[position])));
	if (uncalled.length) details.push(`No recorded call: ${uncalled.map((position) => labels.get(board.layout[position]) ?? board.layout[position]).join(", ")}.`);
	const conflicts = markedPositions.filter((position) => !uncalled.includes(position) && !matching.has(position));
	if (conflicts.length) details.push(`Occurrence conflict: ${conflicts.map((position) => labels.get(board.layout[position]) ?? board.layout[position]).join(", ")} cannot each claim a unique song.`);
	if (matching.size !== markedPositions.length) return {
		kind: "unsupported",
		layout: board.layout,
		marked: board.marked,
		message: "Invalid: the ledger cannot support every marked tile.",
		details,
		earliestSong: null
	};
	const completed = BINGO_LINES.filter(({ positions }) => positions.every((position) => board.marked.has(position)));
	if (!completed.length) return {
		kind: "valid-no-bingo",
		layout: board.layout,
		marked: board.marked,
		message: "Valid, but no Bingo.",
		details: ["Every marked tile is supported by a unique song occurrence."],
		earliestSong: null
	};
	const earliestSong = earliestCompletedLine(completed, board.layout, entries);
	return {
		kind: "bingo",
		layout: board.layout,
		marked: board.marked,
		message: earliestSong === null ? "Valid Bingo." : `Valid Bingo — legitimately possible after song ${earliestSong}.`,
		details: [`${completed.length} completed ${completed.length === 1 ? "line" : "lines"}; every mark has a unique supporting occurrence.`, "This verifies possibility from the final snapshot, not the player's marking chronology."],
		earliestSong
	};
}
function extractIdentifier(input) {
	const trimmed = input.trim();
	if (!trimmed) return null;
	try {
		const url = new URL(trimmed);
		return new URLSearchParams(url.hash.slice(1)).get("board");
	} catch {
		return trimmed;
	}
}
function earliestCompletedLine(lines, layout, entries) {
	for (let count = 1; count <= entries.length; count += 1) {
		const prefix = entries.slice(0, count);
		if (lines.some(({ positions }) => {
			const calledPositions = positions.filter((position) => position !== 12);
			return matchPositions(calledPositions, layout, prefix).size === calledPositions.length;
		})) return count;
	}
	return null;
}
function matchPositions(positions, layout, entries) {
	const entryToPosition = /* @__PURE__ */ new Map();
	const positionToEntry = /* @__PURE__ */ new Map();
	function assign(position, visited) {
		const callId = layout[position];
		if (!callId) return false;
		for (let entryIndex = 0; entryIndex < entries.length; entryIndex += 1) {
			if (visited.has(entryIndex) || !entries[entryIndex]?.callIds.includes(callId)) continue;
			visited.add(entryIndex);
			const previous = entryToPosition.get(entryIndex);
			if (previous === void 0 || assign(previous, visited)) {
				entryToPosition.set(entryIndex, position);
				positionToEntry.set(position, entryIndex);
				return true;
			}
		}
		return false;
	}
	for (const position of positions) assign(position, /* @__PURE__ */ new Set());
	return positionToEntry;
}
//#endregion
//#region src/gm/view.ts
var CONNECTION_LABELS = {
	"not-configured": "NOT CONFIGURED",
	disconnected: "DISCONNECTED",
	connecting: "CONNECTING",
	connected: "CONNECTED",
	idle: "NO ACTIVE PLAYBACK",
	"rate-limited": "RATE LIMITED",
	error: "CONNECTION ERROR"
};
var GmView = class {
	root;
	callbacks = null;
	catalog = [];
	calls = [];
	visibleCalls = [];
	session = null;
	highlightedCall = 0;
	constructor(root) {
		this.root = root;
		root.innerHTML = template();
		this.bindDom();
	}
	bind(callbacks) {
		this.callbacks = callbacks;
	}
	setCatalog(catalog, calls) {
		this.catalog = catalog;
		this.calls = calls;
		this.visibleCalls = calls;
		this.renderCalls();
	}
	renderSession(state, currentTrack) {
		this.session = state;
		const tracking = this.element("tracking-toggle");
		tracking.textContent = state.tracking ? "STOP TRACKING" : "START TRACKING";
		tracking.classList.toggle("is-active", state.tracking);
		this.element("tracking-state").textContent = state.tracking ? "TRACKING" : "NOT TRACKING";
		const latestId = state.entries.at(-1)?.id ?? null;
		const reviewing = state.selectedEntryId !== null && state.selectedEntryId !== latestId;
		this.element("review-state").toggleAttribute("hidden", !reviewing);
		if (reviewing) {
			const number = state.entries.findIndex(({ id }) => id === state.selectedEntryId) + 1;
			this.element("review-label").textContent = `REVIEWING SONG ${number}`;
		}
		this.renderLedger();
		this.renderCalls();
		this.renderTrack(currentTrack, state);
	}
	renderTrack(track, state) {
		const empty = this.element("now-empty");
		const content = this.element("now-content");
		empty.toggleAttribute("hidden", track !== null);
		content.toggleAttribute("hidden", track === null);
		if (!track) return;
		const artwork = this.element("now-artwork");
		if (track.artworkUrl) artwork.src = track.artworkUrl;
		else artwork.removeAttribute("src");
		artwork.alt = track.artworkUrl ? `${track.album} artwork` : "No album artwork";
		this.element("now-title").textContent = track.title;
		this.element("now-artists").textContent = track.artists.join(", ");
		this.element("now-album").textContent = track.album;
		this.element("explicit-badge").toggleAttribute("hidden", !track.explicit);
		const progress = this.element("now-progress");
		progress.max = Math.max(1, track.durationMs);
		progress.value = Math.min(track.progressMs, track.durationMs);
		this.element("now-time").textContent = `${formatTime(track.progressMs)} / ${formatTime(track.durationMs)}`;
		const link = this.element("spotify-link");
		link.href = track.spotifyUrl;
		const occurrence = [...state.entries].reverse().findIndex(({ spotifyTrackId }) => spotifyTrackId === track.id);
		const ledgerIndex = occurrence < 0 ? -1 : state.entries.length - occurrence - 1;
		this.element("now-ledger-number").textContent = ledgerIndex < 0 ? "NOT IN LEDGER" : `SONG ${ledgerIndex + 1}`;
		this.element("play-state").textContent = track.isPlaying ? "PLAYING" : "PAUSED";
	}
	renderConnection(state) {
		const status = this.element("spotify-status");
		status.textContent = CONNECTION_LABELS[state];
		status.dataset.state = state;
		const connect = this.element("spotify-connect");
		connect.textContent = state === "not-configured" ? "SET UP SPOTIFY" : "CONNECT SPOTIFY";
		connect.toggleAttribute("hidden", ![
			"not-configured",
			"disconnected",
			"error"
		].includes(state));
		this.element("spotify-setup").toggleAttribute("hidden", !["disconnected", "error"].includes(state));
		this.element("spotify-disconnect").toggleAttribute("hidden", ![
			"connected",
			"idle",
			"rate-limited"
		].includes(state));
	}
	showSpotifySetup(redirectUri, clientId = "") {
		this.element("client-id").value = clientId;
		this.element("redirect-uri").value = redirectUri;
		this.element("spotify-dialog").showModal();
		this.element("client-id").focus();
	}
	showCatalogError() {
		this.element("calls-list").replaceChildren(message("The calls catalog could not be loaded."));
		this.element("verifier-message").textContent = "The verifier is unavailable until the catalog loads.";
	}
	showVerification(result) {
		const verdict = this.element("verifier-message");
		verdict.textContent = result.message;
		verdict.dataset.kind = result.kind;
		const details = this.element("verifier-details");
		details.replaceChildren();
		if (result.kind === "invalid-identifier") {
			this.element("verifier-board").replaceChildren();
			return;
		}
		for (const detail of result.details) {
			const item = document.createElement("li");
			item.textContent = detail;
			details.append(item);
		}
		const labels = new Map(this.catalog.map((tile) => [tile.id, tile.label]));
		this.element("verifier-board").replaceChildren(...result.layout.map((id, index) => {
			const tile = document.createElement("div");
			tile.className = "verifier-tile";
			tile.classList.toggle("is-marked", result.marked.has(index));
			tile.classList.toggle("is-free", index === 12);
			tile.textContent = labels.get(id) ?? id;
			return tile;
		}));
	}
	announce(text) {
		this.element("gm-announcer").textContent = text;
	}
	bindDom() {
		this.element("tracking-toggle").addEventListener("click", () => this.callbacks?.toggleTracking());
		this.element("new-session").addEventListener("click", () => this.element("new-session-dialog").showModal());
		this.element("confirm-new-session").addEventListener("click", () => this.callbacks?.clearSession());
		this.element("spotify-connect").addEventListener("click", () => this.callbacks?.connectSpotify());
		this.element("spotify-setup").addEventListener("click", () => this.callbacks?.editSpotifySetup());
		this.element("spotify-disconnect").addEventListener("click", () => this.callbacks?.disconnectSpotify());
		this.element("spotify-cancel").addEventListener("click", () => this.element("spotify-dialog").close());
		this.element("spotify-form").addEventListener("submit", (event) => {
			event.preventDefault();
			this.callbacks?.saveSpotifySetup(this.element("client-id").value);
		});
		this.element("return-live").addEventListener("click", () => this.callbacks?.returnToLive());
		this.element("verify-button").addEventListener("click", () => this.callbacks?.verify(this.element("board-identifier").value));
		this.element("calls-search").addEventListener("input", (event) => {
			this.visibleCalls = searchCalls(this.calls, event.currentTarget.value);
			this.highlightedCall = 0;
			this.renderCalls();
		});
		this.element("calls-search").addEventListener("keydown", (event) => {
			if (event.key === "ArrowDown" || event.key === "ArrowUp") {
				event.preventDefault();
				const direction = event.key === "ArrowDown" ? 1 : -1;
				this.highlightedCall = wrap(this.highlightedCall + direction, this.visibleCalls.length);
				this.renderCalls();
			} else if (event.key === "Enter") {
				event.preventDefault();
				const call = this.visibleCalls[this.highlightedCall];
				if (call) this.callbacks?.toggleCall(call.id);
			}
		});
		this.element("calls-list").addEventListener("click", (event) => {
			const button = event.target.closest("[data-call-id]");
			if (button?.dataset.callId) this.callbacks?.toggleCall(button.dataset.callId);
		});
		this.element("ledger-body").addEventListener("click", (event) => {
			const deleteButton = event.target.closest("[data-delete-entry]");
			if (deleteButton) {
				event.stopPropagation();
				this.callbacks?.deleteEntry(Number(deleteButton.dataset.deleteEntry));
				return;
			}
			const row = event.target.closest("[data-entry-id]");
			if (row) this.callbacks?.selectEntry(Number(row.dataset.entryId));
		});
		this.element("ledger-body").addEventListener("keydown", (event) => {
			if (event.key !== "Enter" && event.key !== " ") return;
			const row = event.target.closest("[data-entry-id]");
			if (!row) return;
			event.preventDefault();
			this.callbacks?.selectEntry(Number(row.dataset.entryId));
		});
	}
	renderCalls() {
		if (!this.session) return;
		const selected = this.session.entries.find(({ id }) => id === this.session?.selectedEntryId);
		const list = this.element("calls-list");
		if (!this.visibleCalls.length) {
			list.replaceChildren(message("No calls match that search."));
			return;
		}
		list.replaceChildren(...this.visibleCalls.map((call, index) => {
			const button = document.createElement("button");
			button.type = "button";
			button.className = "call-button";
			button.dataset.callId = call.id;
			button.textContent = call.label;
			button.classList.toggle("is-selected", selected?.callIds.includes(call.id) ?? false);
			button.classList.toggle("is-highlighted", index === this.highlightedCall);
			button.disabled = !selected;
			return button;
		}));
		scrollNearest(list.querySelector(".is-highlighted"));
	}
	renderLedger() {
		if (!this.session) return;
		const labels = new Map(this.catalog.map((tile) => [tile.id, tile.label]));
		const body = this.element("ledger-body");
		if (!this.session.entries.length) {
			body.replaceChildren(message("Start tracking to build the song ledger."));
			return;
		}
		body.replaceChildren(...this.session.entries.map((entry, index) => {
			const row = document.createElement("div");
			row.className = "ledger-row";
			row.dataset.entryId = String(entry.id);
			row.role = "button";
			row.tabIndex = 0;
			row.classList.toggle("is-selected", entry.id === this.session?.selectedEntryId);
			const number = document.createElement("span");
			number.className = "ledger-number";
			number.textContent = String(index + 1).padStart(2, "0");
			const song = document.createElement("span");
			song.className = "ledger-song";
			const title = document.createElement("strong");
			title.textContent = entry.title;
			const artist = document.createElement("small");
			artist.textContent = entry.artists.join(", ");
			song.append(title, artist);
			const chips = document.createElement("span");
			chips.className = "ledger-chips";
			for (const callId of entry.callIds) {
				const chip = document.createElement("span");
				chip.className = "call-chip";
				chip.textContent = labels.get(callId) ?? callId;
				chips.append(chip);
			}
			const remove = document.createElement("button");
			remove.type = "button";
			remove.className = "delete-entry";
			remove.dataset.deleteEntry = String(entry.id);
			remove.ariaLabel = `Delete song ${index + 1}`;
			remove.textContent = "×";
			row.append(number, song, chips, remove);
			return row;
		}));
		scrollNearest(body.querySelector(".ledger-row.is-selected"));
	}
	element(id) {
		const element = this.root.querySelector(`#${id}`);
		if (!element) throw new Error(`GM view element #${id} is missing.`);
		return element;
	}
};
function template() {
	return `
    <main class="gm-shell">
      <header class="gm-header">
        <div class="gm-brand"><span>STOLEN VALOR</span><h1>RELEASE RADAR<span aria-hidden="true">✦</span> GM</h1></div>
        <div class="header-controls">
          <span id="tracking-state" class="state-label">NOT TRACKING</span>
          <button id="tracking-toggle" class="gradient-button" type="button">START TRACKING</button>
          <button id="new-session" class="quiet-button" type="button">NEW SESSION</button>
        </div>
      </header>
      <section class="gm-workspace">
        <section class="gm-panel now-panel">
          <div class="panel-heading">
            <div><span class="eyebrow">SPOTIFY</span><h2>NOW PLAYING</h2></div>
            <div class="connection-controls"><span id="spotify-status" class="status-pill">NOT CONFIGURED</span><button id="spotify-connect" class="text-button" type="button">SET UP SPOTIFY</button><button id="spotify-setup" class="text-button" type="button" hidden>EDIT SETUP</button><button id="spotify-disconnect" class="text-button" type="button" hidden>DISCONNECT</button></div>
          </div>
          <div id="now-empty" class="empty-state">Connect Spotify to show the current track. Tracking still works independently.</div>
          <div id="now-content" class="now-content" hidden>
            <img id="now-artwork" class="now-artwork" alt="" />
            <div class="now-meta"><div class="track-kickers"><span id="now-ledger-number">NOT IN LEDGER</span><span id="play-state">PLAYING</span><span id="explicit-badge" class="explicit" hidden>E</span></div><h3 id="now-title"></h3><p id="now-artists"></p><p id="now-album" class="album"></p><progress id="now-progress" value="0" max="1"></progress><div class="progress-labels"><span id="now-time">0:00 / 0:00</span><a id="spotify-link" target="_blank" rel="noreferrer">OPEN IN SPOTIFY ↗</a></div></div>
          </div>
        </section>
        <section class="gm-panel calls-panel">
          <div class="panel-heading"><div><span class="eyebrow">SELECTED SONG</span><h2>CALLS</h2></div></div>
          <label class="search-field"><span class="sr-only">Search calls</span><input id="calls-search" type="search" placeholder="SEARCH CALLS…" autocomplete="off" /><span aria-hidden="true">⌕</span></label>
          <div id="calls-list" class="calls-list"><p class="empty-message">Loading calls…</p></div>
        </section>
        <section class="gm-panel ledger-panel">
          <div class="panel-heading"><div><span class="eyebrow">CURRENT SESSION</span><h2>SONG LEDGER</h2></div><div id="review-state" class="review-state" hidden><span id="review-label">REVIEWING SONG</span><button id="return-live" class="text-button" type="button">RETURN TO LIVE</button></div></div>
          <div class="ledger-columns" aria-hidden="true"><span>#</span><span>ARTIST / TITLE</span><span>CALLS</span><span></span></div>
          <div id="ledger-body" class="ledger-body"><p class="empty-message">Start tracking to build the song ledger.</p></div>
        </section>
        <section class="gm-panel verifier-panel">
          <div class="panel-heading"><div><span class="eyebrow">FINAL SNAPSHOT</span><h2>BINGO VERIFIER</h2></div></div>
          <div class="verifier-input"><label class="sr-only" for="board-identifier">Board identifier or URL</label><input id="board-identifier" placeholder="PASTE BOARD ID OR URL…" /><button id="verify-button" class="gradient-button" type="button">VERIFY</button></div>
          <div class="verifier-result"><div id="verifier-board" class="verifier-board"></div><div class="verdict"><strong id="verifier-message">Paste a final board snapshot to verify it.</strong><ul id="verifier-details"></ul></div></div>
        </section>
      </section>
    </main>
    <dialog id="spotify-dialog" class="gm-dialog"><form id="spotify-form"><span class="eyebrow">ONE-TIME SETUP</span><h2>CONNECT SPOTIFY</h2><p>Create a Spotify Web API app, then add this exact redirect URI to its settings.</p><label>PUBLIC CLIENT ID<input id="client-id" required autocomplete="off" /></label><label>EXACT REDIRECT URI<input id="redirect-uri" readonly /></label><div class="dialog-actions"><button id="spotify-cancel" class="quiet-button" type="button">CANCEL</button><button class="gradient-button" type="submit">SAVE & CONNECT</button></div></form></dialog>
    <dialog id="new-session-dialog" class="gm-dialog"><form method="dialog"><span class="eyebrow">CLEAR LEDGER</span><h2>NEW SESSION?</h2><p>This permanently removes every song and call in the current session.</p><div class="dialog-actions"><button class="quiet-button" value="cancel">CANCEL</button><button id="confirm-new-session" class="gradient-button" value="default">NEW SESSION</button></div></form></dialog>
    <p id="gm-announcer" class="sr-only" aria-live="polite"></p>`;
}
function formatTime(milliseconds) {
	const seconds = Math.floor(milliseconds / 1e3);
	return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
function wrap(value, length) {
	return length ? (value % length + length) % length : 0;
}
function message(text) {
	const paragraph = document.createElement("p");
	paragraph.className = "empty-message";
	paragraph.textContent = text;
	return paragraph;
}
function scrollNearest(element) {
	if (element instanceof HTMLElement && typeof element.scrollIntoView === "function") element.scrollIntoView({ block: "nearest" });
}
//#endregion
//#region src/gm/controller.ts
var GmController = class {
	view;
	persistence;
	session;
	auth;
	api;
	monitor;
	catalog = [];
	currentTrack = null;
	connection = "not-configured";
	constructor(root) {
		this.view = new GmView(root);
		this.persistence = new GmPersistence();
		this.session = new GmSession(this.persistence.load() ?? void 0);
		this.auth = new SpotifyAuth();
		this.api = new SpotifyApi();
		this.monitor = new SpotifyMonitor(() => this.pollSpotify());
		this.view.bind({
			toggleTracking: () => this.toggleTracking(),
			clearSession: () => this.clearSession(),
			connectSpotify: () => void this.connectSpotify(),
			editSpotifySetup: () => this.editSpotifySetup(),
			disconnectSpotify: () => this.disconnectSpotify(),
			saveSpotifySetup: (clientId) => void this.saveSpotifySetup(clientId),
			toggleCall: (callId) => this.toggleCall(callId),
			selectEntry: (entryId) => this.selectEntry(entryId),
			deleteEntry: (entryId) => this.deleteEntry(entryId),
			returnToLive: () => this.returnToLive(),
			verify: (input) => this.verify(input)
		});
	}
	async start() {
		document.title = "Release Radar GM";
		this.render();
		try {
			await this.auth.completeCallback();
		} catch (error) {
			this.view.announce(error instanceof Error ? error.message : "Spotify authorization failed.");
		}
		try {
			this.catalog = await loadCatalog(catalogUrl(new URL(import.meta.url)));
			this.view.setCatalog(this.catalog, callsFromCatalog(this.catalog));
		} catch {
			this.view.showCatalogError();
		}
		if (this.auth.connected) {
			this.setConnection("connecting");
			this.monitor.start();
		} else this.setConnection(this.auth.client ? "disconnected" : "not-configured");
		this.render();
	}
	toggleTracking() {
		if (this.session.state.tracking) this.session.stopTracking();
		else this.session.startTracking(this.currentTrack);
		this.persistAndRender();
		this.view.announce(this.session.state.tracking ? "Song tracking started." : "Song tracking stopped.");
	}
	clearSession() {
		this.session.clear();
		this.persistAndRender();
		this.view.announce("A new session was started. The ledger is empty.");
	}
	async connectSpotify() {
		const client = this.auth.client;
		const redirectUri = currentRedirectUri();
		if (!client || client.redirectUri !== redirectUri) {
			this.view.showSpotifySetup(redirectUri, client?.clientId);
			return;
		}
		this.setConnection("connecting");
		try {
			await this.auth.beginAuthorization();
		} catch (error) {
			this.setConnection("error");
			this.view.announce(error instanceof Error ? error.message : "Spotify authorization could not start.");
		}
	}
	async saveSpotifySetup(clientId) {
		try {
			this.auth.configure(clientId, currentRedirectUri());
			await this.connectSpotify();
		} catch (error) {
			this.setConnection(this.auth.client ? "disconnected" : "not-configured");
			this.view.announce(error instanceof Error ? error.message : "Spotify setup could not be saved.");
		}
	}
	editSpotifySetup() {
		this.view.showSpotifySetup(currentRedirectUri(), this.auth.client?.clientId ?? "");
	}
	disconnectSpotify() {
		this.monitor.stop();
		this.auth.disconnect();
		this.setConnection("disconnected");
		this.view.announce("Spotify disconnected. The last track remains visible.");
	}
	toggleCall(callId) {
		this.session.toggleCall(callId);
		this.persistAndRender();
	}
	selectEntry(entryId) {
		this.session.selectEntry(entryId);
		this.render();
	}
	deleteEntry(entryId) {
		this.session.deleteEntry(entryId, this.currentTrack?.id ?? null);
		this.persistAndRender();
		this.view.announce("The song was removed from the ledger.");
	}
	returnToLive() {
		this.session.returnToLive();
		this.render();
	}
	verify(input) {
		if (!this.catalog.length) {
			this.view.announce("The catalog is not available for verification.");
			return;
		}
		this.view.showVerification(verifyBoard(input, this.catalog, this.session.state.entries));
	}
	async pollSpotify() {
		try {
			let token = await this.auth.accessToken();
			if (!token) {
				this.monitor.stop();
				this.setConnection("disconnected");
				return;
			}
			let result = await this.api.currentlyPlaying(token);
			if (result.kind === "unauthorized") {
				token = await this.auth.accessToken(true);
				if (!token) {
					this.monitor.stop();
					this.setConnection("disconnected");
					return;
				}
				result = await this.api.currentlyPlaying(token);
			}
			if (result.kind === "track") {
				this.currentTrack = result.track;
				this.session.observeTrack(result.track);
				this.persistence.save(this.session.state);
				this.setConnection("connected");
				this.render();
			} else if (result.kind === "idle") this.setConnection("idle");
			else if (result.kind === "rate-limited") {
				this.setConnection("rate-limited");
				return result.retryAfterMs;
			} else this.setConnection("error");
		} catch {
			this.setConnection("error");
		}
	}
	persistAndRender() {
		if (!this.persistence.save(this.session.state)) this.view.announce("Session changes cannot be saved in this browser.");
		this.render();
	}
	setConnection(state) {
		this.connection = state;
		this.view.renderConnection(state);
	}
	render() {
		this.view.renderConnection(this.connection);
		this.view.renderSession(this.session.state, this.currentTrack);
	}
};
//#endregion
//#region src/snapshot.ts
var MAX_MARKED_MASK = 2 ** 25 - 1;
function stateToSnapshot(state) {
	let marked = 0;
	for (const position of state.marked) marked += 2 ** position;
	return {
		layout: [...state.layout],
		marked
	};
}
function parseSnapshot(value, catalog) {
	if (!isRecord(value) || !hasExactKeys(value, ["layout", "marked"])) return null;
	if (!Array.isArray(value.layout) || value.layout.length !== 25 || !Number.isSafeInteger(value.marked) || Number(value.marked) < 0 || Number(value.marked) > MAX_MARKED_MASK) return null;
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
	return encodeBoardIdentifier(state, catalog);
}
function decodeState(payload, catalog) {
	const board = decodeBoardIdentifier(payload, catalog);
	return board ? restoreState(board.layout, board.marked) : null;
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
var STORAGE_KEY = "release-radar-bingo:board";
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
var BOARD_CENTER = Math.floor(5 / 2);
var BLACKOUT_WAVE_POSITIONS = Array.from({ length: 25 }, (_, position) => position).sort((left, right) => {
	return Math.abs(Math.floor(left / 5) - BOARD_CENTER) + Math.abs(left % 5 - BOARD_CENTER) - (Math.abs(Math.floor(right / 5) - BOARD_CENTER) + Math.abs(right % 5 - BOARD_CENTER)) || left - right;
});
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
	freeLabelTimer = 0;
	freeLabelTarget = "It's Friday";
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
		if (this.freeLabelTimer) window.clearTimeout(this.freeLabelTimer);
		this.freeLabelTimer = 0;
		this.freeLabelTarget = this.freeTileLabel(state);
		const fragment = document.createDocumentFragment();
		state.layout.forEach((id, index) => {
			const tile = this.tilesById.get(id);
			if (!tile) return;
			const label = index === 12 ? this.freeLabelTarget : tile.label;
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
			inner.append(this.createFace("tile-face tile-front", label), this.createFace("tile-face tile-back", label));
			button.append(inner);
			fragment.append(button);
		});
		this.board.replaceChildren(fragment);
		this.updateState(state, []);
		this.requestLabelFit();
	}
	updateState(state, newlyCompletedLineIds) {
		const completedPositions = positionsForLines(state.completedLines);
		const winningPositions = winningOpportunityPositions(state.marked);
		this.board.querySelectorAll(".tile").forEach((button, index) => {
			const tile = this.tilesById.get(state.layout[index] ?? "");
			if (!tile) return;
			const marked = state.marked.has(index);
			const winningOpportunity = winningPositions.has(index);
			button.classList.toggle("marked", marked);
			button.classList.toggle("in-completed-line", completedPositions.has(index));
			button.classList.toggle("winning-opportunity", winningOpportunity);
			button.setAttribute("aria-pressed", String(marked));
			button.setAttribute("aria-label", index === 12 ? this.freeTileAriaLabel(state) : `${tile.label}, ${marked ? "marked" : "not marked"}${winningOpportunity ? ", completes bingo" : ""}`);
		});
		this.updateFreeTileLabel(state);
		if (newlyCompletedLineIds.length) this.celebrate(newlyCompletedLineIds, state);
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
	updateFreeTileLabel(state) {
		const text = this.freeTileLabel(state);
		if (text === this.freeLabelTarget) return;
		this.freeLabelTarget = text;
		if (this.freeLabelTimer) window.clearTimeout(this.freeLabelTimer);
		this.freeLabelTimer = 0;
		const labels = this.board.querySelectorAll(".tile.free .tile-label");
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
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
		}, 180);
	}
	freeTileLabel(state) {
		if (state.marked.size === 25) return "BLACKOUT";
		return state.completedLines.size > 0 ? "BINGO" : "It's Friday";
	}
	freeTileAriaLabel(state) {
		if (state.marked.size === 25) return "Blackout, full board, free space";
		const lines = state.completedLines.size;
		return lines > 0 ? `Bingo, ${lines} completed ${lines === 1 ? "line" : "lines"}, free space` : "It's Friday, free space";
	}
	celebrate(lineIds, state) {
		const blackout = state.marked.size === 25;
		const winningPositions = blackout ? BLACKOUT_WAVE_POSITIONS : [...positionsForLines(lineIds)].sort((left, right) => left - right);
		const progress = Math.max(0, state.completedLines.size - 1) / (BINGO_LINES.length - 1);
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
			if (!tile) return;
			tile.style.setProperty("--win-delay", `${order * (blackout ? 35 : 80)}ms`);
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
      <div class="board-stage">
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
      </div>
      <p class="sr-only live-region" aria-live="polite" aria-atomic="true"></p>
    </main>
  `;
}
//#endregion
//#region src/main.ts
var root = document.querySelector("#release-radar-bingo");
var gmMode = new URLSearchParams(window.location.search).get("mode") === "gm";
if (root && gmMode) {
	root.id = "release-radar-gm";
	new GmController(root).start();
} else if (root && !root.dataset.bingoReady) {
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
			catalog = await loadCatalog(catalogUrl(new URL(import.meta.url)));
		} catch {
			view.showFailure();
			return;
		}
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
	}
	function markTile(index) {
		if (!state) return;
		if (index === 12) {
			view.announceFreeTile(state);
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
		state = createState(generateBoard(catalog));
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
