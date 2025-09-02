# Unified Widget System Migration Guide

## Overview

This guide provides step-by-step instructions for migrating from the current widget system to the unified widget system. It covers preparation, execution, validation, and rollback procedures.

## Pre-Migration Checklist

### Environment Preparation
- [ ] Backup production database
- [ ] Backup media files and static assets
- [ ] Verify staging environment matches production
- [ ] Ensure sufficient disk space for migration
- [ ] Schedule maintenance window
- [ ] Notify stakeholders of migration timeline

### Code Deployment
- [ ] Deploy unified widget system code to staging
- [ ] Run comprehensive test suite on staging
- [ ] Verify feature flags are configured correctly
- [ ] Test migration scripts on staging data
- [ ] Validate rollback procedures on staging

### Team Preparation
- [ ] Train content editors on new interface
- [ ] Prepare support documentation
- [ ] Set up monitoring and alerting
- [ ] Brief development team on rollback procedures
- [ ] Establish communication channels for migration day

## Migration Process

### Phase 1: Backend Deployment (Week 1)

#### Step 1.1: Deploy Backend Changes
```bash
# Deploy unified widget system backend
git checkout main
git pull origin main
docker-compose build backend
docker-compose up -d backend

# Verify backend deployment
docker-compose exec backend python manage.py check
docker-compose exec backend python manage.py migrate --dry-run
```

#### Step 1.2: Enable API Compatibility Layer
```bash
# Enable new API endpoints while keeping legacy ones
docker-compose exec backend python manage.py shell << 'EOF'
from config.feature_flags import DeploymentPhase
DeploymentPhase.apply_phase('phase_1_backend_rollout')
EOF
```

#### Step 1.3: Validate Backend Deployment
```bash
# Run backend tests
docker-compose exec backend python manage.py test webpages.tests.test_unified_widget_system

# Test API endpoints
curl -X GET http://localhost:8000/api/v1/widgets/types/
curl -X GET http://localhost:8000/api/webpages/widgets/  # Legacy endpoint should still work
```

### Phase 2: Frontend Deployment (Week 2)

#### Step 2.1: Deploy Frontend Components
```bash
# Deploy React components
cd frontend
npm run build
docker-compose build frontend
docker-compose up -d frontend
```

#### Step 2.2: Enable Frontend Features for Beta Users
```bash
# Enable frontend features for beta testing
docker-compose exec backend python manage.py shell << 'EOF'
from config.feature_flags import DeploymentPhase
DeploymentPhase.apply_phase('phase_2_frontend_deployment')
EOF
```

#### Step 2.3: Validate Frontend Deployment
```bash
# Run frontend tests
docker-compose exec frontend npm run test:run

# Run integration tests
cd tests/integration
npx playwright test unified_widget_integration.test.js
```

### Phase 3: Data Migration (Week 3)

#### Step 3.1: Validate Migration Readiness
```bash
# Validate existing data
docker-compose exec backend python manage.py migrate_unified_widgets --validate-only

# Check for potential issues
docker-compose exec backend python manage.py migrate_unified_widgets --dry-run
```

#### Step 3.2: Create Backup
```bash
# Create comprehensive backup
docker-compose exec backend python manage.py dumpdata > backup_pre_migration.json

# Create widget-specific backup
docker-compose exec backend python manage.py migrate_unified_widgets --dry-run --backup-file=widget_backup.json
```

#### Step 3.3: Execute Migration
```bash
# Run migration in batches
docker-compose exec backend python manage.py migrate_unified_widgets --batch-size=50

# Monitor migration progress
tail -f backend/logs/migration.log
```

#### Step 3.4: Validate Migration Results
```bash
# Validate migrated data
docker-compose exec backend python manage.py migrate_unified_widgets --validate-only

# Run post-migration tests
docker-compose exec backend python manage.py test webpages.tests.test_widget_migration
```

### Phase 4: Gradual Rollout (Week 4)

#### Step 4.1: Enable for Percentage of Users
```bash
# Start with 10% rollout
docker-compose exec backend python manage.py shell << 'EOF'
from config.feature_flags import FeatureFlagManager
FeatureFlagManager.FLAGS['unified_widgets_enabled']['rollout_percentage'] = 10
FeatureFlagManager.clear_cache()
EOF
```

#### Step 4.2: Monitor and Increase Rollout
```bash
# Monitor performance and errors
# If stable, increase to 25%
docker-compose exec backend python manage.py shell << 'EOF'
from config.feature_flags import FeatureFlagManager
FeatureFlagManager.FLAGS['unified_widgets_enabled']['rollout_percentage'] = 25
FeatureFlagManager.clear_cache()
EOF

# Continue increasing: 50%, 75%, 100%
```

#### Step 4.3: Full Rollout
```bash
# Enable for all users
docker-compose exec backend python manage.py shell << 'EOF'
from config.feature_flags import DeploymentPhase
DeploymentPhase.apply_phase('phase_4_full_rollout')
EOF
```

### Phase 5: Legacy System Deprecation (Week 5-6)

#### Step 5.1: Deprecation Warnings
```bash
# Add deprecation warnings to legacy endpoints
# Monitor usage of legacy APIs
# Communicate deprecation timeline to users
```

#### Step 5.2: Disable Legacy System
```bash
# Disable legacy API endpoints
docker-compose exec backend python manage.py shell << 'EOF'
from config.feature_flags import DeploymentPhase
DeploymentPhase.apply_phase('phase_5_legacy_deprecation')
EOF
```

#### Step 5.3: Clean Up Legacy Code
```bash
# Remove legacy code after validation period
# Update documentation
# Archive legacy tests
```

## Rollback Procedures

### Immediate Rollback (Within 24 hours)

#### Option 1: Feature Flag Rollback
```bash
# Disable unified widget system immediately
docker-compose exec backend python manage.py shell << 'EOF'
from config.feature_flags import FeatureFlagManager
FeatureFlagManager.FLAGS['unified_widgets_enabled']['default'] = False
FeatureFlagManager.FLAGS['unified_widgets_enabled']['rollout_percentage'] = 0
FeatureFlagManager.clear_cache()
EOF
```

#### Option 2: Data Rollback
```bash
# Restore from backup file
docker-compose exec backend python manage.py migrate_unified_widgets --rollback=widget_backup.json

# Verify rollback
docker-compose exec backend python manage.py migrate_unified_widgets --validate-only
```

### Full System Rollback

#### Step 1: Stop Services
```bash
docker-compose down
```

#### Step 2: Restore Database
```bash
# Restore from database backup
docker-compose exec db psql -U postgres -d eceee_v4 < backup_pre_migration.sql

# Or restore from Django fixture
docker-compose exec backend python manage.py loaddata backup_pre_migration.json
```

#### Step 3: Deploy Previous Code Version
```bash
# Checkout previous stable version
git checkout [previous-stable-commit]
docker-compose build
docker-compose up -d
```

#### Step 4: Validate Rollback
```bash
# Run tests to ensure system is working
docker-compose exec backend python manage.py test
docker-compose exec frontend npm run test:run
```

## Monitoring and Validation

### Key Metrics to Monitor

#### Performance Metrics
- Page load times
- API response times
- Database query performance
- Memory usage
- Error rates

#### User Experience Metrics
- Widget creation success rate
- Editor loading times
- User session duration
- Error reports from users

#### System Health Metrics
- Server CPU and memory usage
- Database connection pool usage
- Cache hit rates
- Queue processing times

### Monitoring Commands

```bash
# Check system health
docker-compose exec backend python manage.py health_check

# Monitor performance
docker-compose exec backend python manage.py performance_report

# Check error rates
docker-compose logs backend | grep ERROR | tail -50

# Monitor database performance
docker-compose exec db psql -U postgres -d eceee_v4 -c "
SELECT query, calls, total_time, mean_time 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;"
```

### Validation Checklist

#### Post-Migration Validation
- [ ] All pages load correctly
- [ ] Widget editing functionality works
- [ ] Widget previews generate correctly
- [ ] Page publishing works
- [ ] Search functionality includes widget content
- [ ] Performance is within acceptable limits
- [ ] No data loss has occurred
- [ ] User permissions are preserved

#### User Acceptance Testing
- [ ] Content editors can create new pages
- [ ] Existing content displays correctly
- [ ] Widget configuration is intuitive
- [ ] Preview accuracy is maintained
- [ ] Workflow efficiency is improved or maintained

## Troubleshooting

### Common Issues and Solutions

#### Migration Fails with Validation Errors
```bash
# Check specific errors
docker-compose exec backend python manage.py migrate_unified_widgets --validate-only --verbose

# Fix data issues manually or adjust migration script
# Re-run migration with --force flag if necessary
docker-compose exec backend python manage.py migrate_unified_widgets --force
```

#### Performance Degradation
```bash
# Check database indexes
docker-compose exec backend python manage.py dbshell << 'EOF'
EXPLAIN ANALYZE SELECT * FROM webpages_pageversion WHERE widgets IS NOT NULL;
EOF

# Run performance optimization
docker-compose exec backend python manage.py optimize_widget_queries
```

#### Feature Flags Not Working
```bash
# Clear feature flag cache
docker-compose exec backend python manage.py shell << 'EOF'
from config.feature_flags import FeatureFlagManager
FeatureFlagManager.clear_cache()
EOF

# Restart application servers
docker-compose restart backend frontend
```

#### Widget Previews Not Generating
```bash
# Check preview service
curl -X POST http://localhost:8000/api/v1/widgets/types/text-block/preview/ \
  -H "Content-Type: application/json" \
  -d '{"configuration": {"title": "Test", "content": "Test content"}}'

# Check logs for errors
docker-compose logs backend | grep preview
```

### Emergency Contacts

- **Technical Lead**: [Contact Information]
- **DevOps Team**: [Contact Information]  
- **Database Administrator**: [Contact Information]
- **Product Owner**: [Contact Information]

## Post-Migration Tasks

### Week 1 After Migration
- [ ] Monitor system performance daily
- [ ] Review error logs and user feedback
- [ ] Address any critical issues immediately
- [ ] Update documentation based on lessons learned
- [ ] Conduct team retrospective

### Month 1 After Migration
- [ ] Analyze performance improvements
- [ ] Gather user satisfaction feedback
- [ ] Plan removal of legacy code
- [ ] Update training materials
- [ ] Document best practices

### Ongoing Maintenance
- [ ] Regular performance monitoring
- [ ] Quarterly review of feature flags
- [ ] Continuous improvement based on user feedback
- [ ] Keep migration procedures up to date
- [ ] Train new team members on unified system

## Success Criteria

### Technical Success
- [ ] Zero data loss during migration
- [ ] Performance maintained or improved
- [ ] All tests passing
- [ ] Error rates within acceptable limits
- [ ] Rollback procedures tested and working

### Business Success
- [ ] User productivity maintained or improved
- [ ] Content creation workflow efficiency
- [ ] Positive user feedback
- [ ] Support ticket volume manageable
- [ ] Migration completed within timeline

### Long-term Success
- [ ] System stability maintained
- [ ] Technical debt reduced
- [ ] Development velocity improved
- [ ] User satisfaction increased
- [ ] Business objectives achieved

---

## Appendix

### Migration Script Examples

#### Custom Widget Type Migration
```python
# Example of custom migration for specific widget types
def migrate_custom_gallery_widget(widget_data):
    # Custom logic for gallery widget migration
    if widget_data.get('widget_type_name') == 'CustomGallery':
        # Transform configuration
        old_config = json.loads(widget_data.get('json_config', '{}'))
        new_config = {
            'images': old_config.get('gallery_images', []),
            'layout': old_config.get('display_mode', 'grid'),
            'columns': old_config.get('columns', 3)
        }
        widget_data['config'] = new_config
        widget_data['type_slug'] = 'gallery'
    return widget_data
```

#### Batch Processing Example
```python
# Example of processing widgets in batches
def process_widget_batch(widgets, batch_size=50):
    for i in range(0, len(widgets), batch_size):
        batch = widgets[i:i + batch_size]
        with transaction.atomic():
            for widget in batch:
                migrate_widget(widget)
        time.sleep(0.1)  # Brief pause between batches
```

### Testing Scripts

#### Migration Validation Script
```bash
#!/bin/bash
# Validate migration results
echo "Validating widget migration..."

# Check widget counts
ORIGINAL_COUNT=$(docker-compose exec backend python manage.py shell -c "
from webpages.models import PageVersion
print(sum(len(v.widgets or []) for v in PageVersion.objects.all()))
")

echo "Original widget count: $ORIGINAL_COUNT"

# Check for migration errors
ERROR_COUNT=$(docker-compose logs backend | grep "Migration error" | wc -l)
echo "Migration errors: $ERROR_COUNT"

if [ "$ERROR_COUNT" -gt 0 ]; then
    echo "❌ Migration validation failed"
    exit 1
else
    echo "✅ Migration validation passed"
fi
```

This comprehensive migration guide provides the framework for safely transitioning to the unified widget system while minimizing risk and ensuring data integrity.
