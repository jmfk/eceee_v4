---
id: tags-manage
title: Manage tags
summary: Maintain shared tag types, tags and proposals.
order: 1
sectionId: tags
sectionTitle: Tags
sectionSummary: Organize pages, objects and media with a shared vocabulary.
sectionOrder: 5
---

# Manage tags

Open **Tags** in the main navigation to search all tags. The default list shows all types, ordered by name, with 50 tags per page. Choose a tag to view its details and usage, or use the add-filter icon in the search field to filter by type. Selected filters appear as removable pills. The **Tags** tab in Media Manager uses the same register, scoped to the selected media namespace.

Select **New tag** to enter a name, description and alternative names. Depending on your rights, **Apply** saves directly or **Submit proposal** sends the change for approval. **Cancel** returns to the tag list. Members can use terms and submit proposals; only explicitly authorized users can change the structure.

For a selected tag, its **Location** shows the tag type and path. Open **Actions** and choose **Edit**, **Move**, **Merge** or **Archive**. In **Edit**, the **Tag type** field can move an approved, unused leaf to another type in the same namespace when you have edit rights on the current type and create rights on the destination. The tag keeps its ID and becomes a root tag; tags with children, merged sources, assignments, legacy links or pending proposals cannot change type. The chosen form appears with **Apply** or **Submit proposal**, and **Cancel** returns to the read-only details without saving. Move keeps the subtree together. Merge keeps the old identity and directs existing assignments to the target. Archive preserves existing assignments and prevents new ones. Move or archive active children before archiving their parent. Archived tags can be reactivated through **Actions** by a user with restore permission.

Successful structure changes offer **Undo**, except for tag type changes. If later changes prevent restoration, review the current term and make a new change. **History** shows who changed the register and the before/after state.

**Proposals** shows proposed changes and their decision status. Approval requires both approval rights and permission for the proposed action. A term proposed for a draft must be approved or removed before publication. Media assignments require an approved term.

In **Types**, search or select a type in the left column to view its details on the right. Use **Edit** to change its name, description or allowed uses, then **Apply** or **Cancel**. **New type** opens an empty form. **Clone** copies a selected type's settings into a new form; give the copy a new stable key and a distinct name in its namespace. Administrators use **Rights** to assign named users a role template or specific permissions. Classification permissions do not grant access to edit the content itself.

If existing tags appear with a setup notice, you can still search them and filter by their existing type using the add-filter icon. Search and type filters work together across all pages. A workspace owner must complete the migration before these tags can be edited in this view.

The new register is being introduced alongside the older tag fields. Complete the verified migration before switching the site's existing tag readers to the shared register.

To import an approved Kanban attachment into Media Manager, open its card and select **Importera till media** beside the attachment. Choose the destination namespace and approved tags, then **Importera kopia**. The source file stays attached to its card.
