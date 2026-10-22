"""Legacy fields are transactionally maintained compatibility projections."""

from rest_framework.exceptions import ValidationError

from .context import projection_context
from .models import LegacyTagMapping, Tag
from .services import mutate, require, resolve_term, resolved_terms

NEWS_FIELDS = {
    "news_type": "types",
    "news_category": "categories",
    "news_source": "sources",
    "news_topic": "topics",
    "news_keyword": "keywords",
}


def media_alias(term, user):
    from file_manager.models import MediaTag

    mapping = term.legacy_mappings.filter(source_kind="media").order_by("pk").first()
    if mapping:
        source = MediaTag.objects.filter(pk=mapping.source_id, namespace=term.namespace).first()
        if source:
            return source
    # Reuse a historical general tag only when its identity is unclaimed.
    source = (
        MediaTag.objects.filter(namespace=term.namespace, name=term.name).first()
        if term.tag_type == "general"
        else None
    )
    if source and not LegacyTagMapping.objects.filter(source_kind="media", source_id=str(source.pk)).exists():
        LegacyTagMapping.objects.create(
            source_kind="media", source_id=str(source.pk), canonical_tag=term, source_name=source.name
        )
        return source
    # A legacy name is only an adapter identifier. Distinct types with equal
    # labels must never be semantically merged by the old unique-name index.
    name = term.name[:50]
    slug = term.slug[:50]
    if (
        MediaTag.objects.filter(namespace=term.namespace, name=name).exists()
        or MediaTag.objects.filter(namespace=term.namespace, slug=slug).exists()
    ):
        name, slug = f"{name[:14]}~{term.pk.hex}", f"term-{term.pk.hex}"
    source = MediaTag.objects.create(
        namespace=term.namespace, name=name, slug=slug, color=term.color, description=term.description, created_by=user
    )
    from .context import record_creation

    record_creation("media_tag_ids", source)
    LegacyTagMapping.objects.create(
        source_kind="media", source_id=str(source.pk), canonical_tag=term, source_name=term.name
    )
    return source


def news_alias(term, user):
    from object_storage.models import ObjectInstance, ObjectTypeDefinition

    mapping = term.legacy_mappings.filter(source_kind="object").first()
    if mapping:
        return int(mapping.source_id)
    from django.db.models import Q

    definition = (
        ObjectTypeDefinition.objects.filter(name=term.tag_type)
        .filter(Q(namespace__isnull=True) | Q(namespace_id=term.namespace_id, namespace__tenant_id=term.tenant_id))
        .first()
    )
    if not definition:
        raise ValidationError("The legacy News classification definition is missing. Reconcile definitions first.")
    source = ObjectInstance.objects.create(
        tenant=term.tenant,
        object_type=definition,
        title=term.name,
        slug=f"classification-{term.pk.hex}",
        created_by=user,
    )
    source.create_version(user, data={})
    LegacyTagMapping.objects.create(
        source_kind="object", source_id=str(source.pk), canonical_tag=term, source_name=term.name
    )
    return source.pk


def mirror_assignments(instance, terms, user):
    label = instance._meta.label_lower
    terms = resolved_terms(terms)
    with projection_context():
        if label in {"file_manager.mediafile", "file_manager.mediacollection"}:
            instance.canonical_tags.set(terms)
            instance.tags.set([media_alias(term, user) for term in terms])
        elif label == "webpages.pageversion":
            # Page legacy tags are a flat display adapter; UUID assignments
            # retain full labels, types and paths without ambiguity.
            instance.tags = list(dict.fromkeys(term.name[:50] for term in terms if term.tag_type == "general"))
            type(instance).objects.filter(pk=instance.pk).update(tags=instance.tags)
        elif label == "object_storage.objectversion" and instance.object_instance.object_type.name == "news":
            data = dict(instance.data)
            for key, field in NEWS_FIELDS.items():
                data[field] = [news_alias(term, user) for term in terms if term.tag_type == key]
            instance.data = data
            type(instance).objects.filter(pk=instance.pk).update(data=data)


def legacy_media_ids(instance, ids, user):
    from file_manager.models import MediaTag

    from .legacy import canonical_for

    result = []
    for pk in ids:
        term = Tag.objects.filter(pk=pk, namespace=instance.namespace, tenant=instance.namespace.tenant).first()
        if term is None:
            source = MediaTag.objects.filter(pk=pk, namespace=instance.namespace).first()
            if source is None:
                raise ValidationError("A selected media classification is unavailable in this namespace.")
            term = canonical_for(source, user)
        require(user, term.classification_type, "use")
        result.append(str(resolve_term(term).pk))
    return list(dict.fromkeys(result))


def sync_legacy_media(instance, user, *, canonical=False):
    from .assignments import replace_assignments

    ids = (
        list(instance.canonical_tags.values_list("pk", flat=True))
        if canonical
        else legacy_media_ids(instance, list(instance.tags.values_list("pk", flat=True)), user)
    )
    replace_assignments(instance, [str(pk) for pk in ids], user, allow_empty_transition=True)


def historical_page_labels(instance):
    """Recognize legacy labels after an audited canonical rename, by UUID."""
    from .assignments import links_for
    from .models import ClassificationOperation

    terms = {str(link.tag_id): link.tag for link in links_for(instance) if link.tag.tag_type == "general"}
    labels = {term.name[:50]: term for term in terms.values()}
    if not terms:
        return labels
    for mapping in LegacyTagMapping.objects.filter(canonical_tag_id__in=terms):
        labels[mapping.source_name[:50]] = terms[str(mapping.canonical_tag_id)]
    for before in ClassificationOperation.objects.filter(before__has_any_keys=list(terms)).values_list(
        "before", flat=True
    ):
        for key, state in before.items():
            if key in terms and state.get("name"):
                labels[state["name"][:50]] = terms[key]
    return labels


def sync_legacy_version(instance, user):
    from content.models import Namespace

    from .assignments import links_for, replace_assignments
    from .legacy import definition_for

    label = instance._meta.label_lower
    if label == "webpages.pageversion":
        namespace = Namespace.get_default(tenant=instance.page.tenant)
        definition = None
        ids = []
        historical = historical_page_labels(instance)
        for name in instance.tags or []:
            tag = (
                historical.get(name)
                or Tag.objects.filter(
                    tenant=namespace.tenant, namespace=namespace, tag_type="general", name=name
                ).first()
            )
            if not tag:
                if definition is None:
                    definition = definition_for(namespace, user)
                operation = mutate(user, definition, "create", payload={"name": name})
                tag = Tag.objects.get(pk=next(iter(operation.after)))
            ids.append(str(tag.pk))
        # Raw legacy name lists only own the general dimension.
        ids += [str(link.tag_id) for link in links_for(instance) if link.tag.tag_type != "general"]
    elif label == "object_storage.objectversion" and instance.object_instance.object_type.name == "news":
        from object_storage.models import ObjectInstance

        from .transfer import import_legacy_news_term

        ids = [str(link.tag_id) for link in links_for(instance) if link.tag.tag_type not in NEWS_FIELDS]
        for key, field in NEWS_FIELDS.items():
            references = instance.data.get(field) or []
            references = references if isinstance(references, list) else [references]
            for pk in references:
                source = ObjectInstance.objects.get(
                    pk=pk, tenant=instance.object_instance.tenant, object_type__name=key
                )
                ids.append(str(import_legacy_news_term(source, user).pk))
    else:
        return
    replace_assignments(instance, ids, user)


def media_term_query(tenant, text, *, exact=False):
    """Search resolved taxonomy labels and aliases, retaining pre-cutover rows."""
    from django.db.models import Q

    from .services import matching_term_ids

    lookup = "iexact" if exact else "icontains"
    terms = Tag.objects.filter(tenant=tenant).filter(
        Q(**{f"name__{lookup}": text}) | Q(**{f"slug__{lookup}": text}) | Q(alternative_names__contains=[text])
    )
    ids = matching_term_ids(list(terms.values_list("pk", flat=True)), tenant=tenant, include_descendants=False)
    return Q(classification_links__tag_id__in=ids) | (
        Q(classification_links__isnull=True) & Q(**{f"tags__name__{lookup}": text})
    )
