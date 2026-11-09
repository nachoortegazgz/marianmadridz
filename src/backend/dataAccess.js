/*
=============================================================================
MODULE: backend/dataAccess.js
VERSION: v2.6-SDK-QUERY-HYBRID
RESPONSIBILITY: Capa unica de acceso elevado a colecciones CMS.
STANDARDS: G10 ASCII Strict. Sin suppressAuth. Acceso CMS centralizado
  exclusivamente mediante @wix/data.
=============================================================================
*/

import { items } from "@wix/data";
import { auth } from "@wix/essentials";

const DATA_ACCESS_ERROR = "DATA_ACCESS_ERROR";

export const CONSISTENCY = Object.freeze({
    STRONG: Object.freeze({ consistentRead: true }),
    EVENTUAL: Object.freeze({}),
});

export const order = Object.freeze({
    asc: (fieldName) => [{ fieldName, direction: "ASC" }],
    desc: (fieldName) => [{ fieldName, direction: "DESC" }],
});

/*
 * Errores unificados: mensaje generico para no filtrar informacion
 * al exterior, codigo especifico en .code para diagnostico interno.
 */
function dataAccessError(code) {
    const error = new Error(DATA_ACCESS_ERROR);
    if (code) error.code = code;
    return error;
}

function fieldClause(field, operator, value) {
    return { [String(field)]: { [operator]: value } };
}

function asArray(value) {
    return Array.isArray(value) ? value : [value];
}

export const wql = Object.freeze({
    eq: (field, value) => fieldClause(field, "$eq", value),
    ne: (field, value) => fieldClause(field, "$ne", value),
    gt: (field, value) => fieldClause(field, "$gt", value),
    gte: (field, value) => fieldClause(field, "$gte", value),
    lt: (field, value) => fieldClause(field, "$lt", value),
    lte: (field, value) => fieldClause(field, "$lte", value),
    in: (field, values) => fieldClause(field, "$in", asArray(values)),
    hasSome: (field, values) =>
        fieldClause(field, "$hasSome", asArray(values)),
    startsWith: (field, value) =>
        fieldClause(field, "$startsWith", value),
    contains: (field, value) =>
        fieldClause(field, "$contains", value),
    and: (...clauses) => ({ $and: clauses.filter(Boolean) }),
    or: (...clauses) => ({ $or: clauses.filter(Boolean) }),
});

function buildOptions(consistency) {
    if (!consistency) return {};
    if (
        consistency === CONSISTENCY.STRONG ||
        consistency?.consistentRead === true ||
        String(consistency?.consistencyMode || "").toLowerCase() === "strong" ||
        String(consistency || "").toLowerCase() === "strong"
    ) {
        return { consistentRead: true };
    }
    return {};
}

function normalizeLimit(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 100;
}

function normalizeOffset(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function normalizeSort(sort) {
    if (!Array.isArray(sort)) return [];
    return sort
        .map((entry) => {
            if (typeof entry === "string") {
                const [fieldName, direction = "ASC"] =
                    entry.trim().split(/\s+/);
                if (!fieldName) return null;
                return {
                    fieldName,
                    order: direction.toUpperCase() === "DESC" ? "DESC" : "ASC",
                };
            }
            if (entry && typeof entry === "object") {
                const fieldName = String(entry.fieldName || "");
                if (!fieldName) return null;
                return {
                    fieldName,
                    order: String(entry.direction || entry.order || "ASC")
                        .toUpperCase() === "DESC" ? "DESC" : "ASC",
                };
            }
            return null;
        })
        .filter(Boolean);
}

const elevatedGet = auth.elevate(items.get);
const elevatedInsert = auth.elevate(items.insert);
const elevatedUpdate = auth.elevate(items.update);
const elevatedSave = auth.elevate(items.save);
const elevatedRemove = auth.elevate(items.remove);
const elevatedQuery = auth.elevate(items.query);
const elevatedBulkInsert = auth.elevate(items.bulkInsert);
const elevatedBulkPatch = auth.elevate(items.bulkPatch);
const elevatedBulkUpdate = auth.elevate(items.bulkUpdate);
const elevatedBulkRemove = auth.elevate(items.bulkRemove);
const elevatedQueryReferencedItems = auth.elevate(
    items.queryReferencedItems
);

async function executeQuery({
    collection,
    filter,
    sort,
    limit = 100,
    offset = 0,
    consistency,
}) {
    const queryRequest = {
        paging: {
            limit: normalizeLimit(limit),
            offset: normalizeOffset(offset),
        },
    };

    if (filter) queryRequest.filter = filter;

    const normalizedSort = normalizeSort(sort);
    if (normalizedSort.length > 0) queryRequest.sort = normalizedSort;

    const response = await elevatedQuery(collection, queryRequest, {
        ...buildOptions(consistency),
        returnTotalCount: true,
    });

    const resultItems = Array.isArray(response?.items) ? response.items : [];
    const totalCount = Number(
        response?.totalCount ?? response?.pagingMetadata?.total
    );

    if (!Number.isFinite(totalCount)) {
        throw dataAccessError("WIX_DATA_QUERY_COUNT_MISSING");
    }

    return { items: resultItems, totalCount };
}

async function executeCount({ collection, filter, consistency }) {
    const result = await executeQuery({
        collection,
        filter,
        limit: 1,
        offset: 0,
        consistency,
    });
    return result.totalCount;
}

export async function queryItems({
    dataCollectionId,
    filter,
    sort,
    limit = 100,
    offset = 0,
    consistency,
}) {
    const pageLimit = normalizeLimit(limit);
    const pageOffset = normalizeOffset(offset);

    const result = await executeQuery({
        collection: dataCollectionId,
        filter,
        sort,
        limit: pageLimit,
        offset: pageOffset,
        consistency,
    });

    const hasNext = pageOffset + result.items.length < result.totalCount;

    return {
        items: result.items,
        totalCount: result.totalCount,
        hasNext,
        next: hasNext
            ? () => queryItems({
                  dataCollectionId,
                  filter,
                  sort,
                  limit: pageLimit,
                  offset: pageOffset + result.items.length,
                  consistency,
              })
            : null,
    };
}

export async function queryFirstItem({
    dataCollectionId,
    filter,
    consistency,
}) {
    const result = await queryItems({
        dataCollectionId,
        filter,
        limit: 1,
        offset: 0,
        consistency,
    });
    return result.items[0] || null;
}

export async function countItems(collection, filter, consistency) {
    return executeCount({ collection, filter, consistency });
}

export async function queryReferencedItems(
    collection,
    id,
    fieldName,
    consistency
) {
    const result = await elevatedQueryReferencedItems(
        collection,
        id,
        fieldName,
        buildOptions(consistency)
    );

    if (Array.isArray(result?.items)) return result.items;

    if (Array.isArray(result?.results)) {
        return result.results
            .map((entry) =>
                entry?.item ||
                entry?.dataItem?.data ||
                entry?.dataItem
            )
            .filter(Boolean);
    }

    return [];
}

function isMissingDataItemError(error) {
    const code = String(
        error?.code ||
        error?.errorCode ||
        error?.jsonContent?.errorCode ||
        ""
    ).toUpperCase();

    const broadCode = String(
        error?.broadCode ||
        error?.details?.broadCode ||
        error?.jsonContent?.broadCode ||
        ""
    ).toUpperCase();

    const message = String(
        error?.message ||
        error?.jsonPayload?.message ||
        ""
    ).toUpperCase();

    return code === "WDE0073" ||
        code === "WD_ITEM_DOES_NOT_EXIST" ||
        broadCode === "WD_ITEM_DOES_NOT_EXIST" ||
        message.includes("WDE0073") ||
        message.includes("WD_ITEM_DOES_NOT_EXIST") ||
        message.includes("DOES NOT EXIST IN COLLECTION");
}

export async function getItem(collection, id, consistency) {
    const normalizedCollection = String(collection || "").trim();
    const normalizedId = String(id || "").trim();

    if (!normalizedCollection || !normalizedId) return null;

    try {
        return await elevatedGet(
            normalizedCollection,
            normalizedId,
            buildOptions(consistency)
        );
    } catch (error) {
        if (isMissingDataItemError(error)) return null;
        throw error;
    }
}

export function insertItem(collection, item) {
    return elevatedInsert(collection, item);
}

export function updateItem(collection, item) {
    return elevatedUpdate(collection, item);
}

export function saveItem(collection, item) {
    return elevatedSave(collection, item);
}

export async function removeById(collection, idOrItem) {
    const id = idOrItem && typeof idOrItem === "object"
        ? idOrItem._id || idOrItem.id
        : idOrItem;

    if (!id) throw dataAccessError("REMOVE_ID_REQUIRED");

    await elevatedRemove(collection, id);
    return { _id: id };
}

export function bulkInsert(collection, records) {
    return elevatedBulkInsert(collection, records);
}

export function bulkUpdate(collection, records) {
    return elevatedBulkUpdate(collection, records);
}

export function bulkRemove(collection, ids, options) {
    return elevatedBulkRemove(collection, ids, options);
}

function buildBulkPatchCondition(filter) {
    if (!filter || typeof filter !== "object" || Array.isArray(filter)) {
        throw dataAccessError("BULK_PATCH_CONDITION_INVALID");
    }

    const condition = items.filter();

    for (const [field, operators] of Object.entries(filter)) {
        if (
            !operators ||
            typeof operators !== "object" ||
            Array.isArray(operators)
        ) {
            throw dataAccessError("BULK_PATCH_CONDITION_OPERATOR_INVALID");
        }

        const entries = Object.entries(operators);
        if (entries.length !== 1 || entries[0][0] !== "$eq") {
            throw dataAccessError("BULK_PATCH_CONDITION_UNSUPPORTED");
        }

        condition.eq(field, entries[0][1]);
    }

    return condition;
}

export async function bulkPatchItems(
    collection,
    itemIds,
    fieldModifications,
    options = {}
) {
    const ids = Array.isArray(itemIds) ? itemIds : [itemIds];

    if (
        ids.length === 0 ||
        ids.some((id) => typeof id !== "string" || !id.trim())
    ) {
        throw dataAccessError("BULK_PATCH_ITEM_IDS_INVALID");
    }

    const groups = Array.isArray(fieldModifications?.[0])
        ? fieldModifications
        : ids.map(() => fieldModifications || []);

    if (groups.length !== ids.length) {
        throw dataAccessError("BULK_PATCH_MODIFICATION_GROUPS_MISMATCH");
    }

    const modifications = groups[0] || [];
    const canonicalGroup = JSON.stringify(modifications);

    if (groups.some((group) => JSON.stringify(group || []) !== canonicalGroup)) {
        throw dataAccessError("BULK_PATCH_PER_ITEM_MODIFICATIONS_UNSUPPORTED");
    }

    let operation = elevatedBulkPatch(collection, ids);

    for (const modification of modifications) {
        const field = String(modification?.fieldPath || "").trim();
        if (!field) throw dataAccessError("BULK_PATCH_FIELD_REQUIRED");

        switch (modification.action) {
        case "SET_FIELD":
            operation = operation.setField(field, modification.value);
            break;
        case "INCREMENT_FIELD":
            operation = operation.incrementField(field, Number(modification.value));
            break;
        case "REMOVE_FIELD":
            operation = operation.removeField(field);
            break;
        case "APPEND_TO_ARRAY":
            operation = operation.appendToArray(field, modification.value);
            break;
        case "REMOVE_FROM_ARRAY":
            operation = operation.removeFromArray(field, modification.value);
            break;
        default:
            throw dataAccessError("BULK_PATCH_ACTION_UNSUPPORTED");
        }
    }

    const runOptions = {};

    if (options.condition?.filter) {
        runOptions.condition = buildBulkPatchCondition(options.condition.filter);
    }

    if (typeof options.suppressHooks === "boolean") {
        runOptions.suppressHooks = options.suppressHooks;
    }

    return operation.run(runOptions);
}

class QueryBuilder {
    constructor(
        collection,
        clauses = [],
        sort = [],
        limit,
        offset = 0,
        consistency = null
    ) {
        this._collection = collection;
        this._clauses = clauses;
        this._sort = sort;
        this._limit = limit;
        this._offset = offset;
        this._consistency = consistency;
    }

    _with(changes) {
        return new QueryBuilder(
            this._collection,
            changes.clauses ?? this._clauses,
            changes.sort ?? this._sort,
            changes.limit !== undefined ? changes.limit : this._limit,
            changes.offset !== undefined ? changes.offset : this._offset,
            changes.consistency !== undefined
                ? changes.consistency
                : this._consistency
        );
    }

    _add(clause) {
        return this._with({ clauses: [...this._clauses, clause] });
    }

    _filter() {
        if (this._clauses.length === 0) return undefined;
        if (this._clauses.length === 1) return this._clauses[0];
        return wql.and(...this._clauses);
    }

    eq(field, value) { return this._add(wql.eq(field, value)); }
    ne(field, value) { return this._add(wql.ne(field, value)); }
    gt(field, value) { return this._add(wql.gt(field, value)); }
    gte(field, value) { return this._add(wql.gte(field, value)); }
    lt(field, value) { return this._add(wql.lt(field, value)); }
    lte(field, value) { return this._add(wql.lte(field, value)); }
    in(field, values) { return this._add(wql.in(field, values)); }
    hasSome(field, values) { return this._add(wql.hasSome(field, values)); }
    startsWith(field, value) {
        return this._add(wql.startsWith(field, value));
    }

    contains(field, value) {
        return /Ids?$/.test(String(field))
            ? this.hasSome(field, [value])
            : this._add(wql.contains(field, value));
    }

    ascending(...fields) {
        return this._with({
            sort: [...this._sort, ...fields.map((field) => `${field} ASC`)],
        });
    }

    descending(...fields) {
        return this._with({
            sort: [...this._sort, ...fields.map((field) => `${field} DESC`)],
        });
    }

    limit(value) { return this._with({ limit: value }); }
    skip(value) { return this._with({ offset: value }); }

    consistent() {
        return this._with({ consistency: CONSISTENCY.STRONG });
    }

    get(id) { return getItem(this._collection, id, this._consistency); }
    insert(item) { return insertItem(this._collection, item); }
    update(item) { return updateItem(this._collection, item); }
    save(item) { return saveItem(this._collection, item); }
    remove(idOrItem) { return removeById(this._collection, idOrItem); }

    find(options = {}) {
        const consistency = options.consistentRead === true
            ? CONSISTENCY.STRONG
            : options.consistencyMode || this._consistency || undefined;

        return this._findPage(normalizeOffset(this._offset), consistency);
    }

    async _findPage(offset, consistency) {
        const result = await queryItems({
            dataCollectionId: this._collection,
            filter: this._filter(),
            sort: this._sort,
            limit: this._limit,
            offset,
            consistency,
        });

        const builder = this;
        const pageItems = result.items;

        return {
            items: pageItems,
            length: pageItems.length,
            totalCount: result.totalCount,
            hasNext() { return result.hasNext; },
            next() {
                if (!result.hasNext) {
                    return Promise.resolve({
                        items: [],
                        length: 0,
                        totalCount: result.totalCount,
                        hasNext: () => false,
                        next: () => Promise.resolve(null),
                    });
                }
                return builder._findPage(
                    offset + pageItems.length,
                    consistency
                );
            },
        };
    }

    count(options = {}) {
        const consistency = options.consistentRead === true
            ? CONSISTENCY.STRONG
            : options.consistencyMode || this._consistency || undefined;

        return countItems(this._collection, this._filter(), consistency);
    }
}

export function query(dataCollectionId) {
    return new QueryBuilder(dataCollectionId);
}
