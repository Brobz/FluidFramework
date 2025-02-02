/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { ITreeCursorSynchronous, JsonableTree, RevisionTag } from "../../core";
import { ChangesetLocalId, NodeChangeset } from "../modular-schema";

/**
 * The contents of a node to be created
 */
export type ProtoNode = JsonableTree;

export type NodeCount = number;

/**
 * Left undefined for terseness.
 */
export const NoopMarkType = undefined;

export interface NoopMark extends CellTargetingMark {
	/**
	 * Declared for consistency with other marks.
	 * Left undefined for terseness.
	 */
	type?: typeof NoopMarkType;

	/**
	 * The number of nodes being skipped.
	 */
	count: NodeCount;
}

/**
 * A monotonically increasing positive integer assigned to an individual mark within the changeset.
 * MoveIds are scoped to a single changeset, so referring to MoveIds across changesets requires
 * qualifying them by change tag.
 *
 * The uniqueness of IDs is leveraged to uniquely identify the matching move-out for a move-in/return and vice-versa.
 */
export type MoveId = ChangesetLocalId;

export interface HasMoveId {
	/**
	 * The sequential ID assigned to a change within a transaction.
	 */
	id: MoveId;
}

export type NodeChangeType = NodeChangeset;

export enum Tiebreak {
	Left,
	Right,
}
export enum Effects {
	All = "All",
	Move = "Move",
	Delete = "Delete",
	None = "None",
}

/**
 * Represents a position within a contiguous range of nodes detached by a single changeset.
 * Note that `LineageEvent`s with the same revision are not necessarily referring to the same detach.
 * `LineageEvent`s for a given revision can only be meaningfully compared if it is known that they must refer to the
 * same detach.
 */
export interface LineageEvent {
	readonly revision: RevisionTag;

	/**
	 * The position of this mark within a range of nodes which were detached in this revision.
	 */
	readonly offset: number;
}

export interface HasChanges<TNodeChange = NodeChangeType> {
	changes?: TNodeChange;
}

export interface HasPlaceFields {
	/**
	 * Describes which kinds of concurrent slice operations should affect the target place.
	 *
	 * The tuple allows this choice to be different for concurrent slices that are sequenced
	 * either before (`heed[0]`) or after (`heed[1]`). For example, multiple concurrent updates
	 * of a sequence with last-write-wins semantics would use a slice-delete over the whole
	 * sequence, and an insert with the `heed` value `[Effects.None, Effects.All]`.
	 *
	 * When the value for prior and ulterior concurrent slices is the same, that value can be
	 * used directly instead of the corresponding tuple.
	 *
	 * Omit if `Effects.All` for terseness.
	 */
	heed?: Effects | [Effects, Effects];

	/**
	 * Record of relevant information about changes this mark has been rebased over.
	 * Events are stored in the order in which they were rebased over.
	 */
	lineage?: LineageEvent[];
}

export interface HasReattachFields extends HasPlaceFields {
	/**
	 * The revision this mark is inverting a detach from.
	 * If defined this mark is a revert-only inverse,
	 * meaning that it will only reattach nodes if those nodes were last detached by `inverseOf`.
	 * If `inverseOf` is undefined, this mark will reattach nodes regardless of when they were last detached.
	 */
	inverseOf?: RevisionTag;
}

/**
 * Identifies an empty cell.
 */
export interface DetachEvent {
	/**
	 * The intention of edit which last emptied the cell.
	 */
	revision: RevisionTag;

	/**
	 * The absolute position of the node in this cell in the input context of the revision which emptied it.
	 */
	index: number;
}

/**
 * Mark which targets a range of existing cells instead of creating new cells.
 */
export interface CellTargetingMark {
	/**
	 * Describes the detach which last emptied target cells.
	 * Undefined if the target cells are not empty in this mark's input context.
	 */
	detachEvent?: DetachEvent;

	/**
	 * Lineage of detaches adjacent to the cells since `detachEvent`.
	 * Should be empty if the cells are full in this mark's input context.
	 */
	lineage?: LineageEvent[];
}

export interface DetachedCellMark extends CellTargetingMark {
	detachEvent: DetachEvent;
}

export interface HasTiebreakPolicy extends HasPlaceFields {
	/**
	 * Omit if `Tiebreak.Right` for terseness.
	 */
	tiebreak?: Tiebreak;
}

export enum RangeType {
	Set = "Set",
	Slice = "Slice",
}

export interface HasRevisionTag {
	/**
	 * The revision this mark is part of.
	 * Only set for marks in fields which are a composition of multiple revisions.
	 */
	revision?: RevisionTag;
}

export interface Insert<TNodeChange = NodeChangeType>
	extends HasTiebreakPolicy,
		HasRevisionTag,
		HasChanges<TNodeChange> {
	type: "Insert";
	content: ProtoNode[];

	/**
	 * The first ID in a block associated with the nodes being inserted.
	 * The node `content[i]` is associated with `id + i`.
	 */
	id: ChangesetLocalId;
}

export interface MoveIn extends HasMoveId, HasPlaceFields, HasRevisionTag {
	type: "MoveIn";
	/**
	 * The actual number of nodes being moved-in. This count excludes nodes that were concurrently deleted.
	 */
	count: NodeCount;
	/**
	 * When true, the corresponding MoveOut has a conflict.
	 * This is independent of whether this mark has a conflict.
	 */
	isSrcConflicted?: true;
}

export interface Delete<TNodeChange = NodeChangeType>
	extends HasRevisionTag,
		HasChanges<TNodeChange>,
		CellTargetingMark {
	type: "Delete";
	count: NodeCount;
}

export interface MoveOut<TNodeChange = NodeChangeType>
	extends HasRevisionTag,
		HasMoveId,
		HasChanges<TNodeChange>,
		CellTargetingMark {
	type: "MoveOut";
	count: NodeCount;
}

export interface Revive<TNodeChange = NodeChangeType>
	extends HasReattachFields,
		HasRevisionTag,
		HasChanges<TNodeChange>,
		CellTargetingMark {
	type: "Revive";
	content: ITreeCursorSynchronous[];
	count: NodeCount;
}

export interface ReturnTo extends HasReattachFields, HasRevisionTag, HasMoveId, CellTargetingMark {
	type: "ReturnTo";
	count: NodeCount;

	/**
	 * When true, the corresponding ReturnFrom has a conflict.
	 * This is independent of whether this mark has a conflict.
	 */
	isSrcConflicted?: true;
}

export interface ReturnFrom<TNodeChange = NodeChangeType>
	extends HasRevisionTag,
		HasMoveId,
		HasChanges<TNodeChange>,
		CellTargetingMark {
	type: "ReturnFrom";
	count: NodeCount;

	/**
	 * When true, the corresponding ReturnTo has a conflict.
	 * This is independent of whether this mark has a conflict.
	 */
	isDstConflicted?: true;
}

/**
 * An attach mark that allocates new cells.
 */
export type NewAttach<TNodeChange = NodeChangeType> = Insert<TNodeChange> | MoveIn;

export type Reattach<TNodeChange = NodeChangeType> = Revive<TNodeChange> | ReturnTo;

export type Attach<TNodeChange = NodeChangeType> = NewAttach<TNodeChange> | Reattach<TNodeChange>;

export type Detach<TNodeChange = NodeChangeType> =
	| Delete<TNodeChange>
	| MoveOut<TNodeChange>
	| ReturnFrom<TNodeChange>;

export interface Modify<TNodeChange = NodeChangeType> extends CellTargetingMark {
	type: "Modify";
	changes: TNodeChange;
}

/**
 * A mark which extends `CellTargetingMark`.
 */
export type ExistingCellMark<TNodeChange> =
	| NoopMark
	| Delete<TNodeChange>
	| MoveOut<TNodeChange>
	| ReturnFrom<TNodeChange>
	| Modify<TNodeChange>
	| Revive<TNodeChange>
	| ReturnTo;

export type EmptyInputCellMark<TNodeChange> =
	| NewAttach<TNodeChange>
	| (DetachedCellMark & ExistingCellMark<TNodeChange>);

export type Mark<TNodeChange = NodeChangeType> =
	| NoopMark
	| Modify<TNodeChange>
	| Attach<TNodeChange>
	| Detach<TNodeChange>;

export type MarkList<TNodeChange = NodeChangeType, TMark = Mark<TNodeChange>> = TMark[];

export type Changeset<TNodeChange = NodeChangeType> = MarkList<TNodeChange>;

/**
 * A mark that spans one or more cells.
 * The spanned cells may be populated (e.g., "Delete") or not (e.g., "Revive").
 */
export type CellSpanningMark<TNodeChange> = Exclude<Mark<TNodeChange>, NewAttach<TNodeChange>>;

export function isEmpty<T>(change: Changeset<T>): boolean {
	return change.length === 0;
}
