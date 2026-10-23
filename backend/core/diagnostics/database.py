"""Bounded, parameterized queries against diagnostic views only."""

from django.db import DatabaseError, connections, transaction
from psycopg2 import sql
from rest_framework import exceptions

from .access import Unavailable, make_cursor, read_cursor, require_global
from .catalog import projections

ALIAS = "diagnostics"
SCHEMA = "eceee_diagnostics"
READ_ROLE = "eceee_diagnostics_reader"
OWNER_ROLE = "eceee_diagnostics_views"
OPERATORS = {"eq": "=", "ne": "<>", "lt": "<", "lte": "<=", "gt": ">", "gte": ">="}


def query_data(request, data, tenants):
    table = data["table"]
    projection = projections().get(table)
    if projection is None:
        raise exceptions.ValidationError("Table is not approved for diagnostic queries.")
    if projection["global"]:
        require_global(request)
    available = projection["columns"]
    columns = data.get("columns") or list(available)
    sort = data.get("sort") or [{"column": "id", "direction": "asc"}]
    if not columns or len(set(columns)) != len(columns) or any(c not in available for c in columns):
        raise exceptions.ValidationError("Select approved columns only.")
    # Stable key tie-breaker; all reviewed projections include id.
    if not any(item["column"] == "id" for item in sort):
        sort = [*sort, {"column": "id", "direction": "asc"}]
    if any(item["column"] not in available for item in sort):
        raise exceptions.ValidationError("Sort column is not approved.")
    clauses, params = [], []
    for item in data.get("filters", []):
        name, op, value = item["column"], item["operator"], item.get("value")
        if name not in available:
            raise exceptions.ValidationError("Filter column is not approved.")
        column = sql.Identifier(name)
        if op == "is_null":
            if not isinstance(value, bool):
                raise exceptions.ValidationError("is_null requires a boolean.")
            clauses.append(sql.SQL("{} IS {}NULL").format(column, sql.SQL("" if value else "NOT ")))
        elif op == "in":
            if (
                not isinstance(value, list)
                or not 0 < len(value) <= 100
                or any(isinstance(v, (dict, list)) for v in value)
            ):
                raise exceptions.ValidationError("in requires 1-100 scalar values.")
            clauses.append(sql.SQL("{} IN ({})").format(column, sql.SQL(",").join(sql.Placeholder() for _ in value)))
            params.extend(value)
        elif op in OPERATORS and not isinstance(value, (dict, list)) and value is not None:
            clauses.append(sql.SQL("{} {} %s").format(column, sql.SQL(OPERATORS[op])))
            params.append(value)
        else:
            raise exceptions.ValidationError("Unsupported diagnostic filter.")
    signature = {**data, "tenants": tenants, "sort": sort}
    signature.pop("cursor", None)
    state = read_cursor(data.get("cursor"), request, signature)
    offset = state["offset"] if state else 0
    if offset > 100000:
        raise exceptions.ValidationError("Refine the query before continuing beyond 100000 rows.")
    where = sql.SQL(" AND ").join(clauses) if clauses else sql.SQL("TRUE")
    ordering = sql.SQL(",").join(
        sql.SQL("{} {} NULLS LAST").format(sql.Identifier(item["column"]), sql.SQL(item["direction"].upper()))
        for item in sort
    )
    statement = sql.SQL("SELECT {} FROM {}.{} WHERE {} ORDER BY {} LIMIT %s OFFSET %s").format(
        sql.SQL(",").join(map(sql.Identifier, columns)),
        sql.Identifier(SCHEMA),
        sql.Identifier(table),
        where,
        ordering,
    )
    if ALIAS not in connections:
        raise Unavailable()
    connection = connections[ALIAS]
    if connection.vendor != "postgresql":
        raise Unavailable()
    try:
        with transaction.atomic(using=ALIAS), connection.cursor() as cursor:
            # Enforce even if the role's default is misconfigured. Never use the CMS connection.
            cursor.execute("SET TRANSACTION READ ONLY")
            cursor.execute("SET LOCAL statement_timeout = '5s'")
            cursor.execute("SET LOCAL lock_timeout = '1s'")
            cursor.execute("SELECT set_config('eceee_diagnostics.tenant_ids', %s, true)", [",".join(tenants)])
            cursor.execute(
                "SELECT set_config('eceee_diagnostics.global_access', %s, true)",
                ["on" if projection["global"] else "off"],
            )
            cursor.execute("SELECT current_user")
            if cursor.fetchone()[0] != READ_ROLE:
                raise Unavailable()
            cursor.execute(statement, [*params, data["limit"] + 1, offset])
            rows = cursor.fetchall()
    except DatabaseError:
        # Do not reflect SQL, values, driver messages or connection details.
        raise Unavailable("Diagnostic query failed or exceeded its time limit.") from None
    more = len(rows) > data["limit"]
    results = [dict(zip(columns, row)) for row in rows[: data["limit"]]]
    return {
        "results": results,
        "next_cursor": make_cursor(request, signature, offset=offset + len(results)) if more else None,
        "consistency": "live_rows",
        "limited": more,
    }
