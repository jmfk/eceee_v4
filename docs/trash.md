# CMS Trash

The workspace Trash at `/trash` lists deleted pages, media files, media collections, objects, and object types. It supports type filters, title/name search, and restoring one or up to 100 selected items in one request. The API is `GET /api/v1/trash/` and `POST /api/v1/trash/restore/` with `{"items": [{"type": "object", "id": "123"}]}`. Both operations are scoped to the selected workspace and the user's permissions.

Deleting an object moves its active descendants to Trash and preserves versions and relationships. Restoring a child requires its parent to be active or included in the same selection. Restoring an object whose type was deleted likewise requires the type to be active or selected. Object type deletion can include its active instances with `delete_instances=true`; otherwise the API refuses to delete a type that still has active instances. Global object types cannot be deleted from a workspace.

Deleted objects and types are excluded from the CMS browsers, published object queries, the TypeScript publisher, and Designer source lists. The object and type migrations add flags and metadata without deleting or rewriting existing rows. Trash contents remain until an explicitly initiated permanent cleanup; there is no automatic media purge.

Other CMS resource types still need to be added to this shared Trash contract before their deletion routes can be considered restorable.
