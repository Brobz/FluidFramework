/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import {
	ChangesetLocalId,
	SequenceField as SF,
	singleTextCursor,
} from "../../../feature-libraries";
import { brand } from "../../../util";
import { fakeTaggedRepair as fakeRepair } from "../../utils";
import { mintRevisionTag, RevisionTag, TreeSchemaIdentifier } from "../../../core";
import { TestChange } from "../../testChange";
// eslint-disable-next-line import/no-internal-modules
import { DetachEvent } from "../../../feature-libraries/sequence-field/format";
import { composeAnonChanges, composeAnonChangesShallow } from "./utils";

const type: TreeSchemaIdentifier = brand("Node");
const tag: RevisionTag = mintRevisionTag();

export type TestChangeset = SF.Changeset<TestChange>;

export const cases: {
	no_change: TestChangeset;
	insert: TestChangeset;
	modify: TestChangeset;
	modify_insert: TestChangeset;
	delete: TestChangeset;
	revive: TestChangeset;
	move: TestChangeset;
	return: TestChangeset;
} = {
	no_change: [],
	insert: createInsertChangeset(1, 2, 1),
	modify: SF.sequenceFieldEditor.buildChildChange(0, TestChange.mint([], 1)),
	modify_insert: composeAnonChanges([
		createInsertChangeset(1, 1, 1),
		createModifyChangeset(1, TestChange.mint([], 2)),
	]),
	delete: createDeleteChangeset(1, 3),
	revive: createReviveChangeset(2, 2, tag, 0),
	move: createMoveChangeset(1, 2, 2),
	return: createReturnChangeset(1, 3, 0, tag),
};

function createInsertChangeset(
	index: number,
	size: number,
	startingValue: number = 0,
	id?: ChangesetLocalId,
): SF.Changeset<never> {
	const content = [];
	while (content.length < size) {
		content.push({ type, value: startingValue + content.length });
	}
	return SF.sequenceFieldEditor.insert(
		index,
		content.map(singleTextCursor),
		id ?? brand(startingValue),
	);
}

function createDeleteChangeset(startIndex: number, size: number): SF.Changeset<never> {
	return SF.sequenceFieldEditor.delete(startIndex, size);
}

function createRedundantRemoveChangeset(
	index: number,
	size: number,
	detachEvent: DetachEvent,
): SF.Changeset<never> {
	const changeset = createDeleteChangeset(index, size);
	(changeset[changeset.length - 1] as SF.Delete).detachEvent = detachEvent;
	return changeset;
}

function createReviveChangeset(
	startIndex: number,
	count: number,
	detachedBy: RevisionTag,
	detachIndex?: number,
	reviver = fakeRepair,
	lineage?: SF.LineageEvent[],
	lastDetach?: DetachEvent,
): SF.Changeset<never> {
	const markList = SF.sequenceFieldEditor.revive(
		startIndex,
		count,
		detachedBy,
		reviver,
		detachIndex,
	);
	const mark = markList[markList.length - 1] as SF.Reattach;
	if (lastDetach !== undefined) {
		mark.detachEvent = lastDetach;
	}
	if (lineage !== undefined) {
		mark.lineage = lineage;
	}
	return markList;
}

function createRedundantReviveChangeset(
	startIndex: number,
	count: number,
	detachedBy: RevisionTag,
	detachIndex?: number,
	reviver = fakeRepair,
	isIntention?: boolean,
): SF.Changeset<never> {
	const markList = SF.sequenceFieldEditor.revive(
		startIndex,
		count,
		detachedBy,
		reviver,
		detachIndex,
		isIntention,
	);
	const mark = markList[markList.length - 1] as SF.Reattach;
	delete mark.detachEvent;
	return markList;
}

function createBlockedReviveChangeset(
	startIndex: number,
	count: number,
	inverseOf: RevisionTag,
	lastDetachedBy: RevisionTag,
	lastDetachIndex?: number,
	reviver = fakeRepair,
	lineage?: SF.LineageEvent[],
): SF.Changeset<never> {
	const markList = SF.sequenceFieldEditor.revive(
		startIndex,
		count,
		inverseOf,
		reviver,
		lastDetachIndex,
	);
	const mark = markList[markList.length - 1] as SF.Reattach;
	mark.detachEvent = { revision: lastDetachedBy, index: lastDetachIndex ?? startIndex };
	if (lineage !== undefined) {
		mark.lineage = lineage;
	}
	return markList;
}

function createIntentionalReviveChangeset(
	startIndex: number,
	count: number,
	detachedBy: RevisionTag,
	detachIndex?: number,
	reviver = fakeRepair,
	lineage?: SF.LineageEvent[],
	lastDetach?: DetachEvent,
): SF.Changeset<never> {
	const markList = SF.sequenceFieldEditor.revive(
		startIndex,
		count,
		detachedBy,
		reviver,
		detachIndex,
		true,
	);
	const mark = markList[markList.length - 1] as SF.Reattach;

	if (lastDetach !== undefined) {
		mark.detachEvent = lastDetach;
	}

	if (lineage !== undefined) {
		mark.lineage = lineage;
	}
	return markList;
}

function createMoveChangeset(
	sourceIndex: number,
	count: number,
	destIndex: number,
	id: ChangesetLocalId = brand(0),
): SF.Changeset<never> {
	return composeAnonChangesShallow(
		SF.sequenceFieldEditor.move(sourceIndex, count, destIndex, id),
	);
}

function createReturnChangeset(
	sourceIndex: number,
	count: number,
	destIndex: number,
	detachedBy: RevisionTag,
	detachIndex?: number,
): SF.Changeset<never> {
	return SF.sequenceFieldEditor.return(sourceIndex, count, destIndex, detachedBy, detachIndex);
}

function createModifyChangeset<TNodeChange>(
	index: number,
	change: TNodeChange,
): SF.Changeset<TNodeChange> {
	return SF.sequenceFieldEditor.buildChildChange(index, change);
}

function createModifyDetachedChangeset<TNodeChange>(
	index: number,
	change: TNodeChange,
	detachEvent: DetachEvent,
	lineage?: SF.LineageEvent[],
): SF.Changeset<TNodeChange> {
	const changeset = createModifyChangeset(index, change);
	const modify = changeset[changeset.length - 1] as SF.Modify;
	modify.detachEvent = detachEvent;
	if (lineage !== undefined) {
		modify.lineage = lineage;
	}
	return changeset;
}

export const ChangeMaker = {
	insert: createInsertChangeset,
	delete: createDeleteChangeset,
	redundantRemove: createRedundantRemoveChangeset,
	revive: createReviveChangeset,
	intentionalRevive: createIntentionalReviveChangeset,
	redundantRevive: createRedundantReviveChangeset,
	blockedRevive: createBlockedReviveChangeset,
	move: createMoveChangeset,
	return: createReturnChangeset,
	modify: createModifyChangeset,
	modifyDetached: createModifyDetachedChangeset,
};
