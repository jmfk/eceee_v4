"""Legacy fields are transactionally maintained compatibility projections."""

from rest_framework.exceptions import ValidationError

from .context import projection_context
from .models import LegacyTagMapping, Tag
from .services import mutate, resolved_terms

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
            instance.tags = list(dict.fromkeys(term.name[:50] for term in terms))
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

    sources = list(MediaTag.objects.filter(namespace=instance.namespace, pk__in=ids))
    if len(sources) != len(set(map(str, ids))):
        raise ValidationError("One or more media tags are unavailable in this namespace.")
    return list(dict.fromkeys(str(canonical_for(source, user).pk) for source in sources))


def sync_legacy_media(instance, user, *, canonical=False):
    from .assignments import replace_assignments

    ids = (
        list(instance.canonical_tags.values_list("pk", flat=True))
        if canonical
        else legacy_media_ids(instance, list(instance.tags.values_list("pk", flat=True)), user)
    )
    replace_assignments(instance, [str(pk) for pk in ids], user, allow_empty_transition=True)


def sync_legacy_version(instance, user):
    from content.models import Namespace

    from .assignments import links_for, replace_assignments
    from .legacy import definition_for

    label = instance._meta.label_lower
    if label == "webpages.pageversion":
        namespace = Namespace.get_default(tenant=instance.page.tenant)
        definition = None
        ids = []
        for name in instance.tags or []:
            tag = Tag.objects.filter(
                tenant=namespace.tenant, namespace=namespace, tag_type="general", name=name
            ).first()
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
