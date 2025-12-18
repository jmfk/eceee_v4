import hashlib
from statistics.models import Experiment, Variant, Assignment

class ABTestingService:
    @staticmethod
    def get_variant(experiment_id, user_id):
        """
        Assigns a variant to a user based on a deterministic hash of user_id and experiment_id.
        Ensures a user always gets the same variant for the same experiment.
        """
        try:
            experiment = Experiment.objects.get(id=experiment_id, status="running")
        except Experiment.DoesNotExist:
            return None

        # Check if already assigned
        try:
            assignment = Assignment.objects.get(experiment=experiment, user_id=user_id)
            return assignment.variant
        except Assignment.DoesNotExist:
            pass

        # Perform deterministic assignment
        variants = list(experiment.variants.all())
        if not variants:
            return None

        # Simple hash-based bucket assignment
        hash_val = hashlib.md5(f"{experiment_id}{user_id}".encode()).hexdigest()
        hash_int = int(hash_val, 16)
        bucket = hash_int % 100

        current_threshold = 0
        assigned_variant = variants[0] # Default
        
        for variant in variants:
            current_threshold += variant.allocation_percent
            if bucket < current_threshold:
                assigned_variant = variant
                break

        # Save assignment
        Assignment.objects.create(
            experiment=experiment,
            variant=assigned_variant,
            user_id=user_id
        )
        
        return assigned_variant

