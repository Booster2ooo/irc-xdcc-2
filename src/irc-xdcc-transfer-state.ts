export enum XdccTransferState {
	pending = 0,
	requested = 1,
	queued = 2,
	started = 3,
	finished = 4,
	cancelled = -1
}